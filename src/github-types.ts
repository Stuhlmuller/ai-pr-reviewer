export interface GithubUserRef {
  login: string
}

export interface GithubReviewComment {
  id: number
  body: string
  path: string
  line: number
  start_line?: number | null
  in_reply_to_id?: number | null
  user: GithubUserRef
  diff_hunk?: string
}

export interface GithubIssueComment {
  id: number
  body: string
}

export interface GithubReviewCommentLike {
  id: number
  body?: string | null
  path?: string | null
  line?: number | null
  start_line?: number | null
  in_reply_to_id?: number | null
  user?: {
    login?: string | null
  } | null
  diff_hunk?: string | null
}

export interface GithubIssueCommentLike {
  id: number
  body?: string | null
}

export interface GithubReviewCommentDraft {
  path: string
  body: string
  line: number
  side: 'RIGHT'
  start_line?: number
  start_side?: 'RIGHT'
}

export interface GithubPullRequestFile {
  filename: string
  patch?: string | null
}

export interface GithubCommitRef {
  sha: string
}

export function normalizeReviewComment(
  comment: GithubReviewCommentLike
): GithubReviewComment {
  return {
    id: comment.id,
    body: comment.body ?? '',
    path: comment.path ?? '',
    line: comment.line ?? 0,
    start_line: comment.start_line ?? undefined,
    in_reply_to_id: comment.in_reply_to_id ?? undefined,
    user: {
      login: comment.user?.login ?? 'unknown'
    },
    diff_hunk: comment.diff_hunk ?? undefined
  }
}

export function normalizeIssueComment(
  comment: GithubIssueCommentLike
): GithubIssueComment {
  return {
    id: comment.id,
    body: comment.body ?? ''
  }
}
