import {getInput, info, warning} from '@actions/core'
import {context as github_context} from '@actions/github'
import {BOT_NAME} from './brand'
import {
  composeCommentChain as buildCommentChain,
  getTopLevelComment as resolveTopLevelComment
} from './commenter-chains'
import {
  commentHasContent,
  commentMatchesExactRange,
  commentSpansRange,
  listPaginatedCached
} from './commenter-helpers'
import {
  bodyHasTag,
  COMMENT_TAG,
  DESCRIPTION_END_TAG,
  DESCRIPTION_START_TAG,
  getContentWithinTagAliases,
  RAW_SUMMARY_END_TAG,
  RAW_SUMMARY_START_TAG,
  removeContentWithinTagAliases,
  SHORT_SUMMARY_END_TAG,
  SHORT_SUMMARY_START_TAG
} from './comment-tags'
import {
  normalizeIssueComment,
  normalizeReviewComment,
  type GithubIssueComment,
  type GithubReviewComment,
  type GithubReviewCommentDraft,
  type GithubReviewCommentLike
} from './github-types'
import {
  addInProgressStatus as buildInProgressStatus,
  addReviewedCommitId as appendReviewedCommitId,
  collectCommitIds,
  getHighestReviewedCommitId as resolveHighestReviewedCommitId,
  getReviewState as extractReviewState,
  getReviewedCommitIds as extractReviewedCommitIds,
  getReviewedCommitIdsBlock as extractReviewedCommitIdsBlock,
  removeInProgressStatus as stripInProgressStatus,
  removeReviewState as stripReviewState,
  setReviewState as replaceReviewState
} from './commenter-state'
import {
  deletePendingReview as removePendingReview,
  submitEmptyReview as createEmptyReview
} from './commenter-review'
import {reviewCommentReply as sendReviewCommentReply} from './commenter-replies'
import {octokit} from './octokit'

const context = github_context
const repo = context.repo

export const COMMENT_GREETING = `${getInput('bot_icon')} ${BOT_NAME}`
export {
  bodyHasTag,
  COMMENT_REPLY_TAG,
  COMMENT_TAG,
  DESCRIPTION_END_TAG,
  DESCRIPTION_START_TAG,
  IN_PROGRESS_END_TAG,
  IN_PROGRESS_START_TAG,
  RAW_SUMMARY_END_TAG,
  RAW_SUMMARY_START_TAG,
  SHORT_SUMMARY_END_TAG,
  SHORT_SUMMARY_START_TAG,
  SUMMARIZE_TAG
} from './comment-tags'

export {
  COMMIT_ID_END_TAG,
  COMMIT_ID_START_TAG,
  REVIEW_STATE_END_TAG,
  REVIEW_STATE_START_TAG
} from './commenter-state'

export class Commenter {
  /**
   * @param mode Can be "create", "replace". Default is "replace".
   */
  async comment(message: string, tag: string, mode: string) {
    let target: number
    if (context.payload.pull_request != null) {
      target = context.payload.pull_request.number
    } else if (context.payload.issue != null) {
      target = context.payload.issue.number
    } else {
      warning(
        'Skipped: context.payload.pull_request and context.payload.issue are both null'
      )
      return
    }

    if (!tag) {
      tag = COMMENT_TAG
    }

    const body = `${COMMENT_GREETING}

${message}

${tag}`

    if (mode === 'create') {
      await this.create(body, target)
    } else if (mode === 'replace') {
      await this.replace(body, tag, target)
    } else {
      warning(`Unknown mode: ${mode}, use "replace" instead`)
      await this.replace(body, tag, target)
    }
  }

  getContentWithinTags(content: string, startTag: string, endTag: string) {
    return getContentWithinTagAliases(content, startTag, endTag)
  }

  removeContentWithinTags(content: string, startTag: string, endTag: string) {
    return removeContentWithinTagAliases(content, startTag, endTag)
  }

  getRawSummary(summary: string) {
    return this.getContentWithinTags(
      summary,
      RAW_SUMMARY_START_TAG,
      RAW_SUMMARY_END_TAG
    )
  }

  getShortSummary(summary: string) {
    return this.getContentWithinTags(
      summary,
      SHORT_SUMMARY_START_TAG,
      SHORT_SUMMARY_END_TAG
    )
  }

