import {error, info, warning} from '@actions/core'
// eslint-disable-next-line camelcase
import {context as github_context} from '@actions/github'
import pLimit from 'p-limit'
import {type Bot} from './bot'
import {
  Commenter,
  COMMENT_REPLY_TAG,
  RAW_SUMMARY_END_TAG,
  RAW_SUMMARY_START_TAG,
  SHORT_SUMMARY_END_TAG,
  SHORT_SUMMARY_START_TAG,
  SUMMARIZE_TAG
} from './commenter'
import {ComplexityAnalyzer} from './complexity-analyzer'
import {Inputs} from './inputs'
import {octokit} from './octokit'
import {type Options} from './options'
import {PerformanceAnalyzer} from './performance-analyzer'
import {type Prompts} from './prompts'
import {SecurityScanner} from './security-scanner'
import {getTokenCount} from './tokenizer'

// eslint-disable-next-line camelcase
const context = github_context
const repo = context.repo

const ignoreKeyword = '@codereviewer: ignore'

async function getHighestReviewedCommitId(
  commenter: Commenter
): Promise<string> {
  if (context.payload.pull_request == null) {
    throw new Error('pull_request is null')
  }

  const existingSummarizeCmt = await commenter.findCommentWithTag(
    SUMMARIZE_TAG,
    context.payload.pull_request.number
  )

  if (existingSummarizeCmt == null) {
    return context.payload.pull_request.base.sha
  }

  const existingCommitIdsBlock = commenter.getReviewedCommitIdsBlock(
    existingSummarizeCmt.body
  )

  if (existingCommitIdsBlock === '') {
    return context.payload.pull_request.base.sha
  }

  const allCommitIds = await commenter.getAllCommitIds()
  const highestReviewedCommitId = commenter.getHighestReviewedCommitId(
    allCommitIds,
    commenter.getReviewedCommitIds(existingCommitIdsBlock)
  )

  if (
    highestReviewedCommitId === '' ||
    highestReviewedCommitId === context.payload.pull_request.head.sha
  ) {
    info(
      `Will review from the base commit: ${
        context.payload.pull_request.base.sha as string
      }`
    )
    return context.payload.pull_request.base.sha
  }

  info(`Will review from commit: ${highestReviewedCommitId}`)
  return highestReviewedCommitId
}

function filterFilesByPath(
  files: any[],
  options: Options
): {selected: any[]; ignored: any[]} {
  const selected: any[] = []
  const ignored: any[] = []

  for (const file of files) {
    if (!options.checkPath(file.filename)) {
      info(`skip for excluded path: ${file.filename}`)
      ignored.push(file)
    } else {
      selected.push(file)
    }
  }

  return {selected, ignored}
}

