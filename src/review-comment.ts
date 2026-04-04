import {info, warning} from '@actions/core'
// eslint-disable-next-line camelcase
import {context as github_context} from '@actions/github'
import {type Bot} from './bot'
import {
  Commenter,
  bodyHasTag,
  COMMENT_REPLY_TAG,
  COMMENT_TAG,
  SUMMARIZE_TAG
} from './commenter'
import {bodyIncludesBotHandle} from './brand'
import {Inputs} from './inputs'
import {octokit} from './octokit'
import {type Options} from './options'
import {type Prompts} from './prompts'
import {getTokenCount} from './tokenizer'

// eslint-disable-next-line camelcase
const context = github_context
const repo = context.repo

type ReviewCommentContext = {
  commenter: Commenter
  inputs: Inputs
  pullNumber: number
  pullRequest: NonNullable<typeof context.payload.pull_request>
  topLevelComment: any
}

type TokenValidationInput = {
  commenter: Commenter
  inputs: Inputs
  prompts: Prompts
  options: Options
  fileDiff: string
  pullNumber: number
}

function getValidationError(): string | null {
  const validations: Array<[boolean, string]> = [
    [
      context.eventName !== 'pull_request_review_comment',
      `${context.eventName} is not a pull_request_review_comment event`
    ],
    [!context.payload, `${context.eventName} event is missing payload`],
    [
      context.payload?.comment == null,
      `${context.eventName} event is missing comment`
    ],
    [
      context.payload?.pull_request == null ||
        context.payload?.repository == null,
      `${context.eventName} event is missing pull_request`
    ],
    [
      context.payload?.action !== 'created',
      `${context.eventName} event is not created`
    ]
  ]

  const failedValidation = validations.find(([isInvalid]) => isInvalid)
  return failedValidation ? failedValidation[1] : null
}

function validateEvent(): boolean {
  const validationError = getValidationError()
  if (validationError != null) {
    warning(`Skipped: ${validationError}`)
    return false
  }

  return true
}

function setupInputsFromContext(
  commenter: Commenter,
  inputs: Inputs,
  pullRequest: NonNullable<typeof context.payload.pull_request>
): void {
  inputs.title = pullRequest.title
  if (pullRequest.body) {
    inputs.description = commenter.getDescription(pullRequest.body)
  }
}

async function getFileDiff(
  filename: string,
  baseSha: string,
  headSha: string
): Promise<string> {
  try {
    const diffAll = await octokit.repos.compareCommits({
      owner: repo.owner,
      repo: repo.repo,
      base: baseSha,
      head: headSha
    })
    if (diffAll.data?.files != null) {
      const file = diffAll.data.files.find(f => f.filename === filename)
      if (file?.patch != null) {
        return file.patch
      }
    }
  } catch (error) {
    warning(`Failed to get file diff: ${error}, skipping.`)
  }
  return ''
}

async function validateAndPackTokens(
  validationInput: TokenValidationInput
): Promise<boolean> {
  const {commenter, inputs, prompts, options, fileDiff, pullNumber} =
    validationInput
  let tokens = getTokenCount(prompts.renderComment(inputs))

  if (tokens > options.heavyTokenLimits.requestTokens) {
    return false
  }

  if (fileDiff.length > 0) {
    const fileDiffCount = prompts.comment.split('$file_diff').length - 1
    const fileDiffTokens = getTokenCount(fileDiff)
    if (
      fileDiffCount > 0 &&
      tokens + fileDiffTokens * fileDiffCount <=
        options.heavyTokenLimits.requestTokens
    ) {
      tokens += fileDiffTokens * fileDiffCount
      inputs.fileDiff = fileDiff
    }
  }

  const summary = await commenter.findCommentWithTag(SUMMARIZE_TAG, pullNumber)
  if (summary) {
    const shortSummary = commenter.getShortSummary(summary.body)
    const shortSummaryTokens = getTokenCount(shortSummary)
    if (tokens + shortSummaryTokens <= options.heavyTokenLimits.requestTokens) {
      inputs.shortSummary = shortSummary
    }
  }

  return true
}

function isBotComment(commentBody: string): boolean {
  return (
    bodyHasTag(commentBody, COMMENT_TAG) ||
    bodyHasTag(commentBody, COMMENT_REPLY_TAG)
  )
}

function shouldReplyToComment(
  commentBody: string,
  commentChain: string
): boolean {
  return (
    bodyHasTag(commentChain, COMMENT_TAG) ||
    bodyHasTag(commentChain, COMMENT_REPLY_TAG) ||
    bodyIncludesBotHandle(commentBody)
  )
}

async function buildReviewCommentContext(): Promise<ReviewCommentContext | null> {
  const comment = context.payload?.comment
  const pullRequest = context.payload?.pull_request
  if (!comment || !pullRequest) {
    return null
  }

  const commenter = new Commenter()
  const inputs = new Inputs()

  if (isBotComment(comment.body)) {
    info(`Skipped: ${context.eventName} event is from the bot itself`)
    return null
  }

  setupInputsFromContext(commenter, inputs, pullRequest)

  const pullNumber = pullRequest.number
  inputs.comment = `${comment.user.login}: ${comment.body}`
  inputs.diff = comment.diff_hunk
  inputs.filename = comment.path

  const {chain: commentChain, topLevelComment} =
    await commenter.getCommentChain(pullNumber, comment)

  if (!topLevelComment) {
    warning('Failed to find the top-level comment to reply to')
    return null
  }

  inputs.commentChain = commentChain

  if (!shouldReplyToComment(comment.body, commentChain)) {
    return null
  }

  return {
    commenter,
    inputs,
    pullNumber,
    pullRequest,
    topLevelComment
  }
}

async function resolveFileDiff(
  reviewContext: ReviewCommentContext
): Promise<string | null> {
  const {commenter, inputs, pullNumber, pullRequest, topLevelComment} =
    reviewContext
  let fileDiff = await getFileDiff(
    inputs.filename,
    pullRequest.base.sha,
    pullRequest.head.sha
  )

  if (inputs.diff.length > 0) {
    return fileDiff
  }

  if (fileDiff.length > 0) {
    inputs.diff = fileDiff
    fileDiff = ''
    return fileDiff
  }

  await commenter.reviewCommentReply(
    pullNumber,
    topLevelComment,
    'Cannot reply to this comment as diff could not be found.'
  )
  return null
}

export const handleReviewComment = async (
  heavyBot: Bot,
  options: Options,
  prompts: Prompts
) => {
  if (!validateEvent()) {
    return
  }

  const reviewContext = await buildReviewCommentContext()
  if (reviewContext == null) {
    return
  }

  const {commenter, inputs, pullNumber, topLevelComment} = reviewContext
  const fileDiff = await resolveFileDiff(reviewContext)
  if (fileDiff == null) {
    return
  }

  const tokensValid = await validateAndPackTokens({
    commenter,
    inputs,
    prompts,
    options,
    fileDiff,
    pullNumber
  })

  if (!tokensValid) {
    await commenter.reviewCommentReply(
      pullNumber,
      topLevelComment,
      'Cannot reply to this comment as diff being commented is too large and exceeds the token limit.'
    )
    return
  }

  const [reply] = await heavyBot.chat(prompts.renderComment(inputs), {})
  await commenter.reviewCommentReply(pullNumber, topLevelComment, reply)
}
