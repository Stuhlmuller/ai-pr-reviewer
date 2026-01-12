/**
 * Review State Management
 *
 * This module provides state persistence for the PR review process, enabling
 * resume capability after failures (API rate limits, timeouts, network errors).
 *
 * State is persisted in GitHub PR comments using HTML tag markers, similar to
 * how commit IDs are tracked.
 */

export type FileStatus =
  | 'pending'
  | 'summarizing'
  | 'summarized'
  | 'reviewing'
  | 'reviewed'
  | 'failed'
  | 'skipped'

export interface FileReviewStatus {
  /** File path relative to repository root */
  filename: string
  /** Current status: pending, summarizing, summarized, reviewing, reviewed, failed, skipped */
  status: FileStatus
  /** Error message if status is 'failed' */
  error?: string
  /** Timestamp when this status was last updated (ISO 8601) */
  updatedAt: string
  /** Confidence score if file was skipped (0-100) */
  skipConfidence?: number
  /** Reason if file was skipped */
  skipReason?: string
}

export interface ReviewState {
  /** State format version for forward compatibility */
  version: string
  /** When the review started (ISO 8601 timestamp) */
  startedAt: string
  /** When the state was last updated (ISO 8601 timestamp) */
  updatedAt: string
  /** Commit ID being reviewed */
  commitId: string
  /** Total number of files in this review */
  totalFiles: number
  /** Number of files completed (summarized or reviewed or skipped) */
  completedFiles: number
  /** Number of files that failed */
  failedFiles: number
  /** Number of files skipped */
  skippedFiles: number
  /** Current phase: 'summarizing' or 'reviewing' */
  phase: 'summarizing' | 'reviewing'
  /** File-by-file status */
  files: FileReviewStatus[]
  /** Last error encountered (if any) */
  lastError?: {
    message: string
    timestamp: string
    /** Error type: 'rate_limit', 'timeout', 'network', 'api_error', 'unknown' */
    type: 'rate_limit' | 'timeout' | 'network' | 'api_error' | 'unknown'
  }
}

/**
 * Creates a new review state for tracking progress
 */
export function createReviewState(
  commitId: string,
  files: Array<{filename: string}>
): ReviewState {
  const now = new Date().toISOString()

  return {
    version: '1.0',
    startedAt: now,
    updatedAt: now,
    commitId,
    totalFiles: files.length,
    completedFiles: 0,
    failedFiles: 0,
    skippedFiles: 0,
    phase: 'summarizing',
    files: files.map(f => ({
      filename: f.filename,
      status: 'pending',
      updatedAt: now
    }))
  }
}

/**
 * Updates the status of a specific file in the review state
 */
export function updateFileStatus(
  state: ReviewState,
  filename: string,
  status: FileStatus,
  options?: {
    error?: string
    skipConfidence?: number
    skipReason?: string
  }
): ReviewState {
  const now = new Date().toISOString()
  const fileIndex = state.files.findIndex(f => f.filename === filename)

  if (fileIndex === -1) {
    throw new Error(`File ${filename} not found in review state`)
  }

  const oldStatus = state.files[fileIndex].status
  const newFiles = [...state.files]

  newFiles[fileIndex] = {
    ...newFiles[fileIndex],
    status,
    updatedAt: now,
    error: options?.error,
    skipConfidence: options?.skipConfidence,
    skipReason: options?.skipReason
  }

  // Update counters based on status transitions
  let completedDelta = 0
  let failedDelta = 0
  let skippedDelta = 0

  // Decrement old status counters
  if (oldStatus === 'reviewed' || oldStatus === 'skipped') {
    completedDelta--
  }
  if (oldStatus === 'failed') {
    failedDelta--
  }
  if (oldStatus === 'skipped') {
    skippedDelta--
  }

  // Increment new status counters
  if (status === 'reviewed' || status === 'skipped') {
    completedDelta++
  }
  if (status === 'failed') {
    failedDelta++
  }
  if (status === 'skipped') {
    skippedDelta++
  }

  return {
    ...state,
    updatedAt: now,
    files: newFiles,
    completedFiles: Math.max(0, state.completedFiles + completedDelta),
    failedFiles: Math.max(0, state.failedFiles + failedDelta),
    skippedFiles: Math.max(0, state.skippedFiles + skippedDelta)
  }
}