async function processSummaries(
  lightBot: Bot,
  heavyBot: Bot,
  inputs: Inputs,
  prompts: Prompts,
  options: Options,
  filesAndChanges: Array<
    [string, string, string, Array<[number, number, string]>]
  >,
  summaryContext: {
    openaiConcurrencyLimit: any
    summariesFailed: string[]
  }
): Promise<{
  summaries: Array<[string, string, boolean]>
  skippedFiles: string[]
}> {
  const {openaiConcurrencyLimit, summariesFailed} = summaryContext
  const doSummary = async (
    filename: string,
    fileContent: string,
    fileDiff: string
  ): Promise<[string, string, boolean] | null> => {
    info(`summarize: ${filename}`)
    const ins = inputs.clone()
    if (fileDiff.length === 0) {
      warning(`summarize: file_diff is empty, skip ${filename}`)
      summariesFailed.push(`${filename} (empty diff)`)
      return null
    }

    ins.filename = filename
    ins.fileDiff = fileDiff

    const summarizePrompt = prompts.renderSummarizeFileDiff(
      ins,
      options.reviewSimpleChanges
    )
    const tokens = getTokenCount(summarizePrompt)

    if (tokens > options.lightTokenLimits.requestTokens) {
      info(`summarize: diff tokens exceeds limit, skip ${filename}`)
      summariesFailed.push(`${filename} (diff tokens exceeds limit)`)
      return null
    }

    try {
      const [summarizeResp] = await lightBot.chat(summarizePrompt, {})

      if (summarizeResp === '') {
        info('summarize: nothing obtained from openai')
        summariesFailed.push(`${filename} (nothing obtained from openai)`)
        return null
      }

      if (options.reviewSimpleChanges === false) {
        const triageRegex = /\[TRIAGE\]:\s*(NEEDS_REVIEW|APPROVED)/
        const triageMatch = triageRegex.exec(summarizeResp)

        if (triageMatch != null) {
          const triage = triageMatch[1]
          const needsReview = triage === 'NEEDS_REVIEW'
          const summary = summarizeResp.replace(triageRegex, '').trim()
          info(`filename: ${filename}, triage: ${triage}`)
          return [filename, summary, needsReview]
        }
      }
      return [filename, summarizeResp, true]
    } catch (e: any) {
      warning(`summarize: error from openai: ${e as string}`)
      summariesFailed.push(`${filename} (error from openai: ${e as string})})`)
      return null
    }
  }

  const summaryPromises = []
  const skippedFiles = []
  for (const [filename, fileContent, fileDiff] of filesAndChanges) {
    if (options.maxFiles <= 0 || summaryPromises.length < options.maxFiles) {
      summaryPromises.push(
        openaiConcurrencyLimit(
          async () => await doSummary(filename, fileContent, fileDiff)
        )
      )
    } else {
      skippedFiles.push(filename)
    }
  }

  const summaries = (await Promise.all(summaryPromises)).filter(
    summary => summary !== null
  ) as Array<[string, string, boolean]>

  if (summaries.length > 0) {
    const batchSize = 10
    for (let i = 0; i < summaries.length; i += batchSize) {
      const summariesBatch = summaries.slice(i, i + batchSize)
      for (const [filename, summary] of summariesBatch) {
        inputs.rawSummary += `---
${filename}: ${summary}
`
      }
      const [summarizeResp] = await heavyBot.chat(
        prompts.renderSummarizeChangesets(inputs),
        {}
      )
      if (summarizeResp === '') {
        warning('summarize: nothing obtained from openai')
      } else {
        inputs.rawSummary = summarizeResp
      }
    }
  }

  return {summaries, skippedFiles}
}

async function analyzeFile(
  filename: string,
  fileContent: string,
  options: Options,
  scanners: {
    security: SecurityScanner
    performance: PerformanceAnalyzer
    complexity: ComplexityAnalyzer
  }
): Promise<{report: string; hasIssues: boolean}> {
  let fileReport = ''
  let hasIssues = false

  if (options.enableSecurityScanner) {
    const result = scanners.security.scanFile(fileContent, filename)
    if (result.issues.length > 0) {
      fileReport += scanners.security.generateReport(result)
      hasIssues = true
    }
  }

  if (options.enablePerformanceAnalyzer) {
    const result = scanners.performance.analyzeFile(fileContent, filename)
    if (result.issues.length > 0) {
      fileReport += `\n${scanners.performance.generateReport(result)}`
      hasIssues = true
    }
  }

  if (options.enableComplexityAnalyzer) {
    const result = await scanners.complexity.analyzeFile(filename, fileContent)
    if (result.issues.length > 0) {
      fileReport += `\n${scanners.complexity.formatReportAsMarkdown(
        result,
        filename
      )}`
      hasIssues = true
    }
  }

  return {report: fileReport, hasIssues}
}

async function runAnalyzers(
  options: Options,
  filesAndChanges: Array<
    [string, string, string, Array<[number, number, string]>]
  >
): Promise<string> {
  if (
    !options.enableSecurityScanner &&
    !options.enablePerformanceAnalyzer &&
    !options.enableComplexityAnalyzer
  ) {
    return ''
  }

  const scanners = {
    security: new SecurityScanner(),
    performance: new PerformanceAnalyzer(),
    complexity: new ComplexityAnalyzer()
  }

  let analyzerReport = '\n\n## 🔍 Automated Analysis Results\n\n'
  let hasAnyIssues = false

  for (const [filename, fileContent] of filesAndChanges) {
    const {report, hasIssues} = await analyzeFile(
      filename,
      fileContent,
      options,
      scanners
    )

    if (hasIssues) {
      analyzerReport += `### File: \`${filename}\`\n\n${report}\n`
      hasAnyIssues = true
    }
  }

  return hasAnyIssues
    ? analyzerReport
    : '\n\n## 🔍 Automated Analysis Results\n\n✅ No security, performance, or complexity issues detected.\n'
}

