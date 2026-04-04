import {warning} from '@actions/core'
import {
  COMMENT_REPLY_TAG,
  COMMENT_TAG,
  bodyHasTag,
  replaceTagAlias
} from './comment-tags'
import {octokit} from './octokit'

interface RepoRef {
  owner: string
  repo: string
}

export async function reviewCommentReply(
  repo: RepoRef,
  pullNumber: number,
  topLevelComment: any,
  message: string,
  commentGreeting: string
): Promise<void> {
  const reply = `${commentGreeting}

${message}

${COMMENT_REPLY_TAG}
`

  try {
    await octokit.pulls.createReplyForReviewComment({
      owner: repo.owner,
      repo: repo.repo,
      // eslint-disable-next-line camelcase
      pull_number: pullNumber,
      body: reply,
      // eslint-disable-next-line camelcase
      comment_id: topLevelComment.id
    })
  } catch (error) {
    warning(`Failed to reply to the top-level comment ${String(error)}`)
    try {
      await octokit.pulls.createReplyForReviewComment({
        owner: repo.owner,
        repo: repo.repo,
        // eslint-disable-next-line camelcase
        pull_number: pullNumber,
        body: `Could not post the reply to the top-level comment due to the following error: ${String(error)}`,
        // eslint-disable-next-line camelcase
        comment_id: topLevelComment.id
      })
    } catch (replyError) {
      warning(`Failed to reply to the top-level comment ${String(replyError)}`)
    }
  }

  try {
    if (!bodyHasTag(topLevelComment.body, COMMENT_TAG)) {
      return
    }

    const newBody = replaceTagAlias(
      topLevelComment.body,
      COMMENT_TAG,
      COMMENT_REPLY_TAG
    )
    await octokit.pulls.updateReviewComment({
      owner: repo.owner,
      repo: repo.repo,
      // eslint-disable-next-line camelcase
      comment_id: topLevelComment.id,
      body: newBody
    })
  } catch (error) {
    warning(`Failed to update the top-level comment ${String(error)}`)
  }
}
