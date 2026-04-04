import {getInput, warning} from '@actions/core'
// eslint-disable-next-line import/no-unresolved
import {Octokit} from '@octokit/action'
// eslint-disable-next-line import/no-unresolved
import {retry} from '@octokit/plugin-retry'
// eslint-disable-next-line import/no-unresolved
import {throttling} from '@octokit/plugin-throttling'

const token = getInput('token') || process.env.GITHUB_TOKEN

const RetryAndThrottlingOctokit = Octokit.plugin(throttling, retry)

export const octokit = new RetryAndThrottlingOctokit({
  auth: `token ${token}`,
  throttle: {
    onRateLimit: (
      retryAfter: number,
      options: any,
      _o: any,
      retryCount: number
    ) => {
      warning(
        `Request quota exhausted for request ${options.method} ${options.url}
Retry after: ${retryAfter} seconds
Retry count: ${retryCount}
`
      )
      if (retryCount <= 3) {
        warning(`Retrying after ${retryAfter} seconds!`)
        return true
      }
    },
    onSecondaryRateLimit: (retryAfter: number, options: unknown) => {
      const request = options as {method: string; url: string}
      warning(
        `SecondaryRateLimit detected for request ${request.method} ${request.url} ; retry after ${retryAfter} seconds`
      )
      // if we are doing a POST method on /repos/{owner}/{repo}/pulls/{pull_number}/reviews then we shouldn't retry
      const reviewUrlPattern = /\/repos\/.*\/.*\/pulls\/.*\/reviews/
      if (
        request.method === 'POST' &&
        reviewUrlPattern.exec(request.url) != null
      ) {
        return false
      }
      return true
    }
  }
})