async function generateFinalSummaries(
  heavyBot: Bot,
  commenter: Commenter,
  inputs: Inputs,
  prompts: Prompts,
  options: Options
): Promise<string> {
  const [summarizeFinalResponse] = await heavyBot.chat(
    prompts.renderSummarize(inputs),
    {}
  )
  if (summarizeFinalResponse === '') {
    info('summarize: nothing obtained from openai')
  }

  if (options.disableReleaseNotes === false) {
    const [releaseNotesResponse] = await heavyBot.chat(
      prompts.renderSummarizeReleaseNotes(inputs),
      {}
    )
    if (releaseNotesResponse === '') {
      info('release notes: nothing obtained from openai')
    } else {
      const message = `### Summary by CodeReviewer\n\n${releaseNotesResponse}`
      try {
        if (context.payload.pull_request != null) {
          await commenter.updateDescription(
            context.payload.pull_request.number,
            message
          )
        }
      } catch (e: any) {
        warning(`release notes: error from github: ${e.message as string}`)
      }
    }
  }

  const [summarizeShortResponse] = await heavyBot.chat(
    prompts.renderSummarizeShort(inputs),
    {}
  )
  inputs.shortSummary = summarizeShortResponse

  let finalComment = `${summarizeFinalResponse}`

  // Append analyzer results if available
  if (inputs.analyzerResults) {
    finalComment += inputs.analyzerResults
  }

  return `${finalComment}
${RAW_SUMMARY_START_TAG}
${inputs.rawSummary}
${RAW_SUMMARY_END_TAG}
${SHORT_SUMMARY_START_TAG}
${inputs.shortSummary}
${SHORT_SUMMARY_END_TAG}
`
}

function appendSummaryStatus(
  statusMsg: string,
  skippedFiles: string[],
  summariesFailed: string[]
): string {
  const errors: string[] = []
  if (skippedFiles.length > 0) {
    errors.push(...skippedFiles)
  }
  if (summariesFailed.length > 0) {
    errors.push(...summariesFailed)
  }

  if (errors.length === 0) {
    return statusMsg
  }

  return `${statusMsg}

Note: Some files could not be processed:

${errors.map(file => `- ${file}`).join('\n')}
`
}

