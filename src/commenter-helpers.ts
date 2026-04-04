import {warning} from '@actions/core'

export function commentHasContent(comment: any, path: string): boolean {
  return comment.path === path && comment.body !== ''
}

export function commentSpansRange(
  comment: any,
  startLine: number,
  endLine: number
) {
  if (comment.start_line === undefined) {
    return startLine === endLine && comment.line === endLine
  }

  return comment.start_line >= startLine && comment.line <= endLine
}

export function commentMatchesExactRange(
  comment: any,
  startLine: number,
  endLine: number
) {
  if (comment.start_line === undefined) {
    return startLine === endLine && comment.line === endLine
  }

  return comment.start_line === startLine && comment.line === endLine
}

export async function listPaginatedCached(
  target: number,
  cache: Record<number, any[]>,
  fetchPage: (page: number) => Promise<any[]>,
  entityName: string
) {
  if (cache[target]) {
    return cache[target]
  }

  const allItems: any[] = []
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
