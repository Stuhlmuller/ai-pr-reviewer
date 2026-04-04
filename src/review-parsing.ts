import {info} from '@actions/core'
import {type ReviewComment, type ReviewPatch} from './review-types'

const COMMENT_SEPARATOR = '---'
const LINE_NUMBER_RANGE_REGEX = /(?:^|\s)(\d+)-(\d+):\s*$/

interface PendingReview {
  startLine: number | null
  endLine: number | null
  comment: string
}

function createEmptyPendingReview(): PendingReview {
  return {
    startLine: null,
    endLine: null,
    comment: ''
  }
}

function sanitizeCodeBlock(comment: string, codeBlockLabel: string): string {
  const codeBlockStart = `\`\`\`${codeBlockLabel}`
  const codeBlockEnd = '```'
  const lineNumberRegex = /^ *(\d+): /gm

  let sanitizedComment = comment
  let codeBlockStartIndex = sanitizedComment.indexOf(codeBlockStart)

  while (codeBlockStartIndex !== -1) {
    const codeBlockEndIndex = sanitizedComment.indexOf(
      codeBlockEnd,
      codeBlockStartIndex + codeBlockStart.length
    )

    if (codeBlockEndIndex === -1) {
      break
    }

    const codeBlock = sanitizedComment.substring(
      codeBlockStartIndex + codeBlockStart.length,
      codeBlockEndIndex
    )
    const sanitizedBlock = codeBlock.replace(lineNumberRegex, '')

    sanitizedComment =
      sanitizedComment.slice(0, codeBlockStartIndex + codeBlockStart.length) +
      sanitizedBlock +
      sanitizedComment.slice(codeBlockEndIndex)

    codeBlockStartIndex = sanitizedComment.indexOf(
      codeBlockStart,
      codeBlockStartIndex +
        codeBlockStart.length +
        sanitizedBlock.length +
        codeBlockEnd.length
    )
  }

  return sanitizedComment
}

function sanitizeResponse(comment: string): string {
  const withoutSuggestionLineNumbers = sanitizeCodeBlock(comment, 'suggestion')
  return sanitizeCodeBlock(withoutSuggestionLineNumbers, 'diff')
}

function getPatchMapping(
  reviewStartLine: number,
  reviewEndLine: number,
  patches: ReviewPatch[]
): {
  withinPatch: boolean
  bestPatchStartLine: number
  bestPatchEndLine: number
} {
  let bestMapping = {
    withinPatch: false,
    bestPatchStartLine: -1,
    bestPatchEndLine: -1
  }
  let maxIntersection = 0

  for (const [startLine, endLine] of patches) {
    const intersectionStart = Math.max(reviewStartLine, startLine)
    const intersectionEnd = Math.min(reviewEndLine, endLine)
    const intersectionLength = Math.max(
      0,
      intersectionEnd - intersectionStart + 1
    )

    if (intersectionLength <= maxIntersection) {
      continue
    }

    maxIntersection = intersectionLength
    bestMapping = {
      withinPatch: intersectionLength === reviewEndLine - reviewStartLine + 1,
      bestPatchStartLine: startLine,
      bestPatchEndLine: endLine
    }

    if (bestMapping.withinPatch) {
      break
    }
  }

  return bestMapping
}

function mapReviewToPatch(review: ReviewComment, patches: ReviewPatch[]): void {
  const {withinPatch, bestPatchStartLine, bestPatchEndLine} = getPatchMapping(
    review.startLine,
    review.endLine,
    patches
  )

  if (withinPatch) {
    return
  }

  const note =
    bestPatchStartLine !== -1 && bestPatchEndLine !== -1
      ? `> Note: This review was outside of the patch, so it was mapped to the patch with the greatest overlap. Original lines [${review.startLine}-${review.endLine}]`
      : `> Note: This review was outside of the patch, but no patch was found that overlapped with it. Original lines [${review.startLine}-${review.endLine}]`

  review.comment = `${note}

${review.comment}`
  review.startLine =
    bestPatchStartLine !== -1 ? bestPatchStartLine : patches[0][0]
  review.endLine = bestPatchEndLine !== -1 ? bestPatchEndLine : patches[0][1]
}

function flushPendingReview(
  pendingReview: PendingReview,
  patches: ReviewPatch[],
  reviews: ReviewComment[],
  debug: boolean
): PendingReview {
  if (pendingReview.startLine == null || pendingReview.endLine == null) {
    return pendingReview
  }

  const review: ReviewComment = {
    startLine: pendingReview.startLine,
    endLine: pendingReview.endLine,
    comment: pendingReview.comment
  }

  mapReviewToPatch(review, patches)
  reviews.push(review)

  info(
    `Stored comment for line range ${review.startLine}-${review.endLine}: ${review.comment.trim()}`
  )

  if (debug) {
    info('Flushed parsed review block')
  }

  return createEmptyPendingReview()
}

function startPendingReview(
  line: string,
  debug: boolean
): PendingReview | null {
  const lineNumberRangeMatch = LINE_NUMBER_RANGE_REGEX.exec(line)
  if (lineNumberRangeMatch == null) {
    return null
  }

  const startLine = parseInt(lineNumberRangeMatch[1], 10)
  const endLine = parseInt(lineNumberRangeMatch[2], 10)

  if (debug) {
    info(`Found line number range: ${startLine}-${endLine}`)
  }

  return {
    startLine,
    endLine,
    comment: ''
  }
}

function appendReviewLine(
  pendingReview: PendingReview,
  line: string
): PendingReview {
  if (pendingReview.startLine == null || pendingReview.endLine == null) {
    return pendingReview
  }

  return {
    ...pendingReview,
    comment: `${pendingReview.comment}${line}\n`
  }
}

export function parseReview(
  response: string,
  patches: ReviewPatch[],
  debug = false
): ReviewComment[] {
  const reviews: ReviewComment[] = []
  const sanitizedLines = sanitizeResponse(response.trim()).split('\n')
  let pendingReview = createEmptyPendingReview()

  for (const line of sanitizedLines) {
    const nextReview = startPendingReview(line, debug)
    if (nextReview != null) {
      flushPendingReview(pendingReview, patches, reviews, debug)
      pendingReview = nextReview
      continue
    }

    if (line.trim() === COMMENT_SEPARATOR) {
      flushPendingReview(pendingReview, patches, reviews, debug)
      pendingReview = createEmptyPendingReview()
      continue
    }

    pendingReview = appendReviewLine(pendingReview, line)
  }

  flushPendingReview(pendingReview, patches, reviews, debug)

  return reviews
}