  getDescription(description: string) {
    return this.removeContentWithinTags(
      description,
      DESCRIPTION_START_TAG,
      DESCRIPTION_END_TAG
    )
  }

  getReleaseNotes(description: string) {
    const releaseNotes = this.getContentWithinTags(
      description,
      DESCRIPTION_START_TAG,
      DESCRIPTION_END_TAG
    )
    return releaseNotes.replace(/(^|\n)> .*/g, '')
  }

  async updateDescription(pullNumber: number, message: string) {
    // add this response to the description field of the PR as release notes by looking
    // for the tag (marker)
    try {
      // get latest description from PR
      const pr = await octokit.pulls.get({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: pullNumber
      })
      let body = ''
      if (pr.data.body) {
        body = pr.data.body
      }
      const description = this.getDescription(body)

      const messageClean = this.removeContentWithinTags(
        message,
        DESCRIPTION_START_TAG,
        DESCRIPTION_END_TAG
      )
      const newDescription = `${description}\n${DESCRIPTION_START_TAG}\n${messageClean}\n${DESCRIPTION_END_TAG}`
      await octokit.pulls.update({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: pullNumber,
        body: newDescription
      })
    } catch (e) {
      warning(
        `Failed to get PR: ${e}, skipping adding release notes to description.`
      )
    }
  }

  private readonly reviewCommentsBuffer: Array<{
    path: string
    startLine: number
    endLine: number
    message: string
  }> = []

  async bufferReviewComment(
    path: string,
    startLine: number,
    endLine: number,
    message: string
  ) {
    message = `${COMMENT_GREETING}

${message}

${COMMENT_TAG}`
    this.reviewCommentsBuffer.push({
      path,
      startLine,
      endLine,
      message
    })
  }

  async deletePendingReview(pullNumber: number) {
    await removePendingReview(repo, pullNumber)
  }

  private async submitEmptyReview(
    pullNumber: number,
    commitId: string,
    body: string
  ): Promise<void> {
    await createEmptyReview(repo, pullNumber, commitId, body)
  }

  private async deleteExistingComments(pullNumber: number): Promise<void> {
    for (const comment of this.reviewCommentsBuffer) {
      const comments = await this.getCommentsAtRange(
        pullNumber,
        comment.path,
        comment.startLine,
        comment.endLine
      )
      for (const c of comments) {
        if (bodyHasTag(c.body, COMMENT_TAG)) {
          info(
            `Deleting review comment for ${comment.path}:${comment.startLine}-${comment.endLine}: ${comment.message}`
          )
          try {
            await octokit.pulls.deleteReviewComment({
              owner: repo.owner,
              repo: repo.repo,
              comment_id: c.id
            })
          } catch (e) {
            warning(`Failed to delete review comment: ${e}`)
          }
        }
      }
    }
  }

  private generateCommentData(comment: {
    path: string
    message: string
    startLine: number
    endLine: number
  }): GithubReviewCommentDraft {
    const commentData: GithubReviewCommentDraft = {
      path: comment.path,
      body: comment.message,
      line: comment.endLine,
      side: 'RIGHT'
    }

    if (comment.startLine !== comment.endLine) {
      commentData.start_line = comment.startLine
      commentData.start_side = 'RIGHT'
    }

    return commentData
  }

  private async submitReviewAsIndividualComments(
    pullNumber: number,
    commitId: string
  ): Promise<void> {
    let commentCounter = 0
    for (const comment of this.reviewCommentsBuffer) {
      info(
        `Creating new review comment for ${comment.path}:${comment.startLine}-${comment.endLine}: ${comment.message}`
      )
      const commentData = {
        owner: repo.owner,
        repo: repo.repo,
        pull_number: pullNumber,
        commit_id: commitId,
        ...this.generateCommentData(comment)
      }

      try {
        await octokit.pulls.createReviewComment(commentData)
      } catch (ee) {
        warning(`Failed to create review comment: ${ee}`)
      }

      commentCounter++
      info(
        `Comment ${commentCounter}/${this.reviewCommentsBuffer.length} posted`
      )
    }
  }

