import {expect, describe, test} from '@jest/globals'
import {encode, getTokenCount} from '../src/tokenizer'

describe('tokenizer', () => {
  describe('encode', () => {
    test('should encode simple string', () => {
      const result = encode('hello world')
      expect(result).toBeInstanceOf(Uint32Array)
      expect(result.length).toBeGreaterThan(0)
    })

    test('should encode empty string', () => {
      const result = encode('')
      expect(result).toBeInstanceOf(Uint32Array)
      expect(result.length).toBe(0)
    })

    test('should encode string with special characters', () => {
      const result = encode('Hello, world! 你好')
      expect(result).toBeInstanceOf(Uint32Array)
      expect(result.length).toBeGreaterThan(0)
    })

    test('should encode multiline string', () => {
      const result = encode('line 1\nline 2\nline 3')
      expect(result).toBeInstanceOf(Uint32Array)
      expect(result.length).toBeGreaterThan(0)
    })

    test('should produce consistent results', () => {
      const input = 'test string'
      const result1 = encode(input)
      const result2 = encode(input)
      expect(result1).toEqual(result2)
    })
  })

  describe('getTokenCount', () => {
    test('should count tokens in simple string', () => {
      const count = getTokenCount('hello world')
      expect(count).toBeGreaterThan(0)
      expect(typeof count).toBe('number')
    })

    test('should return 0 for empty string', () => {
      const count = getTokenCount('')
      expect(count).toBe(0)
    })

    test('should remove endoftext tokens before counting', () => {
      const inputWithEndOfText = 'hello<|endoftext|>world'
      const inputWithout = 'helloworld'
      const countWith = getTokenCount(inputWithEndOfText)
      const countWithout = getTokenCount(inputWithout)
      // The count should be the same since endoftext tokens are removed
      expect(countWith).toBe(countWithout)
    })

    test('should handle multiple endoftext tokens', () => {
      const input = 'hello<|endoftext|>world<|endoftext|>test'
      const count = getTokenCount(input)
      expect(count).toBeGreaterThan(0)
    })

    test('should count tokens in code-like string', () => {
      const code = 'function test() { return true; }'
      const count = getTokenCount(code)
      expect(count).toBeGreaterThan(0)
    })

    test('should count tokens in multiline string', () => {
      const multiline = 'line 1\nline 2\nline 3'
      const count = getTokenCount(multiline)
      expect(count).toBeGreaterThan(0)
    })

    test('should handle unicode characters', () => {
      const unicode = 'Hello 世界 🌍'
      const count = getTokenCount(unicode)
      expect(count).toBeGreaterThan(0)
    })

    test('should match encode length after endoftext removal', () => {
      const input = 'test<|endoftext|>string'
      const count = getTokenCount(input)
      const encoded = encode(input.replace(/<\|endoftext\|>/g, ''))
      expect(count).toBe(encoded.length)
    })
  })
})
