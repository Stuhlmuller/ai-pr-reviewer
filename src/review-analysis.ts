import {info, warning} from '@actions/core'
import {context as github_context} from '@actions/github'
import {type Bot} from './bot'
import {type GithubPullRequestFile} from './github-types'
import {
  Commenter,
  RAW_SUMMARY_END_TAG,
  RAW_SUMMARY_START_TAG,
  SHORT_SUMMARY_END_TAG,
  SHORT_SUMMARY_START_TAG
} from './commenter'
import {ComplexityAnalyzer} from './complexity-analyzer'
import {type Inputs} from './inputs'
import {type Options} from './options'
import {PerformanceAnalyzer} from './performance-analyzer'
import {type Prompts} from './prompts'
import {type FileChange} from './review-types'
import {SecurityScanner} from './security-scanner'
import {bodyIncludesIgnoreKeyword, RELEASE_NOTES_TITLE} from './brand'
import {createSkipAnalyzer, type SkipConfig} from './skip-logic'

const context = github_context

export function bodyShouldBeIgnored(description: string): boolean {
  return bodyIncludesIgnoreKeyword(description)
}

export function applySmartSkipping(
  files: GithubPullRequestFile[],
  options: Options
): {
  selected: GithubPullRequestFile[]
  skipped: GithubPullRequestFile[]
  skipReasons: Map<string, string>
} {
  const skipConfig: SkipConfig = {
    skipGeneratedFiles: options.smartReviewSkipGenerated,
    skipTrivialChanges: options.smartReviewSkipTrivial,
    skipBuildArtifacts: options.smartReviewSkipBuildArtifacts,
    skipLockfiles: options.smartReviewSkipGenerated,
    skipVendorCode: options.smartReviewSkipVendor,
    skipTestSnapshots: options.smartReviewSkipSnapshots,
    customSkipPatterns: options.smartReviewCustomPatterns,
    minChangedLinesForReview: options.smartReviewMinLines
  }

  const skipAnalyzer = createSkipAnalyzer(skipConfig)
  const selected: GithubPullRequestFile[] = []
  const skipped: GithubPullRequestFile[] = []
  const skipReasons = new Map<string, string>()

  for (const file of files) {
    const evaluation = skipAnalyzer.evaluateFile(
      file.filename,
      file.patch ?? ''
    )

    if (!evaluation.shouldSkip) {
      selected.push(file)
      continue
    }

    skipAnalyzer.logSkip(file.filename, evaluation)
    skipped.push(file)
    skipReasons.set(
      file.filename,
      `${evaluation.reason} (${(evaluation.confidence * 100).toFixed(
        0
      )}% confidence)`
    )
  }

  return {selected, skipped, skipReasons}
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

export async function runAnalyzers(
  options: Options,
  filesAndChanges: FileChange[]
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

    if (!hasIssues) {
      continue
    }

    analyzerReport += `### File: \`${filename}\`\n\n${report}\n`
    hasAnyIssues = true
  }

  if (!hasAnyIssues) {
    return '\n\n## 🔍 Automated Analysis Results\n\n✅ No security, performance, or complexity issues detected.\n'
  }

  return analyzerReport
}

async function maybeUpdateReleaseNotes(
  heavyBot: Bot,
  commenter: Commenter,
  inputs: Inputs,
  prompts: Prompts,
  options: Options
): Promise<void> {
  if (options.disableReleaseNotes) {
    return
  }

  const [releaseNotesResponse] = await heavyBot.chat(
    prompts.renderSummarizeReleaseNotes(inputs),
    {}
  )
  if (releaseNotesResponse === '') {
    info('release notes: nothing obtained from openai')
    return
  }

  const pullRequest = context.payload.pull_request
  if (pullRequest == null) {
    return
  }

  const message = `${RELEASE_NOTES_TITLE}\n\n${releaseNotesResponse}`
  try {
    await commenter.updateDescription(pullRequest.number, message)
  } catch (error) {
    warning(
      `release notes: error from github: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

function buildFinalSummaryComment(
  summarizeFinalResponse: string,
  inputs: Inputs
): string {
  const analyzerResults = inputs.analyzerResults ?? ''
  return `${summarizeFinalResponse}${analyzerResults}
${RAW_SUMMARY_START_TAG}
${inputs.rawSummary}
${RAW_SUMMARY_END_TAG}
${SHORT_SUMMARY_START_TAG}
${inputs.shortSummary}
${SHORT_SUMMARY_END_TAG}
`
}

export async function generateFinalSummaries(
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

  await maybeUpdateReleaseNotes(heavyBot, commenter, inputs, prompts, options)

  const [summarizeShortResponse] = await heavyBot.chat(
    prompts.renderSummarizeShort(inputs),
    {}
  )
  inputs.shortSummary = summarizeShortResponse

  return buildFinalSummaryComment(summarizeFinalResponse, inputs)
}