/**
 * Updates the review phase (summarizing -> reviewing)
 */
export function updatePhase(
  state: ReviewState,
  phase: ReviewState['phase']
): ReviewState {
  return {
    ...state,
    phase,
    updatedAt: new Date().toISOString()
  }
}

/**
 * Records an error in the review state
 */
export function recordError(
  state: ReviewState,
  error: string,
  type: 'rate_limit' | 'timeout' | 'network' | 'api_error' | 'unknown'
): ReviewState {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
    lastError: {
      message: error,
      timestamp: new Date().toISOString(),
      type
    }
  }
}

/**
 * Serializes review state to JSON string for storage in GitHub comments
 */
export function serializeState(state: ReviewState): string {
  return JSON.stringify(state, null, 2)
}

/**
 * Deserializes review state from JSON string stored in GitHub comments
 */
export function deserializeState(json: string): ReviewState | null {
  try {
    const state = JSON.parse(json) as ReviewState

    // Validate required fields
    if (
      !state.version ||
      !state.startedAt ||
      !state.commitId ||
      !Array.isArray(state.files)
    ) {
      return null
    }

    // Version check - only support v1.0 for now
    if (state.version !== '1.0') {
      return null
    }

    return state
  } catch {
    return null
  }
}

/**
 * Returns a list of files that still need processing based on current phase
 */
export function getFilesToProcess(state: ReviewState): FileReviewStatus[] {
  if (state.phase === 'summarizing') {
    // In summarizing phase, process files that are pending or failed
    return state.files.filter(
      f =>
        f.status === 'pending' ||
        f.status === 'failed' ||
        f.status === 'summarizing'
    )
  } else {
    // In reviewing phase, process files that need review (summarized but not yet reviewed)
    return state.files.filter(
      f => f.status === 'summarized' || f.status === 'reviewing'
    )
  }
}

/**
 * Returns a progress summary string for display
 */
export function getProgressSummary(state: ReviewState): string {
  const completed = state.completedFiles
  const total = state.totalFiles
  const failed = state.failedFiles
  const skipped = state.skippedFiles
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

  let summary = `Progress: ${completed}/${total} files (${percentage}%)`

  if (skipped > 0) {
    summary += ` • ${skipped} skipped`
  }

  if (failed > 0) {
    summary += ` • ${failed} failed`
  }

  if (state.lastError) {
    summary += `\n⚠️ Last error: ${state.lastError.message}`
  }

  return summary
}

/**
 * Checks if the review is complete (all files processed)
 */
export function isReviewComplete(state: ReviewState): boolean {
  return state.completedFiles + state.failedFiles === state.totalFiles
}

/**
 * Checks if two states are for the same review (same commit and files)
 */
export function isSameReview(
  state1: ReviewState | null,
  state2: ReviewState | null
): boolean {
  if (!state1 || !state2) {
    return false
  }

  // Must be reviewing the same commit
  if (state1.commitId !== state2.commitId) {
    return false
  }

  // Must have the same files
  if (state1.files.length !== state2.files.length) {
    return false
  }

  const files1 = new Set(state1.files.map(f => f.filename))
  const files2 = new Set(state2.files.map(f => f.filename))

  for (const filename of files1) {
    if (!files2.has(filename)) {
      return false
    }
  }

  return true
}

/**
 * Classifies an error into a specific error type for better handling
 */
export function classifyError(
  error: any
): 'rate_limit' | 'timeout' | 'network' | 'api_error' | 'unknown' {
  const errorStr = String(error).toLowerCase()

  if (errorStr.includes('rate limit') || errorStr.includes('429')) {
    return 'rate_limit'
  }

  if (errorStr.includes('timeout') || errorStr.includes('timed out')) {
    return 'timeout'
  }

  if (
    errorStr.includes('network') ||
    errorStr.includes('econnreset') ||
    errorStr.includes('enotfound') ||
    errorStr.includes('econnrefused')
  ) {
    return 'network'
  }

  if (
    errorStr.includes('api error') ||
    errorStr.includes('bad request') ||
    errorStr.includes('invalid')
  ) {
    return 'api_error'
  }

  return 'unknown'
}
