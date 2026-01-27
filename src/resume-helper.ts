/**
 * Resume Helper Module
 *
 * Provides utility functions for filtering files based on review state
 * to enable resume capability.
 */

import {info} from '@actions/core'
import {type ReviewState, getFilesToProcess} from './review-state'

/**
 * Filters files based on review state to skip already-processed files
 *
 * @param files - All files in the PR
 * @param reviewState - Current review state (null if starting fresh)
 * @param phase - Current phase: 'summarizing' or 'reviewing'
 * @returns Filtered list of files that need processing
 */
export function filterFilesForResume(
  files: Array<{filename: string}>,
  reviewState: ReviewState | null,
  phase: 'summarizing' | 'reviewing'
): Array<{filename: string}> {
  if (reviewState == null) {
    // No existing state, process all files
    return files
  }

  // Get files that still need processing from review state
  const filesToProcess = getFilesToProcess(reviewState)
  const filenamesToProcess = new Set(filesToProcess.map(f => f.filename))

  // Filter the input files to only include those that need processing
  const filteredFiles = files.filter(f => filenamesToProcess.has(f.filename))

  const skippedCount = files.length - filteredFiles.length
  if (skippedCount > 0) {
    info(
      `Resume: Skipping ${skippedCount} already-processed files in ${phase} phase`
    )
    info(
      `Resume: Processing ${
        filteredFiles.length
      } remaining files: ${filteredFiles.map(f => f.filename).join(', ')}`
    )
  }

  return filteredFiles
}

/**
 * Checks if a review should be resumed based on options and existing state
 *
 * @param enableResume - Whether resume is enabled in options
 * @param reviewState - Existing review state (null if none)
 * @returns true if resume should be attempted
 */
export function shouldResumeReview(
  enableResume: boolean,
  reviewState: ReviewState | null
): boolean {
  if (!enableResume) {
    return false
  }

  if (reviewState == null) {
    return false
  }

  // Resume if there are incomplete files
  const filesToProcess = getFilesToProcess(reviewState)
  return filesToProcess.length > 0
}
