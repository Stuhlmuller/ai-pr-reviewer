export function composeCommentChain(
  reviewComments: any[],
  topLevelComment: any
): string {
  const conversationChain = reviewComments
    .filter((comment: any) => comment.in_reply_to_id === topLevelComment.id)
    .map((comment: any) => `${comment.user.login}: ${comment.body}`)

  conversationChain.unshift(
    `${topLevelComment.user.login}: ${topLevelComment.body}`
  )
  return conversationChain.join('\n---\n')
}

export function getTopLevelComment(reviewComments: any[], comment: any): any {
  let topLevelComment = comment

  while (topLevelComment.in_reply_to_id) {
    const parentComment = reviewComments.find(
      (currentComment: any) =>
        currentComment.id === topLevelComment.in_reply_to_id
    )

    if (parentComment == null) {
      break
    }

    topLevelComment = parentComment
  }

  return topLevelComment
}
