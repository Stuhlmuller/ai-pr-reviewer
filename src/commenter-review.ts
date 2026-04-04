import {info, warning} from '@actions/core'
import {octokit} from './octokit'

interface RepoRef {
  owner: string
  repo: string
}

export async function deletePendingReview(
  repo: RepoRef,
  pullNumber: number
): Promise<void> {
  try {
    const reviews = await octokit.pulls.listReviews({
      owner: repo.owner,
      repo: repo.repo,
      pull_number: pullNumber
    })
    const pendingReview = reviews.data.find(
      review => review.state === 'PENDING'
    )

    if (pendingReview == null) {
      return
    }

    info(
      `Deleting pending review for PR #${pullNumber} id: ${pendingReview.id}`
    )
    try {
      await octokit.pulls.deletePendingReview({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: pullNumber,
        review_id: pendingReview.id
      })
    } catch (error) {
      warning(`Failed to delete pending review: ${String(error)}`)
    }
  } catch (error) {
    warning(`Failed to list reviews: ${String(error)}`)
  }
}

export async function submitEmptyReview(
  repo: RepoRef,
  pullNumber: number,
  commitId: string,
  body: string
): Promise<void> {
  info(`Submitting empty review for PR #${pullNumber}`)
  try {
    await octokit.pulls.createReview({
      owner: repo.owner,
      repo: repo.repo,
      pull_number: pullNumber,
      commit_id: commitId,
      event: 'COMMENT',
      body
    })
  } catch (error) {
    warning(`Failed to submit empty review: ${String(error)}`)
  }
}
