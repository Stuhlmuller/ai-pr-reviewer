import {info, warning} from '@actions/core'
// eslint-disable-next-line camelcase
import {context as github_context} from '@actions/github'
import {COMMENT_REPLY_TAG} from './commenter'
import {type Inputs} from './inputs'
import {parseReview} from './review-parsing'
import {
  type FileChange,
  type ReviewComment,
  type ReviewPatch,
  type ReviewProcessResult,
  type ReviewProcessorArgs
} from './review-types'
import {getTokenCount} from './tokenizer'

// eslint-disable-next-line camelcase
const context = github_context

interface ReviewSelection {
  filesAndChangesReview: FileChange[]
  reviewsSkipped: string[]
}

interface ReviewCounter {
  lgtmCount: number
  reviewCount: number
}

interface ReviewFileArgs {
  args: ReviewProcessorArgs
  filename: string
  fileContent: string
  patches: ReviewPatch[]
  counter: ReviewCounter
  reviewsFailed: string[]
  reviewsSkipped: string[]
}

function createReviewCounter(): ReviewCounter {
  return {
    lgtmCount: 0,
    reviewCount: 0
  }
}

function getPullNumber(): number | null {
  return context.payload.pull_request?.number ?? null
}

function selectFilesForReview(
  filesAndChanges: FileChange[],
  summaries: ReviewProcessorArgs['summaries']
): ReviewSelection {
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

  return {filesAndChangesReview, reviewsSkipped}
}

function calculatePatchesToPack(
  patches: ReviewPatch[],
  requestTokenLimit: number,
  baseTokens: number
): number {
  let tokens = baseTokens
  let patchesToPack = 0

  for (const [, , patch] of patches) {
    const patchTokens = getTokenCount(patch)
    if (tokens + patchTokens > requestTokenLimit) {
      info(
        `only packing ${patchesToPack} / ${patches.length} patches, tokens: ${tokens} / ${requestTokenLimit}`
      )
      break
    }

    tokens += patchTokens
    patchesToPack += 1
  }

  return patchesToPack
}

async function getCommentChainForPatch(
  commenter: ReviewProcessorArgs['commenter'],
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
    }

    return allChains
  } catch (error) {
    warning(
      `Failed to get comments: ${String(error)}, skipping. backtrace: ${
        error instanceof Error ? (error.stack ?? '') : ''
      }`
    )
    return ''
  }
}

function appendPatchBlock(
  ins: Inputs,
  patch: string,
  commentChain: string
): void {
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

async function packPatchesIntoInputs(
  args: ReviewProcessorArgs,
  ins: Inputs,
  patches: ReviewPatch[],
  patchesToPack: number,
  baseTokens: number
): Promise<number> {
  const pullNumber = getPullNumber()
  if (pullNumber == null) {
    return 0
  }

  let tokens = baseTokens
  let patchesPacked = 0

  for (const [startLine, endLine, patch] of patches) {
    if (patchesPacked >= patchesToPack) {
      info(
        `unable to pack more patches into this request, packed: ${patchesPacked}, total patches: ${patches.length}, skipping.`
      )
      if (args.options.debug) {
        info(`prompt so far: ${args.prompts.renderReviewFileDiff(ins)}`)
      }
      break
    }

    patchesPacked += 1
    const commentChain = await getCommentChainForPatch(
      args.commenter,
      pullNumber,
      ins.filename,
      startLine,
      endLine
    )
    const commentChainTokens = getTokenCount(commentChain)

    if (
      tokens + commentChainTokens <=
      args.options.heavyTokenLimits.requestTokens
    ) {
      tokens += commentChainTokens
    }

    appendPatchBlock(ins, patch, commentChain)
  }

  return patchesPacked
}

function shouldSkipLgtmComment(
  args: ReviewProcessorArgs,
  review: ReviewComment
): boolean {
  return (
    !args.options.reviewCommentLGTM &&
    (review.comment.includes('LGTM') ||
      review.comment.includes('looks good to me'))
  )
}

async function bufferReviews(
  args: ReviewProcessorArgs,
  filename: string,
  reviews: ReviewComment[],
  counter: ReviewCounter,
  reviewsFailed: string[]
): Promise<void> {
  if (getPullNumber() == null) {
    warning('No pull request found, skipping.')
    return
  }

  for (const review of reviews) {
    if (shouldSkipLgtmComment(args, review)) {
      counter.lgtmCount += 1
      continue
    }

    try {
      counter.reviewCount += 1
      await args.commenter.bufferReviewComment(
        filename,
        review.startLine,
        review.endLine,
        review.comment
      )
    } catch (error) {
      reviewsFailed.push(`${filename} comment failed (${String(error)})`)
    }
  }
}

async function reviewFile(reviewFileArgs: ReviewFileArgs): Promise<void> {
  const {
    args,
    filename,
    fileContent,
    patches,
    counter,
    reviewsFailed,
    reviewsSkipped
  } = reviewFileArgs
  info(`reviewing ${filename}`)
  const ins = args.inputs.clone()
  ins.filename = filename

  const baseTokens = getTokenCount(
    args.prompts.renderReviewFileDiff(ins, fileContent)
  )
  const patchesToPack = calculatePatchesToPack(
    patches,
    args.options.heavyTokenLimits.requestTokens,
    baseTokens
  )
  const patchesPacked = await packPatchesIntoInputs(
    args,
    ins,
    patches,
    patchesToPack,
    baseTokens
  )

  if (patchesPacked === 0) {
    reviewsSkipped.push(`${filename} (diff too large)`)
    return
  }

  try {
    const [response] = await args.heavyBot.chat(
      args.prompts.renderReviewFileDiff(ins, fileContent),
      {}
    )

    if (response === '') {
      info('review: nothing obtained from openai')
      reviewsFailed.push(`${filename} (no response)`)
      return
    }

    const reviews = parseReview(response, patches, args.options.debug)
    await bufferReviews(args, filename, reviews, counter, reviewsFailed)
  } catch (error) {
    warning(
      `Failed to review: ${String(error)}, skipping. backtrace: ${
        error instanceof Error ? (error.stack ?? '') : ''
      }`
    )
    reviewsFailed.push(`${filename} (${String(error)})`)
  }
}

function mergeReviewResults(
  counter: ReviewCounter,
  reviewsFailed: string[],
  reviewsSkipped: string[]
): ReviewProcessResult {
  return {
    reviewsFailed,
    reviewsSkipped,
    lgtmCount: counter.lgtmCount,
    reviewCount: counter.reviewCount
  }
}

export async function processReviews(
  args: ReviewProcessorArgs
): Promise<ReviewProcessResult> {
  const {filesAndChangesReview, reviewsSkipped} = selectFilesForReview(
    args.filesAndChanges,
    args.summaries
  )
  const reviewsFailed: string[] = []
  const counter = createReviewCounter()

  const reviewPromises = filesAndChangesReview
    .slice(0, args.options.maxFiles > 0 ? args.options.maxFiles : undefined)
    .map(([filename, fileContent, , patches]) =>
      args.openaiConcurrencyLimit(
        async () =>
          await reviewFile({
            args,
            filename,
            fileContent,
            patches,
            counter,
            reviewsFailed,
            reviewsSkipped
          })
      )
    )

  await Promise.all(reviewPromises)

  return mergeReviewResults(counter, reviewsFailed, reviewsSkipped)
}
