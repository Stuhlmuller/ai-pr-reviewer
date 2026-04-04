import {error, info, warning} from '@actions/core'
// eslint-disable-next-line camelcase
import {context as github_context} from '@actions/github'
import pLimit from 'p-limit'
import {type Bot} from './bot'
import {Commenter, SUMMARIZE_TAG} from './commenter'
import {
  applySmartSkipping,
  bodyShouldBeIgnored,
  generateFinalSummaries,
  runAnalyzers
} from './review-analysis'
import {fetchDiffsAndFilterFiles, processFilesForReview} from './review-files'
import {processReviews} from './review-reviews'
import {Inputs} from './inputs'
import {type Options} from './options'
import {type Prompts} from './prompts'
import {processSummaries} from './review-summaries'
import {
  createReviewState,
  deserializeState,
  getProgressSummary,
  isSameReview,
  serializeState,
  type ReviewState
} from './review-state'
import {type FileChange, type Summary} from './review-types'

// eslint-disable-next-line camelcase
const context = github_context

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

  if (bodyShouldBeIgnored(inputs.description)) {
    info('Skipped: description contains ignore_keyword')
    return false
  }

  inputs.systemMessage = options.systemMessage
  return true
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

/**
 * Loads review state from existing PR comment
 * Returns null if no state exists or if state is for a different review
 */
async function loadReviewState(
  commenter: Commenter,
  pullNumber: number,
  currentCommitId: string,
  files: Array<{filename: string}>
): Promise<ReviewState | null> {
  const existingComment = await commenter.findCommentWithTag(
    SUMMARIZE_TAG,
    pullNumber
  )

  if (existingComment == null) {
    return null
  }

  const stateJson = commenter.getReviewState(existingComment.body)
  if (stateJson == null) {
    return null
  }

  const state = deserializeState(stateJson)
  if (state == null) {
    info('Failed to deserialize review state, starting fresh')
    return null
  }

  // Create a temporary state for the current review to compare
  const currentState = createReviewState(currentCommitId, files)

  // Check if the stored state is for the same review
  if (!isSameReview(state, currentState)) {
    info('Stored state is for a different review, starting fresh')
    return null
  }

  info(
    `Loaded existing review state: ${state.completedFiles}/${state.totalFiles} files completed`
  )
  return state
}

async function finalizeReviewWithComment(args: {
  commenter: Commenter
  pullNumber: number
  commitSha: string
  statusMsg: string
  summarizeComment: string
  existingSummarizeCmtBody: string
  headSha: string
}): Promise<void> {
  const existingCommitIdsBlock = args.commenter.getReviewedCommitIdsBlock(
    args.existingSummarizeCmtBody
  )
  await args.commenter.submitReview(
    args.pullNumber,
    args.commitSha,
    args.statusMsg
  )

  const finalSummarizeComment = `${args.summarizeComment}\n${args.commenter.addReviewedCommitId(
    existingCommitIdsBlock,
    args.headSha
  )}`
  await args.commenter.comment(
    `${finalSummarizeComment}`,
    SUMMARIZE_TAG,
    'replace'
  )
}

async function loadExistingSummaryComment(
  commenter: Commenter,
  pullNumber: number,
  inputs: Inputs
): Promise<string> {
  const existingSummarizeCmt = await commenter.findCommentWithTag(
    SUMMARIZE_TAG,
    pullNumber
  )

  if (existingSummarizeCmt == null) {
    return ''
  }

  const existingSummarizeCmtBody = existingSummarizeCmt.body
  inputs.rawSummary = commenter.getRawSummary(existingSummarizeCmtBody)
  inputs.shortSummary = commenter.getShortSummary(existingSummarizeCmtBody)
  return existingSummarizeCmtBody
}

function logSmartSkipping(
  smartSkippedFiles: any[],
  skipReasons: Map<string, string>
): void {
  info(`Smart skipping: ${smartSkippedFiles.length} files skipped`)
  if (smartSkippedFiles.length === 0) {
    return
  }

  info('Skipped files:')
  for (const file of smartSkippedFiles) {
    const reason = skipReasons.get(file.filename) || 'unknown reason'
    info(`  - ${file.filename}: ${reason}`)
  }
}

async function prepareFilesForReview(
  commenter: Commenter,
  options: Options,
  githubConcurrencyLimit: ReturnType<typeof pLimit>
): Promise<{commits: any[]; filesAndChanges: FileChange[]} | null> {
  const highestReviewedCommitId = await getHighestReviewedCommitId(commenter)
  const diffResult = await fetchDiffsAndFilterFiles(
    highestReviewedCommitId,
    options
  )
  if (diffResult == null) {
    return null
  }

  const {commits, filterSelectedFiles} = diffResult
  const {
    selected: smartSelectedFiles,
    skipped: smartSkippedFiles,
    skipReasons
  } = applySmartSkipping(filterSelectedFiles, options)

  info(
    `Smart skipping: ${smartSkippedFiles.length} files skipped, ${smartSelectedFiles.length} files selected for review`
  )
  logSmartSkipping(smartSkippedFiles, skipReasons)

  const filesAndChanges = await processFilesForReview(
    smartSelectedFiles,
    githubConcurrencyLimit
  )
  if (filesAndChanges.length === 0) {
    error('Skipped: no files to review')
    return null
  }

  return {commits, filesAndChanges}
}

