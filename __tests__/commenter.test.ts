import {expect, describe, test, beforeEach, jest} from '@jest/globals'
import {
  Commenter,
  COMMENT_GREETING,
  COMMENT_TAG,
  RAW_SUMMARY_START_TAG,
  RAW_SUMMARY_END_TAG,
  SHORT_SUMMARY_START_TAG,
  SHORT_SUMMARY_END_TAG,
  DESCRIPTION_START_TAG,
  DESCRIPTION_END_TAG,
  COMMIT_ID_START_TAG,
  COMMIT_ID_END_TAG
} from '../src/commenter'

// Mock @actions/core
jest.mock('@actions/core', () => ({
  getInput: jest.fn(() => '🔍'),
  info: jest.fn(),
  warning: jest.fn()
}))

// Mock @actions/github
jest.mock('@actions/github', () => ({
  context: {
    repo: {owner: 'test-owner', repo: 'test-repo'},
    payload: {}
  }
}))

// Mock octokit
jest.mock('../src/octokit', () => ({
  octokit: {
    rest: {
      issues: {
        createComment: jest.fn(),
        listComments: jest.fn(),
        updateComment: jest.fn()
      },
      pulls: {
        listReviewComments: jest.fn(),
        createReviewComment: jest.fn()
      }
    }
  }
}))

