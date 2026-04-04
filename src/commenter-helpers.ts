import {warning} from '@actions/core'
import {type GithubReviewComment} from './github-types'

export function commentHasContent(
  comment: GithubReviewComment,
  path: string
): boolean {
  return comment.path === path && comment.body !== ''
}

export function commentSpansRange(
  comment: GithubReviewComment,
  startLine: number,
  endLine: number
): boolean {
  if (comment.start_line == null) {
    return startLine === endLine && comment.line === endLine
  }

  return comment.start_line >= startLine && comment.line <= endLine
}

export function commentMatchesExactRange(
  comment: GithubReviewComment,
  startLine: number,
  endLine: number
): boolean {
  if (comment.start_line == null) {
    return startLine === endLine && comment.line === endLine
  }

  return comment.start_line === startLine && comment.line === endLine
}

export async function listPaginatedCached<T>(
  target: number,
  cache: Record<number, T[]>,
  fetchPage: (page: number) => Promise<T[]>,
  entityName: string
): Promise<T[]> {
  if (cache[target]) {
    return cache[target]
  }

  const allItems: T[] = []
  let page = 1

  try {
    for (;;) {
      const items = await fetchPage(page)
      allItems.push(...items)
      if (items.length < 100) {
        break
      }
      page += 1
    }

    cache[target] = allItems
  } catch (e) {
    warning(`Failed to list ${entityName}: ${e}`)
  }

  return allItems
}