async function processReviews(
  heavyBot: Bot,
  commenter: Commenter,
  inputs: Inputs,
  prompts: Prompts,
  options: Options,
  filesAndChanges: Array<
    [string, string, string, Array<[number, number, string]>]
  >,
  reviewContext: {
    summaries: Array<[string, string, boolean]>
    openaiConcurrencyLimit: any
  }
): Promise<{
  reviewsFailed: string[]
  reviewsSkipped: string[]
  lgtmCount: number
  reviewCount: number
}> {
  const {summaries, openaiConcurrencyLimit} = reviewContext
  const filesAndChangesReview = filesAndChanges.filter(([filename]) => {
    const needsReview =
      summaries.find(
        ([summaryFilename]) => summaryFilename === filename
      )?.[2] ?? true
    return needsReview
  })

  const reviewsSkipped = filesAndChanges
    .filter(
      ([filename]) =>
        !filesAndChangesReview.some(
          ([reviewFilename]) => reviewFilename === filename
        )
    )
    .map(([filename]) => filename)

  const reviewsFailed: string[] = []
  let lgtmCount = 0
  let reviewCount = 0

  function calculatePatchesToPack(
    patches: Array<[number, number, string]>,
    baseTokens: number
  ): number {
    let tokens = baseTokens
    let patchesToPack = 0
    for (const [, , patch] of patches) {
      const patchTokens = getTokenCount(patch)
      if (tokens + patchTokens > options.heavyTokenLimits.requestTokens) {
        info(
          `only packing ${patchesToPack} / ${patches.length} patches, tokens: ${tokens} / ${options.heavyTokenLimits.requestTokens}`
        )
        break
      }
      tokens += patchTokens
      patchesToPack += 1
    }
    return patchesToPack
  }

  async function getCommentChainForPatch(
    pullNumber: number,
    filename: string,
    startLine: number,
    endLine: number
  ): Promise<string> {
    try {
      const allChains = await commenter.getCommentChainsWithinRange(
        pullNumber,
        filename,
        startLine,
        endLine,
        COMMENT_REPLY_TAG
      )

      if (allChains.length > 0) {
        info(`Found comment chains: ${allChains} for ${filename}`)
        return allChains
      }
    } catch (e: any) {
      warning(
        `Failed to get comments: ${e as string}, skipping. backtrace: ${
          e.stack as string
        }`
      )
    }
    return ''
  }

  async function packPatchesIntoInputs(
    ins: Inputs,
    patches: Array<[number, number, string]>,
    patchesToPack: number,
    baseTokens: number
  ): Promise<number> {
    let tokens = baseTokens
    let patchesPacked = 0

    if (context.payload.pull_request == null) {
      return 0
    }

    for (const [startLine, endLine, patch] of patches) {
      if (patchesPacked >= patchesToPack) {
        info(
          `unable to pack more patches into this request, packed: ${patchesPacked}, total patches: ${patches.length}, skipping.`
        )
        if (options.debug) {
          info(`prompt so far: ${prompts.renderReviewFileDiff(ins)}`)
        }
        break
      }
      patchesPacked += 1

      const commentChain = await getCommentChainForPatch(
        context.payload.pull_request.number,
        ins.filename,
        startLine,
        endLine
      )

      const commentChainTokens = getTokenCount(commentChain)
      if (
        tokens + commentChainTokens >
        options.heavyTokenLimits.requestTokens
      ) {
        // Skip comment chain if it exceeds token limit
      } else {
        tokens += commentChainTokens
      }

      ins.patches += `
${patch}
`
      if (commentChain !== '') {
        ins.patches += `
---comment_chains---
\`\`\`
${commentChain}
\`\`\`
`
      }

      ins.patches += `
---end_change_section---
`
    }

    return patchesPacked
  }

  async function processReviewResults(
    filename: string,
    reviews: Review[]
  ): Promise<void> {
    for (const review of reviews) {
      if (
        !options.reviewCommentLGTM &&
        (review.comment.includes('LGTM') ||
          review.comment.includes('looks good to me'))
      ) {
        lgtmCount += 1
        continue
      }
      if (context.payload.pull_request == null) {
        warning('No pull request found, skipping.')
        continue
      }

      try {
        reviewCount += 1
        await commenter.bufferReviewComment(
          filename,
          review.startLine,
          review.endLine,
          `${review.comment}`
        )
      } catch (e: any) {
        reviewsFailed.push(`${filename} comment failed (${e as string})`)
      }
    }
  }

  const doReview = async (
    filename: string,
    fileContent: string,
    patches: Array<[number, number, string]>
  ): Promise<void> => {
    info(`reviewing ${filename}`)
    const ins: Inputs = inputs.clone()
    ins.filename = filename

    const baseTokens = getTokenCount(prompts.renderReviewFileDiff(ins))
    const patchesToPack = calculatePatchesToPack(patches, baseTokens)
    const patchesPacked = await packPatchesIntoInputs(
      ins,
      patches,
      patchesToPack,
      baseTokens
    )

    if (patchesPacked > 0) {
      try {
        const [response] = await heavyBot.chat(
          prompts.renderReviewFileDiff(ins),
          {}
        )
        if (response === '') {
          info('review: nothing obtained from openai')
          reviewsFailed.push(`${filename} (no response)`)
          return
        }
        const reviews = parseReview(response, patches, options.debug)
        await processReviewResults(filename, reviews)
      } catch (e: any) {
        warning(
          `Failed to review: ${e as string}, skipping. backtrace: ${
            e.stack as string
          }`
        )
        reviewsFailed.push(`${filename} (${e as string})`)
      }
    } else {
      reviewsSkipped.push(`${filename} (diff too large)`)
    }
  }

  const reviewPromises = []
  for (const [filename, fileContent, , patches] of filesAndChangesReview) {
    if (options.maxFiles <= 0 || reviewPromises.length < options.maxFiles) {
      reviewPromises.push(
        openaiConcurrencyLimit(async () => {
          await doReview(filename, fileContent, patches)
        })
      )
    }
  }

  await Promise.all(reviewPromises)

  return {reviewsFailed, reviewsSkipped, lgtmCount, reviewCount}
}

function validateEventAndSetup(
  commenter: Commenter,
  inputs: Inputs,
  options: Options
): boolean {
  if (
    context.eventName !== 'pull_request' &&
    context.eventName !== 'pull_request_target'
  ) {
    warning(
      `Skipped: current event is ${context.eventName}, only support pull_request event`
    )
    return false
  }
  if (context.payload.pull_request == null) {
    warning('Skipped: context.payload.pull_request is null')
    return false
  }

  inputs.title = context.payload.pull_request.title
  if (context.payload.pull_request.body != null) {
    inputs.description = commenter.getDescription(
      context.payload.pull_request.body
    )
  }

  if (inputs.description.includes(ignoreKeyword)) {
    info('Skipped: description contains ignore_keyword')
    return false
  }

  inputs.systemMessage = options.systemMessage
  return true
}