async function initializeReviewStateForFiles(
  commenter: Commenter,
  pullNumber: number,
  currentCommitId: string,
  filesAndChanges: FileChange[]
): Promise<ReviewState> {
  const filesToReview = filesAndChanges.map(([filename]) => ({filename}))
  const reviewState = await loadReviewState(
    commenter,
    pullNumber,
    currentCommitId,
    filesToReview
  )

  if (reviewState != null) {
    info(
      `Resumed review state: ${reviewState.completedFiles}/${reviewState.totalFiles} files completed`
    )
    return reviewState
  }

  info(`Created new review state for ${filesToReview.length} files`)
  return createReviewState(currentCommitId, filesToReview)
}

async function publishInProgressComment(
  commenter: Commenter,
  existingSummarizeCmtBody: string,
  reviewState: ReviewState,
  statusMsg: string
): Promise<void> {
  const inProgressSummarizeCmt = commenter.addInProgressStatus(
    existingSummarizeCmtBody,
    statusMsg
  )
  const commentWithState = commenter.setReviewState(
    inProgressSummarizeCmt,
    serializeState(reviewState)
  )

  await commenter.comment(commentWithState, SUMMARIZE_TAG, 'replace')
}

async function summarizeReviewRun(args: {
  lightBot: Bot
  heavyBot: Bot
  commenter: Commenter
  inputs: Inputs
  prompts: Prompts
  options: Options
  filesAndChanges: FileChange[]
  openaiConcurrencyLimit: ReturnType<typeof pLimit>
  statusMsg: string
}): Promise<{
  statusMsg: string
  summaries: Summary[]
  summarizeComment: string
}> {
  const summariesFailed: string[] = []
  const {summaries, skippedFiles} = await processSummaries({
    lightBot: args.lightBot,
    heavyBot: args.heavyBot,
    inputs: args.inputs,
    prompts: args.prompts,
    options: args.options,
    filesAndChanges: args.filesAndChanges,
    openaiConcurrencyLimit: args.openaiConcurrencyLimit,
    summariesFailed
  })

  const analyzerResults = await runAnalyzers(args.options, args.filesAndChanges)
  if (analyzerResults !== '') {
    args.inputs.analyzerResults = analyzerResults
  }

  const summarizeComment = await generateFinalSummaries(
    args.heavyBot,
    args.commenter,
    args.inputs,
    args.prompts,
    args.options
  )

  return {
    statusMsg: appendSummaryStatus(
      args.statusMsg,
      skippedFiles,
      summariesFailed
    ),
    summaries,
    summarizeComment
  }
}

async function finalizeReviewRun(args: {
  heavyBot: Bot
  commenter: Commenter
  inputs: Inputs
  prompts: Prompts
  options: Options
  filesAndChanges: FileChange[]
  openaiConcurrencyLimit: ReturnType<typeof pLimit>
  statusMsg: string
  summaries: Summary[]
  summarizeComment: string
  commits: any[]
  pullNumber: number
  existingSummarizeCmtBody: string
  headSha: string
}): Promise<void> {
  if (args.options.disableReview) {
    await args.commenter.comment(
      `${args.summarizeComment}`,
      SUMMARIZE_TAG,
      'replace'
    )
    return
  }

  const reviewResult = await processReviews({
    heavyBot: args.heavyBot,
    commenter: args.commenter,
    inputs: args.inputs,
    prompts: args.prompts,
    options: args.options,
    filesAndChanges: args.filesAndChanges,
    summaries: args.summaries,
    openaiConcurrencyLimit: args.openaiConcurrencyLimit
  })
  const statusMsg = appendReviewStatus(args.statusMsg, reviewResult)

  if (args.commits.length === 0) {
    return
  }

  await finalizeReviewWithComment({
    commenter: args.commenter,
    pullNumber: args.pullNumber,
    commitSha: args.commits[args.commits.length - 1].sha,
    statusMsg,
    summarizeComment: args.summarizeComment,
    existingSummarizeCmtBody: args.existingSummarizeCmtBody,
    headSha: args.headSha
  })
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

  const pullRequest = context.payload.pull_request
  if (pullRequest == null) {
    return
  }

  const existingSummarizeCmtBody = await loadExistingSummaryComment(
    commenter,
    pullRequest.number,
    inputs
  )
  const preparedFiles = await prepareFilesForReview(
    commenter,
    options,
    githubConcurrencyLimit
  )
  if (preparedFiles == null) {
    return
  }

  const {commits, filesAndChanges} = preparedFiles
  const reviewState = await initializeReviewStateForFiles(
    commenter,
    pullRequest.number,
    pullRequest.head.sha,
    filesAndChanges
  )

  let statusMsg = createStatusMessage()
  statusMsg = `${statusMsg}\n\n📊 ${getProgressSummary(reviewState)}`

  await publishInProgressComment(
    commenter,
    existingSummarizeCmtBody,
    reviewState,
    statusMsg
  )

  const summaryResult = await summarizeReviewRun({
    lightBot,
    heavyBot,
    commenter,
    inputs,
    prompts,
    options,
    filesAndChanges,
    openaiConcurrencyLimit,
    statusMsg
  })

  await finalizeReviewRun({
    heavyBot,
    commenter,
    inputs,
    prompts,
    options,
    filesAndChanges,
    openaiConcurrencyLimit,
    statusMsg: summaryResult.statusMsg,
    summaries: summaryResult.summaries,
    summarizeComment: summaryResult.summarizeComment,
    commits,
    pullNumber: pullRequest.number,
    existingSummarizeCmtBody,
    headSha: pullRequest.head.sha
  })
}
