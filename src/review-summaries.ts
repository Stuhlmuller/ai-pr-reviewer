import {info, warning} from '@actions/core'
import {getTokenCount} from './tokenizer'
import {type Summary, type SummaryProcessorArgs} from './review-types'

interface SummarizeFileArgs {
  filename: string
  fileContent: string
  fileDiff: string
  context: SummaryProcessorArgs
}

function recordSummaryFailure(
  summariesFailed: string[],
  filename: string,
  reason: string
): null {
  summariesFailed.push(`${filename} (${reason})`)
  return null
}

function parseSummaryResponse(
  summarizeResp: string,
  filename: string,
  reviewSimpleChanges: boolean
): Summary {
  if (reviewSimpleChanges) {
    return [filename, summarizeResp, true]
  }

  const triageRegex = /\[TRIAGE\]:\s*(NEEDS_REVIEW|APPROVED)/
  const triageMatch = triageRegex.exec(summarizeResp)

  if (triageMatch == null) {
    return [filename, summarizeResp, true]
  }

  const triage = triageMatch[1]
  const needsReview = triage === 'NEEDS_REVIEW'
  const summary = summarizeResp.replace(triageRegex, '').trim()
  info(`filename: ${filename}, triage: ${triage}`)
  return [filename, summary, needsReview]
}

async function summarizeFile({
  filename,
  fileContent,
  fileDiff,
  context
}: SummarizeFileArgs): Promise<Summary | null> {
  info(`summarize: ${filename}`)
  if (fileDiff.length === 0) {
    warning(`summarize: file_diff is empty, skip ${filename}`)
    return recordSummaryFailure(context.summariesFailed, filename, 'empty diff')
  }

  const ins = context.inputs.clone()
  ins.filename = filename
  ins.fileDiff = fileDiff

  const summarizePrompt = context.prompts.renderSummarizeFileDiffWithContext(
    ins,
    context.options.reviewSimpleChanges,
    fileContent
  )
  const tokens = getTokenCount(summarizePrompt)

  if (tokens > context.options.lightTokenLimits.requestTokens) {
    info(`summarize: diff tokens exceeds limit, skip ${filename}`)
    return recordSummaryFailure(
      context.summariesFailed,
      filename,
      'diff tokens exceeds limit'
    )
  }

  try {
    const [summarizeResp] = await context.lightBot.chat(summarizePrompt, {})
    if (summarizeResp === '') {
      info('summarize: nothing obtained from openai')
      return recordSummaryFailure(
        context.summariesFailed,
        filename,
        'nothing obtained from openai'
      )
    }

    return parseSummaryResponse(
      summarizeResp,
      filename,
      context.options.reviewSimpleChanges
    )
  } catch (error) {
    warning(`summarize: error from openai: ${String(error)}`)
    return recordSummaryFailure(
      context.summariesFailed,
      filename,
      `error from openai: ${String(error)}`
    )
  }
}

function buildSummaryPromises(context: SummaryProcessorArgs): {
  summaryPromises: Array<Promise<Summary | null>>
  skippedFiles: string[]
} {
  const summaryPromises: Array<Promise<Summary | null>> = []
  const skippedFiles: string[] = []

  for (const [filename, fileContent, fileDiff] of context.filesAndChanges) {
    const withinMaxFiles =
      context.options.maxFiles <= 0 ||
      summaryPromises.length < context.options.maxFiles

    if (!withinMaxFiles) {
      skippedFiles.push(filename)
      continue
    }

    summaryPromises.push(
      context.openaiConcurrencyLimit(
        async () =>
          await summarizeFile({
            filename,
            fileContent,
            fileDiff,
            context
          })
      )
    )
  }

  return {summaryPromises, skippedFiles}
}

async function updateRawSummary(
  context: SummaryProcessorArgs,
  summaries: Summary[]
): Promise<void> {
  if (summaries.length === 0) {
    return
  }

  const batchSize = 10
  for (let i = 0; i < summaries.length; i += batchSize) {
    const summariesBatch = summaries.slice(i, i + batchSize)
    for (const [filename, summary] of summariesBatch) {
      context.inputs.rawSummary += `---
${filename}: ${summary}
`
    }

    const [summarizeResp] = await context.heavyBot.chat(
      context.prompts.renderSummarizeChangesets(context.inputs),
      {}
    )

    if (summarizeResp === '') {
      warning('summarize: nothing obtained from openai')
      continue
    }

    context.inputs.rawSummary = summarizeResp
  }
}

export async function processSummaries(
  context: SummaryProcessorArgs
): Promise<{summaries: Summary[]; skippedFiles: string[]}> {
  const {summaryPromises, skippedFiles} = buildSummaryPromises(context)
  const summaries = (await Promise.all(summaryPromises)).filter(
    (summary): summary is Summary => summary !== null
  )

  await updateRawSummary(context, summaries)

  return {summaries, skippedFiles}
}
