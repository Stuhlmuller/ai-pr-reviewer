import {info, warning} from '@actions/core'
// eslint-disable-next-line camelcase
import {context as github_context} from '@actions/github'
import {type Bot} from './bot'
import {
  Commenter,
  COMMENT_REPLY_TAG,
  COMMENT_TAG,
  SUMMARIZE_TAG
} from './commenter'
import {Inputs} from './inputs'
import {octokit} from './octokit'
import {type Options} from './options'
import {type Prompts} from './prompts'
import {getTokenCount} from './tokenizer'

// eslint-disable-next-line camelcase
const context = github_context
const repo = context.repo
const ASK_BOT = '@codereviewer'

function validateEvent(): boolean {
  if (context.eventName !== 'pull_request_review_comment') {
    warning(
      `Skipped: ${context.eventName} is not a pull_request_review_comment event`
    )
    return false
  }

  if (!context.payload) {
    warning(`Skipped: ${context.eventName} event is missing payload`)
    return false
  }

  if (context.payload.comment == null) {
    warning(`Skipped: ${context.eventName} event is missing comment`)
    return false
  }

  if (
    context.payload.pull_request == null ||
    context.payload.repository == null
  ) {
    warning(`Skipped: ${context.eventName} event is missing pull_request`)
    return false
  }

  if (context.payload.action !== 'created') {
    warning(`Skipped: ${context.eventName} event is not created`)
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
  commenter: Commenter,
  inputs: Inputs,
  prompts: Prompts,
  options: Options,
  fileDiff: string,
  pullNumber: number
): Promise<boolean> {
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

export const handleReviewComment = async (
  heavyBot: Bot,
  options: Options,
  prompts: Prompts
) => {
  if (!validateEvent()) {
    return
  }

  // After validateEvent() returns true, we know these are defined
  const comment = context.payload?.comment
  const pullRequest = context.payload?.pull_request
  if (!comment || !pullRequest) {
    return
  }

  const commenter: Commenter = new Commenter()
  const inputs: Inputs = new Inputs()

  if (
    comment.body.includes(COMMENT_TAG) ||
    comment.body.includes(COMMENT_REPLY_TAG)
  ) {
    info(`Skipped: ${context.eventName} event is from the bot itself`)
    return
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
    return
  }

  inputs.commentChain = commentChain

  const shouldReply =
    commentChain.includes(COMMENT_TAG) ||
    commentChain.includes(COMMENT_REPLY_TAG) ||
    comment.body.includes(ASK_BOT)

  if (!shouldReply) {
    return
  }

  let fileDiff = await getFileDiff(
    comment.path,
    pullRequest.base.sha,
    pullRequest.head.sha
  )

  if (inputs.diff.length === 0) {
    if (fileDiff.length > 0) {
      inputs.diff = fileDiff
      fileDiff = ''
    } else {
      await commenter.reviewCommentReply(
        pullNumber,
        topLevelComment,
        'Cannot reply to this comment as diff could not be found.'
      )
      return
    }
  }

  const tokensValid = await validateAndPackTokens(
    commenter,
    inputs,
    prompts,
    options,
    fileDiff,
    pullNumber
  )

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
