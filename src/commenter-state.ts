import {
  getContentWithinTagAliases,
  getTagAliases,
  IN_PROGRESS_END_TAG,
  IN_PROGRESS_START_TAG
} from './comment-tags'

export const COMMIT_ID_START_TAG = '<!-- commit_ids_reviewed_start -->'
export const COMMIT_ID_END_TAG = '<!-- commit_ids_reviewed_end -->'

export const REVIEW_STATE_START_TAG = '<!-- review_state_start -->'
export const REVIEW_STATE_END_TAG = '<!-- review_state_end -->'

type PullRequestCommit = {sha: string}

function getDelimitedContent(
  commentBody: string,
  startTag: string,
  endTag: string
): string {
  return getContentWithinTagAliases(commentBody, startTag, endTag)
}

export function getReviewedCommitIds(commentBody: string): string[] {
  const ids = getDelimitedContent(
    commentBody,
    COMMIT_ID_START_TAG,
    COMMIT_ID_END_TAG
  )
  return ids
    .split('<!--')
    .map(id => id.replace('-->', '').trim())
    .filter(id => id !== '')
}

export function getReviewedCommitIdsBlock(commentBody: string): string {
  const start = commentBody.indexOf(COMMIT_ID_START_TAG)
  const end = commentBody.indexOf(COMMIT_ID_END_TAG)
  if (start === -1 || end === -1) {
    return ''
  }

  return commentBody.substring(start, end + COMMIT_ID_END_TAG.length)
}

export function addReviewedCommitId(
  commentBody: string,
  commitId: string
): string {
  const existingBlock = getReviewedCommitIdsBlock(commentBody)
  if (existingBlock === '') {
    return `${commentBody}\n${COMMIT_ID_START_TAG}\n<!-- ${commitId} -->\n${COMMIT_ID_END_TAG}`
  }

  const insertAt = commentBody.indexOf(COMMIT_ID_END_TAG)
  return `${commentBody.substring(0, insertAt)}<!-- ${commitId} -->\n${commentBody.substring(insertAt)}`
}

export function getHighestReviewedCommitId(
  commitIds: string[],
  reviewedCommitIds: string[]
): string {
  for (let i = commitIds.length - 1; i >= 0; i--) {
    if (reviewedCommitIds.includes(commitIds[i])) {
      return commitIds[i]
    }
  }

  return ''
}

export async function collectCommitIds(
  pullNumber: number,
  listCommits: (page: number) => Promise<PullRequestCommit[]>
): Promise<string[]> {
  const allCommits: string[] = []
  let page = 1
  let commits: PullRequestCommit[]

  do {
    commits = await listCommits(page)
    allCommits.push(...commits.map(commit => commit.sha))
    page++
  } while (commits.length > 0)

  return allCommits
}

export function addInProgressStatus(
  commentBody: string,
  statusMsg: string
): string {
  const hasInProgressBlock =
    getTagAliases(IN_PROGRESS_START_TAG).some(tag =>
      commentBody.includes(tag)
    ) &&
    getTagAliases(IN_PROGRESS_END_TAG).some(tag => commentBody.includes(tag))

  if (hasInProgressBlock) {
    return commentBody
  }

  return `${IN_PROGRESS_START_TAG}

Currently reviewing new changes in this PR...

${statusMsg}

${IN_PROGRESS_END_TAG}

---

${commentBody}`
}

export function removeInProgressStatus(commentBody: string): string {
  const inProgressStatus = getDelimitedContent(
    commentBody,
    IN_PROGRESS_START_TAG,
    IN_PROGRESS_END_TAG
  )

  if (inProgressStatus === '') {
    return commentBody
  }

  return commentBody.replace(
    `${IN_PROGRESS_START_TAG}${inProgressStatus}${IN_PROGRESS_END_TAG}`,
    ''
  )
}

export function getReviewState(commentBody: string): string | null {
  const stateJson = getDelimitedContent(
    commentBody,
    REVIEW_STATE_START_TAG,
    REVIEW_STATE_END_TAG
  )

  return stateJson === '' ? null : stateJson.trim()
}

export function setReviewState(commentBody: string, stateJson: string): string {
  const stateBlock = `${REVIEW_STATE_START_TAG}
${stateJson}
${REVIEW_STATE_END_TAG}`
  const existingState = getDelimitedContent(
    commentBody,
    REVIEW_STATE_START_TAG,
    REVIEW_STATE_END_TAG
  )

  if (existingState === '') {
    return `${commentBody}\n\n${stateBlock}`
  }

  const currentBlock = `${REVIEW_STATE_START_TAG}${existingState}${REVIEW_STATE_END_TAG}`
  return commentBody.replace(currentBlock, stateBlock)
}

export function removeReviewState(commentBody: string): string {
  const stateJson = getDelimitedContent(
    commentBody,
    REVIEW_STATE_START_TAG,
    REVIEW_STATE_END_TAG
  )

  if (stateJson === '') {
    return commentBody
  }

  return commentBody.replace(
    `${REVIEW_STATE_START_TAG}${stateJson}${REVIEW_STATE_END_TAG}`,
    ''
  )
}