  async submitReview(pullNumber: number, commitId: string, statusMsg: string) {
    const body = `${COMMENT_GREETING}

${statusMsg}
`

    if (this.reviewCommentsBuffer.length === 0) {
      await this.submitEmptyReview(pullNumber, commitId, body)
      return
    }

    await this.deleteExistingComments(pullNumber)
    await this.deletePendingReview(pullNumber)

    try {
      const review = await octokit.pulls.createReview({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: pullNumber,
        commit_id: commitId,
        comments: this.reviewCommentsBuffer.map(comment =>
          this.generateCommentData(comment)
        )
      })

      info(
        `Submitting review for PR #${pullNumber}, total comments: ${this.reviewCommentsBuffer.length}, review id: ${review.data.id}`
      )

      await octokit.pulls.submitReview({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: pullNumber,
        review_id: review.data.id,
        event: 'COMMENT',
        body
      })
    } catch (e) {
      warning(
        `Failed to create review: ${e}. Falling back to individual comments.`
      )
      await this.deletePendingReview(pullNumber)
      await this.submitReviewAsIndividualComments(pullNumber, commitId)
    }
  }

  async reviewCommentReply(
    pullNumber: number,
    topLevelComment: GithubReviewComment,
    message: string
  ) {
    await sendReviewCommentReply(
      repo,
      pullNumber,
      topLevelComment,
      message,
      COMMENT_GREETING
    )
  }

  async getCommentsWithinRange(
    pullNumber: number,
    path: string,
    startLine: number,
    endLine: number
  ): Promise<GithubReviewComment[]> {
    const comments = await this.listReviewComments(pullNumber)
    return comments.filter(
      comment =>
        commentHasContent(comment, path) &&
        commentSpansRange(comment, startLine, endLine)
    )
  }

  async getCommentsAtRange(
    pullNumber: number,
    path: string,
    startLine: number,
    endLine: number
  ): Promise<GithubReviewComment[]> {
    const comments = await this.listReviewComments(pullNumber)
    return comments.filter(
      comment =>
        commentHasContent(comment, path) &&
        commentMatchesExactRange(comment, startLine, endLine)
    )
  }

  async getCommentChainsWithinRange(
    pullNumber: number,
    path: string,
    startLine: number,
    endLine: number,
    tag = ''
  ): Promise<string> {
    const existingComments = await this.getCommentsWithinRange(
      pullNumber,
      path,
      startLine,
      endLine
    )
    // find all top most comments
    const topLevelComments: GithubReviewComment[] = []
    for (const comment of existingComments) {
      if (!comment.in_reply_to_id) {
        topLevelComments.push(comment)
      }
    }

    let allChains = ''
    let chainNum = 0
    for (const topLevelComment of topLevelComments) {
      // get conversation chain
      const chain = await this.composeCommentChain(
        existingComments,
        topLevelComment
      )
      if (tag === '' || bodyHasTag(chain, tag)) {
        chainNum += 1
        allChains += `Conversation Chain ${chainNum}:
${chain}
---
`
      }
    }
    return allChains
  }

  async composeCommentChain(
    reviewComments: GithubReviewComment[],
    topLevelComment: GithubReviewComment
  ): Promise<string> {
    return buildCommentChain(reviewComments, topLevelComment)
  }

  async getCommentChain(
    pullNumber: number,
    comment: GithubReviewCommentLike
  ): Promise<{chain: string; topLevelComment: GithubReviewComment | null}> {
    try {
      const reviewComments = await this.listReviewComments(pullNumber)
      const normalizedComment = normalizeReviewComment(comment)
      const topLevelComment = await this.getTopLevelComment(
        reviewComments,
        normalizedComment
      )
      const chain = await this.composeCommentChain(
        reviewComments,
        topLevelComment
      )
      return {chain, topLevelComment}
    } catch (e) {
      warning(`Failed to get conversation chain: ${e}`)
      return {
        chain: '',
        topLevelComment: null
      }
    }
  }

  async getTopLevelComment(
    reviewComments: GithubReviewComment[],
    comment: GithubReviewComment
  ): Promise<GithubReviewComment> {
    return resolveTopLevelComment(reviewComments, comment)
  }

  private readonly reviewCommentsCache: Record<number, GithubReviewComment[]> =
    {}

  async listReviewComments(target: number): Promise<GithubReviewComment[]> {
    return await listPaginatedCached(
      target,
      this.reviewCommentsCache,
      async page => {
        const {data: comments} = await octokit.pulls.listReviewComments({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: target,
          page,
          per_page: 100
        })
        return comments.map(normalizeReviewComment)
      },
      'review comments'
    )
  }