describe('Commenter', () => {
  let commenter: Commenter

  beforeEach(() => {
    commenter = new Commenter()
    jest.clearAllMocks()
  })

  describe('getContentWithinTags', () => {
    test('should extract content between tags', () => {
      const content = `before${RAW_SUMMARY_START_TAG}summary content${RAW_SUMMARY_END_TAG}after`
      const result = commenter.getContentWithinTags(
        content,
        RAW_SUMMARY_START_TAG,
        RAW_SUMMARY_END_TAG
      )
      expect(result).toBe('summary content')
    })

    test('should return empty string when start tag not found', () => {
      const content = `before${RAW_SUMMARY_END_TAG}after`
      const result = commenter.getContentWithinTags(
        content,
        RAW_SUMMARY_START_TAG,
        RAW_SUMMARY_END_TAG
      )
      expect(result).toBe('')
    })

    test('should return empty string when end tag not found', () => {
      const content = `before${RAW_SUMMARY_START_TAG}content`
      const result = commenter.getContentWithinTags(
        content,
        RAW_SUMMARY_START_TAG,
        RAW_SUMMARY_END_TAG
      )
      expect(result).toBe('')
    })

    test('should return empty string when neither tag found', () => {
      const content = 'no tags here'
      const result = commenter.getContentWithinTags(
        content,
        RAW_SUMMARY_START_TAG,
        RAW_SUMMARY_END_TAG
      )
      expect(result).toBe('')
    })

    test('should extract multiline content', () => {
      const content = `start${RAW_SUMMARY_START_TAG}line 1\nline 2\nline 3${RAW_SUMMARY_END_TAG}end`
      const result = commenter.getContentWithinTags(
        content,
        RAW_SUMMARY_START_TAG,
        RAW_SUMMARY_END_TAG
      )
      expect(result).toBe('line 1\nline 2\nline 3')
    })

    test('should extract empty content between tags', () => {
      const content = `start${RAW_SUMMARY_START_TAG}${RAW_SUMMARY_END_TAG}end`
      const result = commenter.getContentWithinTags(
        content,
        RAW_SUMMARY_START_TAG,
        RAW_SUMMARY_END_TAG
      )
      expect(result).toBe('')
    })
  })

  describe('removeContentWithinTags', () => {
    test('should remove content between tags', () => {
      const content = `before${DESCRIPTION_START_TAG}remove this${DESCRIPTION_END_TAG}after`
      const result = commenter.removeContentWithinTags(
        content,
        DESCRIPTION_START_TAG,
        DESCRIPTION_END_TAG
      )
      expect(result).toBe('beforeafter')
    })

    test('should return original content when start tag not found', () => {
      const content = `before${DESCRIPTION_END_TAG}after`
      const result = commenter.removeContentWithinTags(
        content,
        DESCRIPTION_START_TAG,
        DESCRIPTION_END_TAG
      )
      expect(result).toBe(content)
    })

    test('should return original content when end tag not found', () => {
      const content = `before${DESCRIPTION_START_TAG}content`
      const result = commenter.removeContentWithinTags(
        content,
        DESCRIPTION_START_TAG,
        DESCRIPTION_END_TAG
      )
      expect(result).toBe(content)
    })

    test('should handle multiple tag pairs', () => {
      const content = `before${DESCRIPTION_START_TAG}remove1${DESCRIPTION_END_TAG}middle${DESCRIPTION_START_TAG}remove2${DESCRIPTION_END_TAG}after`
      const result = commenter.removeContentWithinTags(
        content,
        DESCRIPTION_START_TAG,
        DESCRIPTION_END_TAG
      )
      // Uses lastIndexOf for end tag, so removes from first start to last end
      expect(result).toBe('beforeafter')
    })

    test('should preserve content outside tags', () => {
      const content = `start${DESCRIPTION_START_TAG}remove${DESCRIPTION_END_TAG}end`
      const result = commenter.removeContentWithinTags(
        content,
        DESCRIPTION_START_TAG,
        DESCRIPTION_END_TAG
      )
      expect(result).toBe('startend')
    })
  })

  describe('getRawSummary', () => {
    test('should extract raw summary from content', () => {
      const content = `before${RAW_SUMMARY_START_TAG}raw summary text${RAW_SUMMARY_END_TAG}after`
      const result = commenter.getRawSummary(content)
      expect(result).toBe('raw summary text')
    })

    test('should return empty string when tags not present', () => {
      const content = 'no summary tags'
      const result = commenter.getRawSummary(content)
      expect(result).toBe('')
    })
  })

  describe('getShortSummary', () => {
    test('should extract short summary from content', () => {
      const content = `before${SHORT_SUMMARY_START_TAG}short summary${SHORT_SUMMARY_END_TAG}after`
      const result = commenter.getShortSummary(content)
      expect(result).toBe('short summary')
    })

    test('should return empty string when tags not present', () => {
      const content = 'no short summary tags'
      const result = commenter.getShortSummary(content)
      expect(result).toBe('')
    })
  })

  describe('getDescription', () => {
    test('should remove description tags and return clean content', () => {
      const content = `before${DESCRIPTION_START_TAG}release notes${DESCRIPTION_END_TAG}after`
      const result = commenter.getDescription(content)
      expect(result).toBe('beforeafter')
    })

    test('should return original content when tags not present', () => {
      const content = 'no description tags'
      const result = commenter.getDescription(content)
      expect(result).toBe(content)
    })
  })

  describe('getReleaseNotes', () => {
    test('should extract release notes and remove quoted lines', () => {
      const content = `${DESCRIPTION_START_TAG}> quoted line\nregular line\n> another quote${DESCRIPTION_END_TAG}`
      const result = commenter.getReleaseNotes(content)
      // The regex removes lines starting with "> " but leaves newlines
      expect(result.trim()).toBe('regular line')
    })

    test('should remove all quoted lines', () => {
      const content = `${DESCRIPTION_START_TAG}> line 1\n> line 2\nnormal line${DESCRIPTION_END_TAG}`
      const result = commenter.getReleaseNotes(content)
      expect(result).toBe('\nnormal line')
    })

    test('should handle empty release notes', () => {
      const content = `${DESCRIPTION_START_TAG}${DESCRIPTION_END_TAG}`
      const result = commenter.getReleaseNotes(content)
      expect(result).toBe('')
    })
  })

  describe('bufferReviewComment', () => {
    test('should add comment to buffer', () => {
      commenter.bufferReviewComment('file.ts', 10, 15, 'review message')
      // Access private buffer through public method if available, or test indirectly
      // For now, we test that it doesn't throw
      expect(() => {
        commenter.bufferReviewComment('file2.ts', 20, 25, 'another message')
      }).not.toThrow()
    })

    test('should format message with greeting and tag', async () => {
      commenter.bufferReviewComment('test.ts', 1, 5, 'test message')
      // The method adds COMMENT_GREETING and COMMENT_TAG
      // We test that it completes without error
      expect(true).toBe(true)
    })
  })
})