async function fetchDiffsAndFilterFiles(
  highestReviewedCommitId: string,
  options: Options
): Promise<{
  files: any[]
  commits: any[]
  filterSelectedFiles: any[]
  filterIgnoredFiles: any[]
} | null> {
  if (context.payload.pull_request == null) {
    return null
  }

  const incrementalDiff = await octokit.repos.compareCommits({
    owner: repo.owner,
    repo: repo.repo,
    base: highestReviewedCommitId,
    head: context.payload.pull_request.head.sha
  })

  const targetBranchDiff = await octokit.repos.compareCommits({
    owner: repo.owner,
    repo: repo.repo,
    base: context.payload.pull_request.base.sha,
    head: context.payload.pull_request.head.sha
  })

  const incrementalFiles = incrementalDiff.data.files
  const targetBranchFiles = targetBranchDiff.data.files

  if (incrementalFiles == null || targetBranchFiles == null) {
    warning('Skipped: files data is missing')
    return null
  }

  const files = targetBranchFiles.filter(targetBranchFile =>
    incrementalFiles.some(
      incrementalFile => incrementalFile.filename === targetBranchFile.filename
    )
  )

  if (files.length === 0) {
    warning('Skipped: files is null')
    return null
  }

  const {selected: filterSelectedFiles, ignored: filterIgnoredFiles} =
    filterFilesByPath(files, options)

  if (filterSelectedFiles.length === 0) {
    warning('Skipped: filterSelectedFiles is null')
    return null
  }

  const commits = incrementalDiff.data.commits
  if (commits.length === 0) {
    warning('Skipped: commits is null')
    return null
  }

  return {files, commits, filterSelectedFiles, filterIgnoredFiles}
}

async function processFilesForReview(
  filterSelectedFiles: any[],
  githubConcurrencyLimit: any
): Promise<Array<[string, string, string, Array<[number, number, string]>]>> {
  async function retrieveFileContent(
    filename: string,
    baseSha: string
  ): Promise<string> {
    try {
      const contents = await octokit.repos.getContent({
        owner: repo.owner,
        repo: repo.repo,
        path: filename,
        ref: baseSha
      })
      if (contents.data != null && !Array.isArray(contents.data)) {
        if (contents.data.type === 'file' && contents.data.content != null) {
          return Buffer.from(contents.data.content, 'base64').toString()
        }
      }
    } catch (e: any) {
      warning(
        `Failed to get file contents: ${
          e as string
        }. This is OK if it's a new file.`
      )
    }
    return ''
  }

  function parsePatchesFromFile(file: {
    filename: string
    patch: string | null | undefined
  }): Array<[number, number, string]> {
    const patches: Array<[number, number, string]> = []
    for (const patch of splitPatch(file.patch)) {
      const patchLines = patchStartEndLine(patch)
      if (patchLines == null) {
        continue
      }
      const hunks = parsePatch(patch)
      if (hunks == null) {
        continue
      }
      const hunksStr = `
---new_hunk---
\`\`\`
${hunks.newHunk}
\`\`\`

---old_hunk---
\`\`\`
${hunks.oldHunk}
\`\`\`
`
      patches.push([
        patchLines.newHunk.startLine,
        patchLines.newHunk.endLine,
        hunksStr
      ])
    }
    return patches
  }

  async function processFileForReview(file: {
    filename: string
    patch: string | null | undefined
  }): Promise<
    [string, string, string, Array<[number, number, string]>] | null
  > {
    if (context.payload.pull_request == null) {
      warning('Skipped: context.payload.pull_request is null')
      return null
    }

    const fileContent = await retrieveFileContent(
      file.filename,
      context.payload.pull_request.base.sha
    )
    const fileDiff = file.patch ?? ''
    const patches = parsePatchesFromFile(file)

    if (patches.length > 0) {
      return [file.filename, fileContent, fileDiff, patches]
    }
    return null
  }

  const filteredFiles: Array<
    [string, string, string, Array<[number, number, string]>] | null
  > = await Promise.all(
    filterSelectedFiles.map(file =>
      githubConcurrencyLimit(async () => await processFileForReview(file))
    )
  )

  return filteredFiles.filter(
    (file): file is [string, string, string, Array<[number, number, string]>] =>
      file !== null
  )
}

