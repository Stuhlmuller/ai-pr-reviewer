import {expect, describe, test, beforeEach, jest} from '@jest/globals'
import {info} from '@actions/core'
import {Options, PathFilter, OpenAIOptions} from '../src/options'
import {TokenLimits} from '../src/limits'

// Mock @actions/core
jest.mock('@actions/core', () => ({
  info: jest.fn()
}))

describe('Options', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    test('should initialize with default values', () => {
      const options = new Options(false, false, false)
      expect(options.debug).toBe(false)
      expect(options.disableReview).toBe(false)
      expect(options.disableReleaseNotes).toBe(false)
      expect(options.maxFiles).toBe(0)
      expect(options.reviewSimpleChanges).toBe(false)
      expect(options.reviewCommentLGTM).toBe(false)
      expect(options.systemMessage).toBe('')
      expect(options.openaiLightModel).toBe('gpt-3.5-turbo')
      expect(options.openaiHeavyModel).toBe('gpt-3.5-turbo')
      expect(options.openaiModelTemperature).toBe(0.0)
      expect(options.openaiRetries).toBe(3)
      expect(options.openaiTimeoutMS).toBe(120000)
      expect(options.openaiConcurrencyLimit).toBe(6)
      expect(options.githubConcurrencyLimit).toBe(6)
      expect(options.apiBaseUrl).toBe('https://api.openai.com/v1')
      expect(options.language).toBe('en-US')
      expect(options.pathFilters).toBeInstanceOf(PathFilter)
      expect(options.lightTokenLimits).toBeInstanceOf(TokenLimits)
      expect(options.heavyTokenLimits).toBeInstanceOf(TokenLimits)
    })

    test('should initialize with custom values', () => {
      const options = new Options(
        true,
        true,
        true,
        '10',
        true,
        true,
        ['*.ts', '!*.test.ts'],
        'system message',
        'gpt-4',
        'gpt-4',
        '0.5',
        '5',
        '60000',
        '10',
        '8',
        'https://custom.api.com',
        'fr-FR'
      )
      expect(options.debug).toBe(true)
      expect(options.disableReview).toBe(true)
      expect(options.disableReleaseNotes).toBe(true)
      expect(options.maxFiles).toBe(10)
      expect(options.reviewSimpleChanges).toBe(true)
      expect(options.reviewCommentLGTM).toBe(true)
      expect(options.systemMessage).toBe('system message')
      expect(options.openaiLightModel).toBe('gpt-4')
      expect(options.openaiHeavyModel).toBe('gpt-4')
      expect(options.openaiModelTemperature).toBe(0.5)
      expect(options.openaiRetries).toBe(5)
      expect(options.openaiTimeoutMS).toBe(60000)
      expect(options.openaiConcurrencyLimit).toBe(10)
      expect(options.githubConcurrencyLimit).toBe(8)
      expect(options.apiBaseUrl).toBe('https://custom.api.com')
      expect(options.language).toBe('fr-FR')
    })

    test('should parse numeric string values', () => {
      const options = new Options(
        false,
        false,
        false,
        '20',
        false,
        false,
        null,
        '',
        'gpt-3.5-turbo',
        'gpt-3.5-turbo',
        '0.7',
        '4',
        '90000',
        '8',
        '5'
      )
      expect(options.maxFiles).toBe(20)
      expect(options.openaiModelTemperature).toBe(0.7)
      expect(options.openaiRetries).toBe(4)
      expect(options.openaiTimeoutMS).toBe(90000)
      expect(options.openaiConcurrencyLimit).toBe(8)
      expect(options.githubConcurrencyLimit).toBe(5)
    })

    test('should create TokenLimits for light and heavy models', () => {
      const options = new Options(
        false,
        false,
        false,
        '0',
        false,
        false,
        null,
        '',
        'gpt-4',
        'gpt-4-32k'
      )
      expect(options.lightTokenLimits.maxTokens).toBe(8000)
      expect(options.heavyTokenLimits.maxTokens).toBe(32600)
    })
  })

  describe('print', () => {
    test('should print all options using core.info', () => {
      jest.clearAllMocks() // Clear any previous calls
      const options = new Options(true, false, true, '5')
      options.print()

      // Options.print() calls info 29 times (22 original + 7 smart review options)
      expect(info).toHaveBeenCalledTimes(29)
      expect(info).toHaveBeenCalledWith('debug: true')
      expect(info).toHaveBeenCalledWith('disable_review: false')
      expect(info).toHaveBeenCalledWith('disable_release_notes: true')
      expect(info).toHaveBeenCalledWith('max_files: 5')
    })
  })

  describe('checkPath', () => {
    test('should delegate to pathFilters.check', () => {
      const options = new Options(false, false, false)
      const result = options.checkPath('src/file.ts')
      expect(result).toBe(true) // default PathFilter returns true
      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('checking path: src/file.ts')
      )
    })

    test('should check path with filters', () => {
      const options = new Options(false, false, false, '0', false, false, [
        '*.ts',
        '!*.test.ts'
      ])
      // *.ts matches, and !*.test.ts excludes test files
      expect(options.checkPath('file.ts')).toBe(true)
      expect(options.checkPath('file.test.ts')).toBe(false)
    })
  })
})

