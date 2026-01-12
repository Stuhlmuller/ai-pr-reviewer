import {
  createReviewState,
  updateFileStatus,
  updatePhase,
  recordError,
  serializeState,
  deserializeState,
  getFilesToProcess,
  getProgressSummary,
  isReviewComplete,
  isSameReview,
  classifyError,
  type ReviewState,
  type FileReviewStatus
} from '../src/review-state'

describe('review-state', () => {
  const mockFiles = [
    {filename: 'src/file1.ts'},
    {filename: 'src/file2.ts'},
    {filename: 'src/file3.ts'}
  ]

  describe('createReviewState', () => {
    it('should create initial review state', () => {
      const state = createReviewState('abc123', mockFiles)

      expect(state.version).toBe('1.0')
      expect(state.commitId).toBe('abc123')
      expect(state.totalFiles).toBe(3)
      expect(state.completedFiles).toBe(0)
      expect(state.failedFiles).toBe(0)
      expect(state.skippedFiles).toBe(0)
      expect(state.phase).toBe('summarizing')
      expect(state.files).toHaveLength(3)
      expect(state.files[0].status).toBe('pending')
      expect(state.lastError).toBeUndefined()
    })

    it('should set timestamps correctly', () => {
      const state = createReviewState('abc123', mockFiles)

      // Verify timestamps are in ISO 8601 format
      expect(state.startedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      )
      expect(state.updatedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      )
      expect(state.updatedAt).toBe(state.startedAt)
    })
  })

  describe('updateFileStatus', () => {
    it('should update file status from pending to summarized', () => {
      let state = createReviewState('abc123', mockFiles)
      state = updateFileStatus(state, 'src/file1.ts', 'summarized')

      const file = state.files.find(f => f.filename === 'src/file1.ts')
      expect(file?.status).toBe('summarized')
      expect(state.completedFiles).toBe(0) // summarized is not completed yet
    })

    it('should update file status from summarized to reviewed', () => {
      let state = createReviewState('abc123', mockFiles)
      state = updateFileStatus(state, 'src/file1.ts', 'summarized')
      state = updateFileStatus(state, 'src/file1.ts', 'reviewed')

      const file = state.files.find(f => f.filename === 'src/file1.ts')
      expect(file?.status).toBe('reviewed')
      expect(state.completedFiles).toBe(1)
    })

    it('should update file status to skipped with metadata', () => {
      let state = createReviewState('abc123', mockFiles)
      state = updateFileStatus(state, 'src/file1.ts', 'skipped', {
        skipConfidence: 95,
        skipReason: 'Generated file'
      })

      const file = state.files.find(f => f.filename === 'src/file1.ts')
      expect(file?.status).toBe('skipped')
      expect(file?.skipConfidence).toBe(95)
      expect(file?.skipReason).toBe('Generated file')
      expect(state.completedFiles).toBe(1)
      expect(state.skippedFiles).toBe(1)
    })

    it('should update file status to failed with error', () => {
      let state = createReviewState('abc123', mockFiles)
      state = updateFileStatus(state, 'src/file1.ts', 'failed', {
        error: 'API rate limit exceeded'
      })

      const file = state.files.find(f => f.filename === 'src/file1.ts')
      expect(file?.status).toBe('failed')
      expect(file?.error).toBe('API rate limit exceeded')
      expect(state.failedFiles).toBe(1)
      expect(state.completedFiles).toBe(0)
    })

    it('should throw error for non-existent file', () => {
      const state = createReviewState('abc123', mockFiles)

      expect(() => {
        updateFileStatus(state, 'nonexistent.ts', 'reviewed')
      }).toThrow('File nonexistent.ts not found in review state')
    })

    it('should handle status transitions correctly', () => {
      let state = createReviewState('abc123', mockFiles)

      // pending -> failed
      state = updateFileStatus(state, 'src/file1.ts', 'failed')
      expect(state.failedFiles).toBe(1)
      expect(state.completedFiles).toBe(0)

      // failed -> reviewed
      state = updateFileStatus(state, 'src/file1.ts', 'reviewed')
      expect(state.failedFiles).toBe(0)
      expect(state.completedFiles).toBe(1)

      // reviewed -> skipped (edge case)
      state = updateFileStatus(state, 'src/file1.ts', 'skipped')
      expect(state.completedFiles).toBe(1) // still completed
      expect(state.skippedFiles).toBe(1)
    })
  })

  describe('updatePhase', () => {
    it('should update phase from summarizing to reviewing', () => {
      let state = createReviewState('abc123', mockFiles)
      state = updatePhase(state, 'reviewing')

      expect(state.phase).toBe('reviewing')
      // Verify timestamp is in valid ISO 8601 format
      expect(state.updatedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      )
    })
  })

  describe('recordError', () => {
    it('should record an error with correct type', () => {
      let state = createReviewState('abc123', mockFiles)
      state = recordError(state, 'Rate limit exceeded', 'rate_limit')

      expect(state.lastError).toBeDefined()
      expect(state.lastError?.message).toBe('Rate limit exceeded')
      expect(state.lastError?.type).toBe('rate_limit')
      expect(state.lastError?.timestamp).toBeDefined()
    })

    it('should overwrite previous error', () => {
      let state = createReviewState('abc123', mockFiles)
      state = recordError(state, 'First error', 'network')
      state = recordError(state, 'Second error', 'timeout')

      expect(state.lastError?.message).toBe('Second error')
      expect(state.lastError?.type).toBe('timeout')
    })
  })

  describe('serializeState and deserializeState', () => {
    it('should serialize and deserialize state correctly', () => {
      const originalState = createReviewState('abc123', mockFiles)
      const serialized = serializeState(originalState)
      const deserialized = deserializeState(serialized)

      expect(deserialized).toEqual(originalState)
    })

    it('should handle state with errors', () => {
      let state = createReviewState('abc123', mockFiles)
      state = recordError(state, 'Test error', 'api_error')

      const serialized = serializeState(state)
      const deserialized = deserializeState(serialized)

      expect(deserialized?.lastError?.message).toBe('Test error')
      expect(deserialized?.lastError?.type).toBe('api_error')
    })

    it('should handle state with file status updates', () => {
      let state = createReviewState('abc123', mockFiles)
      state = updateFileStatus(state, 'src/file1.ts', 'reviewed')
      state = updateFileStatus(state, 'src/file2.ts', 'skipped', {
        skipConfidence: 90,
        skipReason: 'Test skip'
      })

      const serialized = serializeState(state)
      const deserialized = deserializeState(serialized)

      expect(deserialized?.files[0].status).toBe('reviewed')
      expect(deserialized?.files[1].status).toBe('skipped')
      expect(deserialized?.files[1].skipReason).toBe('Test skip')
    })

    it('should return null for invalid JSON', () => {
      const deserialized = deserializeState('invalid json {')
      expect(deserialized).toBeNull()
    })

    it('should return null for missing required fields', () => {
      const invalidState = {version: '1.0', startedAt: '2024-01-01'}
      const deserialized = deserializeState(JSON.stringify(invalidState))
      expect(deserialized).toBeNull()
    })

    it('should return null for unsupported version', () => {
      const state = createReviewState('abc123', mockFiles)
      const stateObj = JSON.parse(serializeState(state))
      stateObj.version = '2.0'
      const deserialized = deserializeState(JSON.stringify(stateObj))
      expect(deserialized).toBeNull()
    })
  })

  describe('getFilesToProcess', () => {
    it('should return pending files in summarizing phase', () => {
      const state = createReviewState('abc123', mockFiles)
      const files = getFilesToProcess(state)

      expect(files).toHaveLength(3)
      expect(files.every(f => f.status === 'pending')).toBe(true)
    })

    it('should return failed files in summarizing phase', () => {
      let state = createReviewState('abc123', mockFiles)
      state = updateFileStatus(state, 'src/file1.ts', 'failed')
      state = updateFileStatus(state, 'src/file2.ts', 'summarized')

      const files = getFilesToProcess(state)

      expect(files).toHaveLength(2) // pending file3 + failed file1
      expect(files.some(f => f.filename === 'src/file1.ts')).toBe(true)
      expect(files.some(f => f.filename === 'src/file3.ts')).toBe(true)
    })

    it('should return summarized files in reviewing phase', () => {
      let state = createReviewState('abc123', mockFiles)
      state = updateFileStatus(state, 'src/file1.ts', 'summarized')
      state = updateFileStatus(state, 'src/file2.ts', 'reviewed')
      state = updatePhase(state, 'reviewing')

      const files = getFilesToProcess(state)

      expect(files).toHaveLength(1)
      expect(files[0].filename).toBe('src/file1.ts')
    })

    it('should not return skipped or reviewed files', () => {
      let state = createReviewState('abc123', mockFiles)
      state = updateFileStatus(state, 'src/file1.ts', 'reviewed')
      state = updateFileStatus(state, 'src/file2.ts', 'skipped')

      const files = getFilesToProcess(state)

      expect(files).toHaveLength(1)
      expect(files[0].filename).toBe('src/file3.ts')
    })
  })

  describe('getProgressSummary', () => {
    it('should show basic progress', () => {
      let state = createReviewState('abc123', mockFiles)
      state = updateFileStatus(state, 'src/file1.ts', 'reviewed')

      const summary = getProgressSummary(state)

      expect(summary).toContain('Progress: 1/3 files (33%)')
    })

    it('should show skipped files', () => {
      let state = createReviewState('abc123', mockFiles)
      state = updateFileStatus(state, 'src/file1.ts', 'skipped')

      const summary = getProgressSummary(state)

      expect(summary).toContain('1 skipped')
    })

    it('should show failed files', () => {
      let state = createReviewState('abc123', mockFiles)
      state = updateFileStatus(state, 'src/file1.ts', 'failed')

      const summary = getProgressSummary(state)

      expect(summary).toContain('1 failed')
    })

    it('should show last error', () => {
      let state = createReviewState('abc123', mockFiles)
      state = recordError(state, 'API timeout', 'timeout')

      const summary = getProgressSummary(state)

      expect(summary).toContain('⚠️ Last error: API timeout')
    })

    it('should handle 100% completion', () => {
      let state = createReviewState('abc123', mockFiles)
      state = updateFileStatus(state, 'src/file1.ts', 'reviewed')
      state = updateFileStatus(state, 'src/file2.ts', 'reviewed')
      state = updateFileStatus(state, 'src/file3.ts', 'reviewed')

      const summary = getProgressSummary(state)

      expect(summary).toContain('Progress: 3/3 files (100%)')
    })

    it('should handle zero files', () => {
      const state = createReviewState('abc123', [])
      const summary = getProgressSummary(state)

      expect(summary).toContain('Progress: 0/0 files (0%)')
    })
  })

  describe('isReviewComplete', () => {
    it('should return false for incomplete review', () => {
      const state = createReviewState('abc123', mockFiles)
      expect(isReviewComplete(state)).toBe(false)
    })

    it('should return true when all files are reviewed', () => {
      let state = createReviewState('abc123', mockFiles)
      state = updateFileStatus(state, 'src/file1.ts', 'reviewed')
      state = updateFileStatus(state, 'src/file2.ts', 'reviewed')
      state = updateFileStatus(state, 'src/file3.ts', 'reviewed')

      expect(isReviewComplete(state)).toBe(true)
    })

    it('should return true when all files are skipped', () => {
      let state = createReviewState('abc123', mockFiles)
      state = updateFileStatus(state, 'src/file1.ts', 'skipped')
      state = updateFileStatus(state, 'src/file2.ts', 'skipped')
      state = updateFileStatus(state, 'src/file3.ts', 'skipped')

      expect(isReviewComplete(state)).toBe(true)
    })

    it('should return true when mix of reviewed, skipped, and failed', () => {
      let state = createReviewState('abc123', mockFiles)
      state = updateFileStatus(state, 'src/file1.ts', 'reviewed')
      state = updateFileStatus(state, 'src/file2.ts', 'skipped')
      state = updateFileStatus(state, 'src/file3.ts', 'failed')

      expect(isReviewComplete(state)).toBe(true)
    })
  })

  describe('isSameReview', () => {
    it('should return true for same review', () => {
      const state1 = createReviewState('abc123', mockFiles)
      const state2 = createReviewState('abc123', mockFiles)

      expect(isSameReview(state1, state2)).toBe(true)
    })

    it('should return false for different commit IDs', () => {
      const state1 = createReviewState('abc123', mockFiles)
      const state2 = createReviewState('def456', mockFiles)

      expect(isSameReview(state1, state2)).toBe(false)
    })

    it('should return false for different file lists', () => {
      const state1 = createReviewState('abc123', mockFiles)
      const state2 = createReviewState('abc123', [
        {filename: 'src/different.ts'}
      ])

      expect(isSameReview(state1, state2)).toBe(false)
    })

    it('should return false for different number of files', () => {
      const state1 = createReviewState('abc123', mockFiles)
      const state2 = createReviewState('abc123', [
        {filename: 'src/file1.ts'},
        {filename: 'src/file2.ts'}
      ])

      expect(isSameReview(state1, state2)).toBe(false)
    })

    it('should return false when either state is null', () => {
      const state = createReviewState('abc123', mockFiles)

      expect(isSameReview(state, null)).toBe(false)
      expect(isSameReview(null, state)).toBe(false)
      expect(isSameReview(null, null)).toBe(false)
    })
  })

  describe('classifyError', () => {
    it('should classify rate limit errors', () => {
      expect(classifyError('Rate limit exceeded')).toBe('rate_limit')
      expect(classifyError('Error 429: Too many requests')).toBe('rate_limit')
      expect(classifyError('RATE LIMIT ERROR')).toBe('rate_limit')
    })

    it('should classify timeout errors', () => {
      expect(classifyError('Request timed out')).toBe('timeout')
      expect(classifyError('Operation timeout')).toBe('timeout')
      expect(classifyError('TIMEOUT ERROR')).toBe('timeout')
    })

    it('should classify network errors', () => {
      expect(classifyError('Network error occurred')).toBe('network')
      expect(classifyError('Error: ECONNRESET')).toBe('network')
      expect(classifyError('Error: ENOTFOUND')).toBe('network')
      expect(classifyError('Error: ECONNREFUSED')).toBe('network')
    })

    it('should classify API errors', () => {
      expect(classifyError('API error: invalid request')).toBe('api_error')
      expect(classifyError('Bad request: missing parameter')).toBe('api_error')
      expect(classifyError('Invalid API key')).toBe('api_error')
    })

    it('should classify unknown errors', () => {
      expect(classifyError('Something went wrong')).toBe('unknown')
      expect(classifyError('Unexpected error')).toBe('unknown')
      expect(classifyError(new Error('Random error'))).toBe('unknown')
    })

    it('should handle error objects', () => {
      const error = new Error('Rate limit exceeded')
      expect(classifyError(error)).toBe('rate_limit')
    })
  })
})
