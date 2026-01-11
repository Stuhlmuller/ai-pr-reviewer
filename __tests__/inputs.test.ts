import {expect, describe, test} from '@jest/globals'
import {Inputs} from '../src/inputs'

describe('Inputs', () => {
  describe('constructor', () => {
    test('should initialize with default values', () => {
      const inputs = new Inputs()
      expect(inputs.systemMessage).toBe('')
      expect(inputs.title).toBe('no title provided')
      expect(inputs.description).toBe('no description provided')
      expect(inputs.rawSummary).toBe('')
      expect(inputs.shortSummary).toBe('')
      expect(inputs.filename).toBe('')
      expect(inputs.fileContent).toBe('file contents cannot be provided')
      expect(inputs.fileDiff).toBe('file diff cannot be provided')
      expect(inputs.patches).toBe('')
      expect(inputs.diff).toBe('no diff')
      expect(inputs.commentChain).toBe('no other comments on this patch')
      expect(inputs.comment).toBe('no comment provided')
    })

    test('should initialize with custom values', () => {
      const inputs = new Inputs(
        'system msg',
        'title',
        'description',
        'raw summary',
        'short summary',
        'file.ts',
        'file content',
        'file diff',
        'patches',
        'diff',
        'comment chain',
        'comment'
      )
      expect(inputs.systemMessage).toBe('system msg')
      expect(inputs.title).toBe('title')
      expect(inputs.description).toBe('description')
      expect(inputs.rawSummary).toBe('raw summary')
      expect(inputs.shortSummary).toBe('short summary')
      expect(inputs.filename).toBe('file.ts')
      expect(inputs.fileContent).toBe('file content')
      expect(inputs.fileDiff).toBe('file diff')
      expect(inputs.patches).toBe('patches')
      expect(inputs.diff).toBe('diff')
      expect(inputs.commentChain).toBe('comment chain')
      expect(inputs.comment).toBe('comment')
    })

    test('should initialize with partial values', () => {
      const inputs = new Inputs('system', 'title')
      expect(inputs.systemMessage).toBe('system')
      expect(inputs.title).toBe('title')
      expect(inputs.description).toBe('no description provided')
      expect(inputs.comment).toBe('no comment provided')
    })
  })

  describe('clone', () => {
    test('should create a copy with same values', () => {
      const original = new Inputs(
        'system',
        'title',
        'desc',
        'raw',
        'short',
        'file.ts',
        'content',
        'diff',
        'patches',
        'diff2',
        'chain',
        'comment'
      )
      const cloned = original.clone()

      expect(cloned).not.toBe(original)
      expect(cloned.systemMessage).toBe(original.systemMessage)
      expect(cloned.title).toBe(original.title)
      expect(cloned.description).toBe(original.description)
      expect(cloned.rawSummary).toBe(original.rawSummary)
      expect(cloned.shortSummary).toBe(original.shortSummary)
      expect(cloned.filename).toBe(original.filename)
      expect(cloned.fileContent).toBe(original.fileContent)
      expect(cloned.fileDiff).toBe(original.fileDiff)
      expect(cloned.patches).toBe(original.patches)
      expect(cloned.diff).toBe(original.diff)
      expect(cloned.commentChain).toBe(original.commentChain)
      expect(cloned.comment).toBe(original.comment)
    })

    test('should create independent copy', () => {
      const original = new Inputs('system', 'title')
      const cloned = original.clone()

      cloned.systemMessage = 'new system'
      cloned.title = 'new title'

      expect(original.systemMessage).toBe('system')
      expect(original.title).toBe('title')
      expect(cloned.systemMessage).toBe('new system')
      expect(cloned.title).toBe('new title')
    })
  })

  describe('render', () => {
    test('should return empty string for empty content', () => {
      const inputs = new Inputs()
      const result = inputs.render('')
      expect(result).toBe('')
    })

    test('should replace system_message placeholder', () => {
      const inputs = new Inputs('test system message')
      const result = inputs.render('System: $system_message')
      expect(result).toBe('System: test system message')
    })

    test('should replace title placeholder', () => {
      const inputs = new Inputs('', 'My Title')
      const result = inputs.render('Title: $title')
      expect(result).toBe('Title: My Title')
    })

    test('should replace description placeholder', () => {
      const inputs = new Inputs('', '', 'My Description')
      const result = inputs.render('Desc: $description')
      expect(result).toBe('Desc: My Description')
    })

    test('should replace all placeholders', () => {
      const inputs = new Inputs(
        'system',
        'title',
        'description',
        'raw',
        'short',
        'file.ts',
        'content',
        'diff',
        'patches',
        'diff2',
        'chain',
        'comment'
      )
      const template =
        '$system_message $title $description $raw_summary $short_summary $filename $file_content $file_diff $patches $diff $comment_chain $comment'
      const result = inputs.render(template)

      expect(result).toContain('system')
      expect(result).toContain('title')
      expect(result).toContain('description')
      expect(result).toContain('raw')
      expect(result).toContain('short')
      expect(result).toContain('file.ts')
      expect(result).toContain('content')
      expect(result).toContain('diff')
      expect(result).toContain('patches')
      expect(result).toContain('diff2')
      expect(result).toContain('chain')
      expect(result).toContain('comment')
    })

    test('should handle multiple occurrences of same placeholder', () => {
      const inputs = new Inputs('', 'Test Title')
      const result = inputs.render('$title and $title again')
      // Note: The render method uses replace() which only replaces the first occurrence
      expect(result).toBe('Test Title and $title again')
    })

    test('should not replace placeholders for empty values', () => {
      const inputs = new Inputs() // all defaults/empty
      const result = inputs.render('Title: $title')
      // Should replace with default value
      expect(result).toBe('Title: no title provided')
    })

    test('should leave unknown placeholders unchanged', () => {
      const inputs = new Inputs()
      const result = inputs.render('Unknown: $unknown_placeholder')
      expect(result).toBe('Unknown: $unknown_placeholder')
    })

    test('should handle content with no placeholders', () => {
      const inputs = new Inputs('system', 'title')
      const result = inputs.render('Plain text with no placeholders')
      expect(result).toBe('Plain text with no placeholders')
    })

    test('should handle multiline content', () => {
      const inputs = new Inputs('system', 'title')
      const template = 'Line 1: $title\nLine 2: $system_message'
      const result = inputs.render(template)
      expect(result).toBe('Line 1: title\nLine 2: system')
    })
  })
})