function createStatusMessage(): string {
  return ''
}

function appendReviewStatus(
  statusMsg: string,
  reviewResult: {
    reviewsFailed: string[]
    reviewsSkipped: string[]
  }
): string {
  const reviewErrors: string[] = []
  if (reviewResult.reviewsFailed.length > 0) {
    reviewErrors.push(...reviewResult.reviewsFailed)
  }

  if (reviewErrors.length > 0 || reviewResult.reviewsSkipped.length > 0) {
    statusMsg += '\n\n'

    if (reviewErrors.length > 0) {
      statusMsg += `Some files could not be reviewed:\n\n${reviewErrors
        .map(file => `- ${file}`)
        .join('\n')}\n\n`
    }

    if (reviewResult.reviewsSkipped.length > 0) {
      statusMsg += `Some files were skipped (trivial changes):\n\n${reviewResult.reviewsSkipped
        .map(file => `- ${file}`)
        .join('\n')}\n\n`
    }
  }

  return statusMsg
}

async function finalizeReviewWithComment(
  commenter: Commenter,
  pullNumber: number,
  commitSha: string,
  statusMsg: string,
  summarizeComment: string,
  existingSummarizeCmtBody: string,
  headSha: string
): Promise<void> {
  const existingCommitIdsBlock = commenter.getReviewedCommitIdsBlock(
    existingSummarizeCmtBody
  )
  await commenter.submitReview(pullNumber, commitSha, statusMsg)

  const finalSummarizeComment = `${summarizeComment}\n${commenter.addReviewedCommitId(
    existingCommitIdsBlock,
    headSha
  )}`
  await commenter.comment(`${finalSummarizeComment}`, SUMMARIZE_TAG, 'replace')
}

export const codeReview = async (
  lightBot: Bot,
  heavyBot: Bot,
  options: Options,
  prompts: Prompts
): Promise<void> => {
  const commenter: Commenter = new Commenter()
  const openaiConcurrencyLimit = pLimit(options.openaiConcurrencyLimit)
  const githubConcurrencyLimit = pLimit(options.githubConcurrencyLimit)

  const inputs: Inputs = new Inputs()
  if (!validateEventAndSetup(commenter, inputs, options)) {
    return
  }

  if (context.payload.pull_request == null) {
    return
  }

  const existingSummarizeCmt = await commenter.findCommentWithTag(
    SUMMARIZE_TAG,
    context.payload.pull_request.number
  )
  let existingSummarizeCmtBody = ''
  if (existingSummarizeCmt != null) {
    existingSummarizeCmtBody = existingSummarizeCmt.body
    inputs.rawSummary = commenter.getRawSummary(existingSummarizeCmtBody)
    inputs.shortSummary = commenter.getShortSummary(existingSummarizeCmtBody)
  }

  const highestReviewedCommitId = await getHighestReviewedCommitId(commenter)
  const diffResult = await fetchDiffsAndFilterFiles(
    highestReviewedCommitId,
    options
  )
  if (diffResult == null) {
    return
  }

  const {commits, filterSelectedFiles} = diffResult

  const filesAndChanges = await processFilesForReview(
    filterSelectedFiles,
    githubConcurrencyLimit
  )

  if (filesAndChanges.length === 0) {
    error('Skipped: no files to review')
    return
  }

  let statusMsg = createStatusMessage()

  // update the existing comment with in progress status
  const inProgressSummarizeCmt = commenter.addInProgressStatus(
    existingSummarizeCmtBody,
    statusMsg
  )

  // add in progress status to the summarize comment
  await commenter.comment(`${inProgressSummarizeCmt}`, SUMMARIZE_TAG, 'replace')

  const summariesFailed: string[] = []
  const {summaries, skippedFiles} = await processSummaries(
    lightBot,
    heavyBot,
    inputs,
    prompts,
    options,
    filesAndChanges,
    {
      openaiConcurrencyLimit,
      summariesFailed
    }
  )

  // Run automated analyzers
  const analyzerResults = await runAnalyzers(options, filesAndChanges)
  if (analyzerResults) {
    inputs.analyzerResults = analyzerResults
  }

  const summarizeComment = await generateFinalSummaries(
    heavyBot,
    commenter,
    inputs,
    prompts,
    options
  )

  statusMsg = appendSummaryStatus(statusMsg, skippedFiles, summariesFailed)

  if (!options.disableReview && context.payload.pull_request != null) {
    const reviewResult = await processReviews(
      heavyBot,
      commenter,
      inputs,
      prompts,
      options,
      filesAndChanges,
      {
        summaries,
        openaiConcurrencyLimit
      }
    )

    statusMsg = appendReviewStatus(statusMsg, reviewResult)

    if (context.payload.pull_request != null && commits.length > 0) {
      await finalizeReviewWithComment(
        commenter,
        context.payload.pull_request.number,
        commits[commits.length - 1].sha,
        statusMsg,
        summarizeComment,
        existingSummarizeCmtBody,
        context.payload.pull_request.head.sha
      )
    }
  } else {
    // post the final summary comment
    await commenter.comment(`${summarizeComment}`, SUMMARIZE_TAG, 'replace')
  }
}

