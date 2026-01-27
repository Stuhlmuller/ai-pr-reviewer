/**
 * Tests for resume helper functions
 */

import {filterFilesForResume, shouldResumeReview} from '../src/resume-helper'
import {createReviewState, updateFileStatus} from '../src/review-state'

describe('resume-helper', () => {
  describe('filterFilesForResume', () => {
    it('should return all files when no review state exists', () => {
      const files = [{filename: 'file1.ts'}, {filename: 'file2.ts'}]
      const result = filterFilesForResume(files, null, 'summarizing')
      expect(result).toEqual(files)
    })

    it('should filter out completed files in summarizing phase', () => {
      const files = [
        {filename: 'file1.ts'},
        {filename: 'file2.ts'},
        {filename: 'file3.ts'}
      ]

      const state = createReviewState('abc123', files)
      const updatedState = updateFileStatus(state, 'file1.ts', 'reviewed')

      const result = filterFilesForResume(files, updatedState, 'summarizing')

      // Should only return pending/failed files (file2 and file3)
      expect(result.length).toBe(2)
      expect(result.map(f => f.filename)).toEqual(
        expect.arrayContaining(['file2.ts', 'file3.ts'])
      )
      expect(result.some(f => f.filename === 'file1.ts')).toBe(false)
    })

    it('should include failed files in summarizing phase', () => {
      const files = [{filename: 'file1.ts'}, {filename: 'file2.ts'}]

      const state = createReviewState('abc123', files)
      const updatedState = updateFileStatus(state, 'file1.ts', 'failed', {
        error: 'Timeout'
      })

      const result = filterFilesForResume(files, updatedState, 'summarizing')

      // Should include failed file
      expect(result.length).toBe(2)
      expect(result.some(f => f.filename === 'file1.ts')).toBe(true)
    })

    it('should filter out reviewed files in reviewing phase', () => {
      const files = [{filename: 'file1.ts'}, {filename: 'file2.ts'}]

      const state = {
        ...createReviewState('abc123', files),
        phase: 'reviewing' as const
      }
      let updatedState = updateFileStatus(state, 'file1.ts', 'reviewed')
      updatedState = updateFileStatus(updatedState, 'file2.ts', 'summarized')

      const result = filterFilesForResume(files, updatedState, 'reviewing')

      // Should only return summarized files needing review
      expect(result.length).toBe(1)
      expect(result[0].filename).toBe('file2.ts')
    })

    it('should handle empty file list', () => {
      const files: Array<{filename: string}> = []
      const state = createReviewState('abc123', files)
      const result = filterFilesForResume(files, state, 'summarizing')
      expect(result).toEqual([])
    })

    it('should preserve file order', () => {
      const files = [{filename: 'a.ts'}, {filename: 'b.ts'}, {filename: 'c.ts'}]

      const state = createReviewState('abc123', files)
      const updatedState = updateFileStatus(state, 'b.ts', 'reviewed')

      const result = filterFilesForResume(files, updatedState, 'summarizing')

      // Should maintain original order
      expect(result.map(f => f.filename)).toEqual(['a.ts', 'c.ts'])
    })
  })

  describe('shouldResumeReview', () => {
    it('should return false when resume is disabled', () => {
      const state = createReviewState('abc123', [{filename: 'file1.ts'}])
      expect(shouldResumeReview(false, state)).toBe(false)
    })

    it('should return false when no review state exists', () => {
      expect(shouldResumeReview(true, null)).toBe(false)
    })

    it('should return true when resume is enabled and files need processing', () => {
      const state = createReviewState('abc123', [{filename: 'file1.ts'}])
      expect(shouldResumeReview(true, state)).toBe(true)
    })

    it('should return false when all files are completed', () => {
      const state = createReviewState('abc123', [{filename: 'file1.ts'}])
      const updatedState = updateFileStatus(state, 'file1.ts', 'reviewed')

      expect(shouldResumeReview(true, updatedState)).toBe(false)
    })

    it('should return true when some files failed', () => {
      const state = createReviewState('abc123', [
        {filename: 'file1.ts'},
        {filename: 'file2.ts'}
      ])
      let updatedState = updateFileStatus(state, 'file1.ts', 'reviewed')
      updatedState = updateFileStatus(updatedState, 'file2.ts', 'failed', {
        error: 'Rate limit'
      })

      expect(shouldResumeReview(true, updatedState)).toBe(true)
    })
  })
})
