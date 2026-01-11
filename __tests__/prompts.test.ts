import {expect, describe, test} from '@jest/globals'
import {Prompts} from '../src/prompts'
import {Inputs} from '../src/inputs'

describe('Prompts', () => {
  describe('constructor', () => {
    test('should initialize with empty strings by default', () => {
      const prompts = new Prompts()
      expect(prompts.summarize).toBe('')
      expect(prompts.summarizeReleaseNotes).toBe('')
    })

    test('should initialize with custom values', () => {
      const prompts = new Prompts('custom summarize', 'custom release notes')
      expect(prompts.summarize).toBe('custom summarize')
      expect(prompts.summarizeReleaseNotes).toBe('custom release notes')
    })

    test('should initialize with partial values', () => {
      const prompts = new Prompts('summarize only')
      expect(prompts.summarize).toBe('summarize only')
      expect(prompts.summarizeReleaseNotes).toBe('')
    })
  })

  describe('renderSummarizeFileDiff', () => {
    test('should render prompt with inputs', () => {
      const prompts = new Prompts()
      const inputs = new Inputs(
        'system',
        'title',
        'description',
        '',
        '',
        'file.ts',
        '',
        'diff content'
      )
      const result = prompts.renderSummarizeFileDiff(inputs, true)

      expect(result).toContain('title')
      expect(result).toContain('description')
      expect(result).toContain('diff content')
      expect(result).not.toContain('[TRIAGE]')
    })

    test('should include triage section when reviewSimpleChanges is false', () => {
      const prompts = new Prompts()
      const inputs = new Inputs(
        'system',
        'title',
        'description',
        '',
        '',
        'file.ts',
        '',
        'diff content'
      )
      const result = prompts.renderSummarizeFileDiff(inputs, false)

      expect(result).toContain('[TRIAGE]')
      expect(result).toContain('NEEDS_REVIEW')
      expect(result).toContain('APPROVED')
    })

    test('should not include triage section when reviewSimpleChanges is true', () => {
      const prompts = new Prompts()
      const inputs = new Inputs(
        'system',
        'title',
        'description',
        '',
        '',
        'file.ts',
        '',
        'diff content'
      )
      const result = prompts.renderSummarizeFileDiff(inputs, true)

      expect(result).not.toContain('[TRIAGE]')
    })

    test('should replace all placeholders in inputs', () => {
      const prompts = new Prompts()
      const inputs = new Inputs(
        'system msg',
        'PR Title',
        'PR Description',
        '',
        '',
        'src/file.ts',
        '',
        'file diff content'
      )
      const result = prompts.renderSummarizeFileDiff(inputs, true)

      expect(result).toContain('PR Title')
      expect(result).toContain('PR Description')
      expect(result).toContain('file diff content')
    })
  })

  describe('renderSummarizeChangesets', () => {
    test('should render prompt with inputs', () => {
      const prompts = new Prompts()
      const inputs = new Inputs('', '', '', 'raw summary content')
      const result = prompts.renderSummarizeChangesets(inputs)

      expect(result).toContain('raw summary content')
    })

    test('should include changeset template', () => {
      const prompts = new Prompts()
      const inputs = new Inputs('', '', '', 'summary')
      const result = prompts.renderSummarizeChangesets(inputs)

      expect(result).toContain('changesets')
      expect(result).toContain('summary')
    })
  })

  describe('renderSummarize', () => {
    test('should render with custom summarize prompt', () => {
      const prompts = new Prompts('Custom summarize prompt')
      const inputs = new Inputs('', '', '', 'raw summary')
      const result = prompts.renderSummarize(inputs)

      expect(result).toContain('Custom summarize prompt')
      expect(result).toContain('raw summary')
    })

    test('should include summarizePrefix', () => {
      const prompts = new Prompts('custom prompt')
      const inputs = new Inputs('', '', '', 'raw summary')
      const result = prompts.renderSummarize(inputs)

      expect(result).toContain('summary of changes')
      expect(result).toContain('raw summary')
    })

    test('should render with empty summarize', () => {
      const prompts = new Prompts('')
      const inputs = new Inputs('', '', '', 'raw summary')
      const result = prompts.renderSummarize(inputs)

      expect(result).toContain('raw summary')
    })
  })

  describe('renderSummarizeShort', () => {
    test('should render short summary prompt', () => {
      const prompts = new Prompts()
      const inputs = new Inputs('', '', '', 'raw summary')
      const result = prompts.renderSummarizeShort(inputs)

      expect(result).toContain('concise summary')
      expect(result).toContain('raw summary')
      expect(result).toContain('500 words')
    })

    test('should include summarizePrefix', () => {
      const prompts = new Prompts()
      const inputs = new Inputs('', '', '', 'summary')
      const result = prompts.renderSummarizeShort(inputs)

      expect(result).toContain('summary of changes')
      expect(result).toContain('summary')
    })
  })

  describe('renderSummarizeReleaseNotes', () => {
    test('should render with custom release notes prompt', () => {
      const prompts = new Prompts('', 'Custom release notes prompt')
      const inputs = new Inputs('', '', '', 'raw summary')
      const result = prompts.renderSummarizeReleaseNotes(inputs)

      expect(result).toContain('Custom release notes prompt')
      expect(result).toContain('raw summary')
    })

    test('should include summarizePrefix', () => {
      const prompts = new Prompts('', 'release notes')
      const inputs = new Inputs('', '', '', 'raw summary')
      const result = prompts.renderSummarizeReleaseNotes(inputs)

      expect(result).toContain('summary of changes')
      expect(result).toContain('raw summary')
    })

    test('should render with empty release notes', () => {
      const prompts = new Prompts('', '')
      const inputs = new Inputs('', '', '', 'raw summary')
      const result = prompts.renderSummarizeReleaseNotes(inputs)

      expect(result).toContain('raw summary')
    })
  })

  describe('renderComment', () => {
    test('should render comment prompt with inputs', () => {
      const prompts = new Prompts()
      const inputs = new Inputs(
        'system',
        'title',
        'description',
        '',
        'short summary',
        'file.ts',
        'file content',
        'file diff',
        '',
        'diff',
        'comment chain',
        'comment'
      )
      const result = prompts.renderComment(inputs)

      expect(result).toContain('title')
      expect(result).toContain('description')
      expect(result).toContain('short summary')
      expect(result).toContain('file.ts')
      expect(result).toContain('file diff')
      expect(result).toContain('diff')
      expect(result).toContain('comment chain')
      expect(result).toContain('comment')
    })

    test('should include comment template structure', () => {
      const prompts = new Prompts()
      const inputs = new Inputs(
        '',
        'title',
        '',
        '',
        '',
        'file.ts',
        '',
        '',
        '',
        '',
        '',
        'comment'
      )
      const result = prompts.renderComment(inputs)

      expect(result).toContain('GitHub PR Title')
      expect(result).toContain('reply directly')
    })
  })

  describe('renderReviewFileDiff', () => {
    test('should render review prompt with inputs', () => {
      const prompts = new Prompts()
      const inputs = new Inputs(
        'system',
        'title',
        'description',
        '',
        'short summary',
        'file.ts',
        '',
        '',
        'patches',
        '',
        '',
        ''
      )
      const result = prompts.renderReviewFileDiff(inputs)

      expect(result).toContain('title')
      expect(result).toContain('description')
      expect(result).toContain('short summary')
      expect(result).toContain('patches')
    })

    test('should include review instructions', () => {
      const prompts = new Prompts()
      const inputs = new Inputs(
        '',
        'title',
        '',
        '',
        '',
        'file.ts',
        '',
        '',
        'patches'
      )
      const result = prompts.renderReviewFileDiff(inputs)

      expect(result).toContain('Review ALL new hunks')
      expect(result).toContain('LGTM!')
      expect(result).toContain('patches')
    })

    test('should include filename in prompt', () => {
      const prompts = new Prompts()
      const inputs = new Inputs(
        '',
        'title',
        '',
        '',
        '',
        'src/components/Button.ts',
        '',
        '',
        'patches'
      )
      const result = prompts.renderReviewFileDiff(inputs)

      expect(result).toContain('src/components/Button.ts')
    })
  })

  describe('prompt templates', () => {
    test('should have summarizeFileDiff template defined', () => {
      const prompts = new Prompts()
      expect(prompts.summarizeFileDiff).toBeTruthy()
      expect(prompts.summarizeFileDiff.length).toBeGreaterThan(0)
    })

    test('should have reviewFileDiff template defined', () => {
      const prompts = new Prompts()
      expect(prompts.reviewFileDiff).toBeTruthy()
      expect(prompts.reviewFileDiff.length).toBeGreaterThan(0)
    })

    test('should have comment template defined', () => {
      const prompts = new Prompts()
      expect(prompts.comment).toBeTruthy()
      expect(prompts.comment.length).toBeGreaterThan(0)
    })
  })
})
