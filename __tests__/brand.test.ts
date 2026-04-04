import {describe, expect, test} from '@jest/globals'
import {
  bodyIncludesBotHandle,
  bodyIncludesIgnoreKeyword,
  BOT_HANDLE,
  LEGACY_BOT_HANDLE,
  PRIMARY_IGNORE_KEYWORD,
  LEGACY_IGNORE_KEYWORD
} from '../src/brand'

describe('brand helpers', () => {
  test('should recognize the primary bot handle', () => {
    expect(bodyIncludesBotHandle(`please review this ${BOT_HANDLE}`)).toBe(true)
  })

  test('should recognize the legacy bot handle', () => {
    expect(
      bodyIncludesBotHandle(`please review this ${LEGACY_BOT_HANDLE}`)
    ).toBe(true)
  })

  test('should recognize the primary ignore keyword', () => {
    expect(bodyIncludesIgnoreKeyword(PRIMARY_IGNORE_KEYWORD)).toBe(true)
  })

  test('should recognize the legacy ignore keyword', () => {
    expect(bodyIncludesIgnoreKeyword(LEGACY_IGNORE_KEYWORD)).toBe(true)
  })

  test('should return false when no known handle or ignore keyword is present', () => {
    expect(bodyIncludesBotHandle('plain comment')).toBe(false)
    expect(bodyIncludesIgnoreKeyword('plain description')).toBe(false)
  })
})