describe('PathFilter', () => {
  describe('constructor', () => {
    test('should initialize with empty rules when null provided', () => {
      const filter = new PathFilter(null)
      expect(filter.check('any/path')).toBe(true)
    })

    test('should initialize with empty rules when empty array provided', () => {
      const filter = new PathFilter([])
      expect(filter.check('any/path')).toBe(true)
    })

    test('should parse inclusion rules', () => {
      const filter = new PathFilter(['*.ts', '*.js'])
      expect(filter.check('file.ts')).toBe(true)
      expect(filter.check('file.js')).toBe(true)
    })

    test('should parse exclusion rules', () => {
      const filter = new PathFilter(['!*.test.ts'])
      expect(filter.check('file.ts')).toBe(true)
      expect(filter.check('file.test.ts')).toBe(false)
    })

    test('should parse mixed inclusion and exclusion rules', () => {
      const filter = new PathFilter(['*.ts', '!*.test.ts'])
      expect(filter.check('file.ts')).toBe(true)
      expect(filter.check('file.test.ts')).toBe(false)
    })

    test('should trim whitespace from rules', () => {
      const filter = new PathFilter(['  *.ts  ', '  !*.test.ts  '])
      expect(filter.check('file.ts')).toBe(true)
      expect(filter.check('file.test.ts')).toBe(false)
    })

    test('should ignore empty rules', () => {
      const filter = new PathFilter(['*.ts', '', '   ', '*.js'])
      expect(filter.check('file.ts')).toBe(true)
      expect(filter.check('file.js')).toBe(true)
    })

    test('should handle exclusion rule with whitespace', () => {
      const filter = new PathFilter(['!  *.test.ts  '])
      expect(filter.check('file.test.ts')).toBe(false)
    })
  })

  describe('check', () => {
    test('should return true when no rules are defined', () => {
      const filter = new PathFilter()
      expect(filter.check('any/path/to/file.ts')).toBe(true)
    })

    test('should return true for matching inclusion rule', () => {
      const filter = new PathFilter(['src/**/*.ts'])
      expect(filter.check('src/components/Button.ts')).toBe(true)
      expect(filter.check('tests/Button.test.ts')).toBe(false)
    })

    test('should return false for matching exclusion rule', () => {
      const filter = new PathFilter(['*.ts', '!*.test.ts'])
      // *.ts only matches files in root, not subdirectories
      expect(filter.check('file.ts')).toBe(true)
      expect(filter.check('file.test.ts')).toBe(false)
    })

    test('should handle exclusion rule without inclusion rules', () => {
      const filter = new PathFilter(['!*.test.ts'])
      expect(filter.check('file.test.ts')).toBe(false)
      expect(filter.check('file.ts')).toBe(true)
    })

    test('should handle multiple inclusion rules', () => {
      const filter = new PathFilter(['*.ts', '*.js'])
      expect(filter.check('file.ts')).toBe(true)
      expect(filter.check('file.js')).toBe(true)
      expect(filter.check('file.py')).toBe(false)
    })

    test('should handle complex patterns', () => {
      const filter = new PathFilter(['src/**', '!src/**/*.test.ts'])
      expect(filter.check('src/components/Button.ts')).toBe(true)
      expect(filter.check('src/components/Button.test.ts')).toBe(false)
      expect(filter.check('lib/utils.ts')).toBe(false)
    })

    test('should exclude if any exclusion rule matches', () => {
      const filter = new PathFilter([
        'src/**/*.ts',
        '!src/**/*.test.ts',
        '!src/**/*.spec.ts'
      ])
      expect(filter.check('src/file.ts')).toBe(true)
      expect(filter.check('src/file.test.ts')).toBe(false)
      expect(filter.check('src/file.spec.ts')).toBe(false)
    })

    test('should include if inclusion rule exists and matches', () => {
      const filter = new PathFilter(['*.ts', '*.js', '!*.test.ts'])
      expect(filter.check('file.ts')).toBe(true)
      expect(filter.check('file.js')).toBe(true)
    })

    test('should exclude even if inclusion rule matches when exclusion also matches', () => {
      const filter = new PathFilter(['*.ts', '!*.test.ts'])
      expect(filter.check('file.test.ts')).toBe(false)
    })
  })
})

describe('OpenAIOptions', () => {
  describe('constructor', () => {
    test('should initialize with default model', () => {
      const options = new OpenAIOptions()
      expect(options.model).toBe('gpt-3.5-turbo')
      expect(options.tokenLimits).toBeInstanceOf(TokenLimits)
      expect(options.tokenLimits.maxTokens).toBe(16385)
    })

    test('should initialize with custom model', () => {
      const options = new OpenAIOptions('gpt-4')
      expect(options.model).toBe('gpt-4')
      expect(options.tokenLimits).toBeInstanceOf(TokenLimits)
      expect(options.tokenLimits.maxTokens).toBe(8000)
    })

    test('should use provided tokenLimits when provided', () => {
      const customLimits = new TokenLimits('gpt-4-32k')
      const options = new OpenAIOptions('gpt-4', customLimits)
      expect(options.model).toBe('gpt-4')
      expect(options.tokenLimits).toBe(customLimits)
      expect(options.tokenLimits.maxTokens).toBe(32600)
    })

    test('should create TokenLimits from model when tokenLimits not provided', () => {
      const options = new OpenAIOptions('gpt-4-32k', null)
      expect(options.model).toBe('gpt-4-32k')
      expect(options.tokenLimits).toBeInstanceOf(TokenLimits)
      expect(options.tokenLimits.maxTokens).toBe(32600)
    })
  })
})