  async create(body: string, target: number) {
    try {
      // get comment ID from the response
      const response = await octokit.issues.createComment({
        owner: repo.owner,
        repo: repo.repo,
        issue_number: target,
        body
      })
      // add comment to issueCommentsCache
      const normalizedComment = normalizeIssueComment(response.data)
      if (this.issueCommentsCache[target]) {
        this.issueCommentsCache[target].push(normalizedComment)
      } else {
        this.issueCommentsCache[target] = [normalizedComment]
      }
    } catch (e) {
      warning(`Failed to create comment: ${e}`)
    }
  }

  async replace(body: string, tag: string, target: number) {
    try {
      const cmt = await this.findCommentWithTag(tag, target)
      if (cmt) {
        await octokit.issues.updateComment({
          owner: repo.owner,
          repo: repo.repo,
          comment_id: cmt.id,
          body
        })
      } else {
        await this.create(body, target)
      }
    } catch (e) {
      warning(`Failed to replace comment: ${e}`)
    }
  }

  async findCommentWithTag(
    tag: string,
    target: number
  ): Promise<GithubIssueComment | null> {
    try {
      const comments = await this.listComments(target)
      for (const cmt of comments) {
        if (bodyHasTag(cmt.body, tag)) {
          return cmt
        }
      }

      return null
    } catch (e: unknown) {
      warning(`Failed to find comment with tag: ${String(e)}`)
      return null
    }
  }

  private readonly issueCommentsCache: Record<number, GithubIssueComment[]> = {}

  async listComments(target: number): Promise<GithubIssueComment[]> {
    return await listPaginatedCached(
      target,
      this.issueCommentsCache,
      async page => {
        const {data: comments} = await octokit.issues.listComments({
          owner: repo.owner,
          repo: repo.repo,
          issue_number: target,
          page,
          per_page: 100
        })
        return comments.map(normalizeIssueComment)
      },
      'comments'
    )
  }

  // function that takes a comment body and returns the list of commit ids that have been reviewed
  // commit ids are comments between the commit_ids_reviewed_start and commit_ids_reviewed_end markers
  // <!-- [commit_id] -->
  getReviewedCommitIds(commentBody: string): string[] {
    return extractReviewedCommitIds(commentBody)
  }

  // get review commit ids comment block from the body as a string
  // including markers
  getReviewedCommitIdsBlock(commentBody: string): string {
    return extractReviewedCommitIdsBlock(commentBody)
  }

  // add a commit id to the list of reviewed commit ids
  // if the marker doesn't exist, add it
  addReviewedCommitId(commentBody: string, commitId: string): string {
    return appendReviewedCommitId(commentBody, commitId)
  }

  // given a list of commit ids provide the highest commit id that has been reviewed
  getHighestReviewedCommitId(
    commitIds: string[],
    reviewedCommitIds: string[]
  ): string {
    return resolveHighestReviewedCommitId(commitIds, reviewedCommitIds)
  }

  async getAllCommitIds(): Promise<string[]> {
    if (context?.payload?.pull_request == null) {
      return []
    }

    const pullNumber = context.payload.pull_request.number
    return await collectCommitIds(pullNumber, async page => {
      const commits = await octokit.pulls.listCommits({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: pullNumber,
        per_page: 100,
        page
      })

      return commits.data
    })
  }

  // add in-progress status to the comment body
  addInProgressStatus(commentBody: string, statusMsg: string): string {
    return buildInProgressStatus(commentBody, statusMsg)
  }

  // remove in-progress status from the comment body
  removeInProgressStatus(commentBody: string): string {
    return stripInProgressStatus(commentBody)
  }

  /**
   * Gets the review state from the comment body
   * Returns null if no state is found or if the state is invalid
   */
  getReviewState(commentBody: string): string | null {
    return extractReviewState(commentBody)
  }

  /**
   * Adds or updates the review state in the comment body
   * If state markers don't exist, they are added to the end
   */
  setReviewState(commentBody: string, stateJson: string): string {
    return replaceReviewState(commentBody, stateJson)
  }

  /**
   * Removes the review state from the comment body
   */
  removeReviewState(commentBody: string): string {
    return stripReviewState(commentBody)
  }
}