const splitPatch = (patch: string | null | undefined): string[] => {
  if (patch == null) {
    return []
  }

  const pattern = /(^@@ -(\d+),(\d+) \+(\d+),(\d+) @@).*$/gm

  const result: string[] = []
  let last = -1
  let match: RegExpExecArray | null
  while ((match = pattern.exec(patch)) !== null) {
    if (last === -1) {
      last = match.index
    } else {
      result.push(patch.substring(last, match.index))
      last = match.index
    }
  }
  if (last !== -1) {
    result.push(patch.substring(last))
  }
  return result
}

const patchStartEndLine = (
  patch: string
): {
  oldHunk: {startLine: number; endLine: number}
  newHunk: {startLine: number; endLine: number}
} | null => {
  const pattern = /(^@@ -(\d+),(\d+) \+(\d+),(\d+) @@)/gm
  const match = pattern.exec(patch)
  if (match != null) {
    const oldBegin = parseInt(match[2])
    const oldDiff = parseInt(match[3])
    const newBegin = parseInt(match[4])
    const newDiff = parseInt(match[5])
    return {
      oldHunk: {
        startLine: oldBegin,
        endLine: oldBegin + oldDiff - 1
      },
      newHunk: {
        startLine: newBegin,
        endLine: newBegin + newDiff - 1
      }
    }
  } else {
    return null
  }
}

const parsePatch = (
  patch: string
): {oldHunk: string; newHunk: string} | null => {
  const hunkInfo = patchStartEndLine(patch)
  if (hunkInfo == null) {
    return null
  }

  const oldHunkLines: string[] = []
  const newHunkLines: string[] = []

  let newLine = hunkInfo.newHunk.startLine

  const lines = patch.split('\n').slice(1) // Skip the @@ line

  // Remove the last line if it's empty
  if (lines[lines.length - 1] === '') {
    lines.pop()
  }

  // Skip annotations for the first 3 and last 3 lines
  const skipStart = 3
  const skipEnd = 3

  let currentLine = 0

  const removalOnly = !lines.some(line => line.startsWith('+'))

  for (const line of lines) {
    currentLine++
    if (line.startsWith('-')) {
      oldHunkLines.push(`${line.substring(1)}`)
    } else if (line.startsWith('+')) {
      newHunkLines.push(`${newLine}: ${line.substring(1)}`)
      newLine++
    } else {
      // context line
      oldHunkLines.push(`${line}`)
      if (
        removalOnly ||
        (currentLine > skipStart && currentLine <= lines.length - skipEnd)
      ) {
        newHunkLines.push(`${newLine}: ${line}`)
      } else {
        newHunkLines.push(`${line}`)
      }
      newLine++
    }
  }

  return {
    oldHunk: oldHunkLines.join('\n'),
    newHunk: newHunkLines.join('\n')
  }
}

interface Review {
  startLine: number
  endLine: number
  comment: string
}

