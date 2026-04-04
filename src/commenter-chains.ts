import {type GithubReviewComment} from './github-types'

export function composeCommentChain(
  reviewComments: GithubReviewComment[],
  topLevelComment: GithubReviewComment
): string {
  const conversationChain = reviewComments
    .filter(comment => comment.in_reply_to_id === topLevelComment.id)
    .map(comment => `${comment.user.login}: ${comment.body}`)

  conversationChain.unshift(
    `${topLevelComment.user.login}: ${topLevelComment.body}`
  )
  return conversationChain.join('\n---\n')
}

export function getTopLevelComment(
  reviewComments: GithubReviewComment[],
  comment: GithubReviewComment
): GithubReviewComment {
  let topLevelComment = comment

  while (topLevelComment.in_reply_to_id) {
    const parentComment = reviewComments.find(
      currentComment => currentComment.id === topLevelComment.in_reply_to_id
    )

    if (parentComment == null) {
      break
    }

    topLevelComment = parentComment
  }

  return topLevelComment
}
