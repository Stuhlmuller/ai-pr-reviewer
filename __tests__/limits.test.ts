import {expect, describe, test} from '@jest/globals'
import {TokenLimits} from '../src/limits'

describe('TokenLimits', () => {
  describe('constructor', () => {
    test('should initialize with default gpt-3.5-turbo model', () => {
      const limits = new TokenLimits()
      expect(limits.maxTokens).toBe(16385)
      expect(limits.responseTokens).toBe(4096)
      expect(limits.requestTokens).toBe(12189) // 16385 - 4096 - 100
      expect(limits.knowledgeCutOff).toBe('2021-09-01')
    })

    test('should initialize with gpt-3.5-turbo model explicitly', () => {
      const limits = new TokenLimits('gpt-3.5-turbo')
      expect(limits.maxTokens).toBe(16385)
      expect(limits.responseTokens).toBe(4096)
      expect(limits.requestTokens).toBe(12189)
    })

    test('should initialize with gpt-4 model', () => {
      const limits = new TokenLimits('gpt-4')
      expect(limits.maxTokens).toBe(8000)
      expect(limits.responseTokens).toBe(2000)
      expect(limits.requestTokens).toBe(5900) // 8000 - 2000 - 100
    })

    test('should initialize with gpt-4-32k model', () => {
      const limits = new TokenLimits('gpt-4-32k')
      expect(limits.maxTokens).toBe(32600)
      expect(limits.responseTokens).toBe(4000)
      expect(limits.requestTokens).toBe(28500) // 32600 - 4000 - 100
    })

    test('should initialize with gpt-3.5-turbo-16k model', () => {
      const limits = new TokenLimits('gpt-3.5-turbo-16k')
      expect(limits.maxTokens).toBe(16300)
      expect(limits.responseTokens).toBe(3000)
      expect(limits.requestTokens).toBe(13200) // 16300 - 3000 - 100
    })

    test('should initialize with unknown model as default', () => {
      const limits = new TokenLimits('unknown-model')
      expect(limits.maxTokens).toBe(4000)
      expect(limits.responseTokens).toBe(1000)
      expect(limits.requestTokens).toBe(2900)
    })

    test('should set knowledgeCutOff based on model', () => {
      const limits1 = new TokenLimits('gpt-4')
      const limits2 = new TokenLimits('gpt-3.5-turbo')
      const limits3 = new TokenLimits('gpt-4o')
      expect(limits1.knowledgeCutOff).toBe('2021-09-01')
      expect(limits2.knowledgeCutOff).toBe('2021-09-01')
      expect(limits3.knowledgeCutOff).toBe('2024-10-01')
    })

    test('should initialize with gpt-4o model', () => {
      const limits = new TokenLimits('gpt-4o')
      expect(limits.maxTokens).toBe(128000)
      expect(limits.responseTokens).toBe(16384)
      expect(limits.requestTokens).toBe(111516) // 128000 - 16384 - 100
      expect(limits.knowledgeCutOff).toBe('2024-10-01')
    })

    test('should initialize with gpt-4o-mini model', () => {
      const limits = new TokenLimits('gpt-4o-mini')
      expect(limits.maxTokens).toBe(128000)
      expect(limits.responseTokens).toBe(16384)
      expect(limits.requestTokens).toBe(111516)
      expect(limits.knowledgeCutOff).toBe('2024-10-01')
    })

    test('should initialize with chatgpt-4o-latest model', () => {
      const limits = new TokenLimits('chatgpt-4o-latest')
      expect(limits.maxTokens).toBe(128000)
      expect(limits.responseTokens).toBe(16384)
      expect(limits.requestTokens).toBe(111516)
      expect(limits.knowledgeCutOff).toBe('2024-10-01')
    })

    test('should initialize with o1-preview model', () => {
      const limits = new TokenLimits('o1-preview')
      expect(limits.maxTokens).toBe(128000)
      expect(limits.responseTokens).toBe(32768)
      expect(limits.requestTokens).toBe(95132) // 128000 - 32768 - 100
      expect(limits.knowledgeCutOff).toBe('2024-10-01')
    })

    test('should initialize with o1-mini model', () => {
      const limits = new TokenLimits('o1-mini')
      expect(limits.maxTokens).toBe(128000)
      expect(limits.responseTokens).toBe(65536)
      expect(limits.requestTokens).toBe(62364) // 128000 - 65536 - 100
      expect(limits.knowledgeCutOff).toBe('2024-10-01')
    })

    test('should initialize with gpt-4-turbo model', () => {
      const limits = new TokenLimits('gpt-4-turbo')
      expect(limits.maxTokens).toBe(128000)
      expect(limits.responseTokens).toBe(4096)
      expect(limits.requestTokens).toBe(123804) // 128000 - 4096 - 100
      expect(limits.knowledgeCutOff).toBe('2024-04-01')
    })

    test('should initialize with gpt-4-turbo-2024-04-09 model', () => {
      const limits = new TokenLimits('gpt-4-turbo-2024-04-09')
      expect(limits.maxTokens).toBe(128000)
      expect(limits.responseTokens).toBe(4096)
      expect(limits.requestTokens).toBe(123804)
      expect(limits.knowledgeCutOff).toBe('2024-04-01')
    })

    test('should initialize with gpt-4-vision-preview model', () => {
      const limits = new TokenLimits('gpt-4-vision-preview')
      expect(limits.maxTokens).toBe(128000)
      expect(limits.responseTokens).toBe(4096)
      expect(limits.requestTokens).toBe(123804)
      expect(limits.knowledgeCutOff).toBe('2024-04-01')
    })
  })

  describe('string', () => {
    test('should return formatted string representation', () => {
      const limits = new TokenLimits('gpt-4')
      const result = limits.string()
      expect(result).toContain('max_tokens=8000')
      expect(result).toContain('request_tokens=5900')
      expect(result).toContain('response_tokens=2000')
    })

    test('should format default model correctly', () => {
      const limits = new TokenLimits()
      const result = limits.string()
      expect(result).toBe(
        'max_tokens=16385, request_tokens=12189, response_tokens=4096'
      )
    })

    test('should format gpt-4-32k model correctly', () => {
      const limits = new TokenLimits('gpt-4-32k')
      const result = limits.string()
      expect(result).toBe(
        'max_tokens=32600, request_tokens=28500, response_tokens=4000'
      )
    })
  })
})