function parseReview(
  response: string,
  patches: Array<[number, number, string]>,
  debug = false
): Review[] {
  const reviews: Review[] = []

  response = sanitizeResponse(response.trim())

  const lines = response.split('\n')
  const lineNumberRangeRegex = /(?:^|\s)(\d+)-(\d+):\s*$/
  const commentSeparator = '---'

  let currentStartLine: number | null = null
  let currentEndLine: number | null = null
  let currentComment = ''
  function findBestPatchMapping(
    reviewStartLine: number,
    reviewEndLine: number
  ): {
    withinPatch: boolean
    bestPatchStartLine: number
    bestPatchEndLine: number
  } {
    let withinPatch = false
    let bestPatchStartLine = -1
    let bestPatchEndLine = -1
    let maxIntersection = 0

    for (const [startLine, endLine] of patches) {
      const intersectionStart = Math.max(reviewStartLine, startLine)
      const intersectionEnd = Math.min(reviewEndLine, endLine)
      const intersectionLength = Math.max(
        0,
        intersectionEnd - intersectionStart + 1
      )

      if (intersectionLength > maxIntersection) {
        maxIntersection = intersectionLength
        bestPatchStartLine = startLine
        bestPatchEndLine = endLine
        withinPatch = intersectionLength === reviewEndLine - reviewStartLine + 1
      }

      if (withinPatch) break
    }

    return {withinPatch, bestPatchStartLine, bestPatchEndLine}
  }

  function mapReviewToPatch(review: Review): void {
    const {withinPatch, bestPatchStartLine, bestPatchEndLine} =
      findBestPatchMapping(review.startLine, review.endLine)

    if (!withinPatch) {
      if (bestPatchStartLine !== -1 && bestPatchEndLine !== -1) {
        review.comment = `> Note: This review was outside of the patch, so it was mapped to the patch with the greatest overlap. Original lines [${review.startLine}-${review.endLine}]

${review.comment}`
        review.startLine = bestPatchStartLine
        review.endLine = bestPatchEndLine
      } else {
        review.comment = `> Note: This review was outside of the patch, but no patch was found that overlapped with it. Original lines [${review.startLine}-${review.endLine}]

${review.comment}`
        review.startLine = patches[0][0]
        review.endLine = patches[0][1]
      }
    }
  }

  function storeReview(): void {
    if (currentStartLine !== null && currentEndLine !== null) {
      const review: Review = {
        startLine: currentStartLine,
        endLine: currentEndLine,
        comment: currentComment
      }

      mapReviewToPatch(review)
      reviews.push(review)

      info(
        `Stored comment for line range ${currentStartLine}-${currentEndLine}: ${currentComment.trim()}`
      )
    }
  }

  function sanitizeCodeBlock(comment: string, codeBlockLabel: string): string {
    const codeBlockStart = `\`\`\`${codeBlockLabel}`
    const codeBlockEnd = '```'
    const lineNumberRegex = /^ *(\d+): /gm

    let codeBlockStartIndex = comment.indexOf(codeBlockStart)

    while (codeBlockStartIndex !== -1) {
      const codeBlockEndIndex = comment.indexOf(
        codeBlockEnd,
        codeBlockStartIndex + codeBlockStart.length
      )

      if (codeBlockEndIndex === -1) break

      const codeBlock = comment.substring(
        codeBlockStartIndex + codeBlockStart.length,
        codeBlockEndIndex
      )
      const sanitizedBlock = codeBlock.replace(lineNumberRegex, '')

      comment =
        comment.slice(0, codeBlockStartIndex + codeBlockStart.length) +
        sanitizedBlock +
        comment.slice(codeBlockEndIndex)

      codeBlockStartIndex = comment.indexOf(
        codeBlockStart,
        codeBlockStartIndex +
          codeBlockStart.length +
          sanitizedBlock.length +
          codeBlockEnd.length
      )
    }

    return comment
  }

  function sanitizeResponse(comment: string): string {
    comment = sanitizeCodeBlock(comment, 'suggestion')
    comment = sanitizeCodeBlock(comment, 'diff')
    return comment
  }

  for (const line of lines) {
    const lineNumberRangeMatch = lineNumberRangeRegex.exec(line)

    if (lineNumberRangeMatch != null) {
      storeReview()
      currentStartLine = parseInt(lineNumberRangeMatch[1], 10)
      currentEndLine = parseInt(lineNumberRangeMatch[2], 10)
      currentComment = ''
      if (debug) {
        info(`Found line number range: ${currentStartLine}-${currentEndLine}`)
      }
      continue
    }

    if (line.trim() === commentSeparator) {
      storeReview()
      currentStartLine = null
      currentEndLine = null
      currentComment = ''
      if (debug) {
        info('Found comment separator')
      }
      continue
    }

    if (currentStartLine !== null && currentEndLine !== null) {
      currentComment += `${line}\n`
    }
  }

  storeReview()

  return reviews
}
