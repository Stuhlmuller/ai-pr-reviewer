import {info, warning} from '@actions/core'
// eslint-disable-next-line camelcase
import {context as github_context} from '@actions/github'
import {octokit} from './octokit'
import {type Options} from './options'
import {parsePatch, patchStartEndLine, splitPatch} from './review-patch-parser'
import {
  type AsyncLimit,
  type DiffFilterResult,
  type FileChange,
  type ReviewFileRecord,
  type ReviewPatch
} from './review-types'

// eslint-disable-next-line camelcase
const context = github_context
const repo = context.repo

export function filterFilesByPath(
  files: any[],
  options: Options
): {selected: any[]; ignored: any[]} {
  const selected: any[] = []
  const ignored: any[] = []

  for (const file of files) {
    if (!options.checkPath(file.filename)) {
      info(`skip for excluded path: ${file.filename}`)
      ignored.push(file)
      continue
    }

    selected.push(file)
  }

  return {selected, ignored}
}

function filterIncrementalFiles(
  incrementalFiles: any[],
  targetBranchFiles: any[]
): any[] {
  return targetBranchFiles.filter(targetBranchFile =>
    incrementalFiles.some(
      incrementalFile => incrementalFile.filename === targetBranchFile.filename
    )
  )
}

function buildPatchBody(oldHunk: string, newHunk: string): string {
  return `
---new_hunk---
\`\`\`
${newHunk}
\`\`\`

---old_hunk---
\`\`\`
${oldHunk}
\`\`\`
`
}

function buildReviewPatches(file: ReviewFileRecord): ReviewPatch[] {
  const patches: ReviewPatch[] = []

  for (const patch of splitPatch(file.patch)) {
    const patchLines = patchStartEndLine(patch)
    const hunks = parsePatch(patch)
    if (patchLines == null || hunks == null) {
      continue
    }

    patches.push([
      patchLines.newHunk.startLine,
      patchLines.newHunk.endLine,
      buildPatchBody(hunks.oldHunk, hunks.newHunk)
    ])
  }

  return patches
}

async function retrieveFileContent(
  filename: string,
  baseSha: string
): Promise<string> {
  try {
    const contents = await octokit.repos.getContent({
      owner: repo.owner,
      repo: repo.repo,
      path: filename,
      ref: baseSha
    })
    if (contents.data == null || Array.isArray(contents.data)) {
      return ''
    }

    if (contents.data.type === 'file' && contents.data.content != null) {
      return Buffer.from(contents.data.content, 'base64').toString()
    }
  } catch (error) {
    warning(
      `Failed to get file contents: ${String(
        error
      )}. This is OK if it's a new file.`
    )
  }

  return ''
}

async function processFileForReview(
  file: ReviewFileRecord,
  baseSha: string
): Promise<FileChange | null> {
  const fileContent = await retrieveFileContent(file.filename, baseSha)
  const fileDiff = file.patch ?? ''
  const patches = buildReviewPatches(file)

  if (patches.length === 0) {
    return null
  }

  return [file.filename, fileContent, fileDiff, patches]
}

export async function fetchDiffsAndFilterFiles(
  highestReviewedCommitId: string,
  options: Options
): Promise<DiffFilterResult | null> {
  if (context.payload.pull_request == null) {
    return null
  }

  const incrementalDiff = await octokit.repos.compareCommits({
    owner: repo.owner,
    repo: repo.repo,
    base: highestReviewedCommitId,
    head: context.payload.pull_request.head.sha
  })
  const targetBranchDiff = await octokit.repos.compareCommits({
    owner: repo.owner,
    repo: repo.repo,
    base: context.payload.pull_request.base.sha,
    head: context.payload.pull_request.head.sha
  })

  const incrementalFiles = incrementalDiff.data.files
  const targetBranchFiles = targetBranchDiff.data.files
  if (incrementalFiles == null || targetBranchFiles == null) {
    warning('Skipped: files data is missing')
    return null
  }

  const files = filterIncrementalFiles(incrementalFiles, targetBranchFiles)
  const {selected: filterSelectedFiles, ignored: filterIgnoredFiles} =
    filterFilesByPath(files, options)
  const commits = incrementalDiff.data.commits

  if (
    files.length === 0 ||
    filterSelectedFiles.length === 0 ||
    commits.length === 0
  ) {
    const emptyResultLabel =
      files.length === 0
        ? 'files'
        : filterSelectedFiles.length === 0
          ? 'filterSelectedFiles'
          : 'commits'
    warning(`Skipped: ${emptyResultLabel} is null`)
    return null
  }

  return {files, commits, filterSelectedFiles, filterIgnoredFiles}
}

export async function processFilesForReview(
  filterSelectedFiles: ReviewFileRecord[],
  githubConcurrencyLimit: AsyncLimit
): Promise<FileChange[]> {
  if (context.payload.pull_request == null) {
    warning('Skipped: context.payload.pull_request is null')
    return []
  }

  const baseSha = context.payload.pull_request.base.sha
  const filteredFiles = await Promise.all(
    filterSelectedFiles.map(file =>
      githubConcurrencyLimit(
        async () => await processFileForReview(file, baseSha)
      )
    )
  )

  return filteredFiles.filter((file): file is FileChange => file !== null)
}
