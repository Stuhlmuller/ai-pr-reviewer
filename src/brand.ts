export const BOT_NAME = 'Linewright'
export const LEGACY_BOT_NAME = 'CodeReviewer'

export const BOT_HANDLE = '@linewright'
export const LEGACY_BOT_HANDLE = '@codereviewer'
export const BOT_HANDLES = [BOT_HANDLE, LEGACY_BOT_HANDLE] as const

export const PRIMARY_IGNORE_KEYWORD = `${BOT_HANDLE}: ignore`
export const LEGACY_IGNORE_KEYWORD = `${LEGACY_BOT_HANDLE}: ignore`
export const IGNORE_KEYWORDS = [
  PRIMARY_IGNORE_KEYWORD,
  LEGACY_IGNORE_KEYWORD
] as const

export const RELEASE_NOTES_TITLE = `### Summary by ${BOT_NAME}`

function bodyIncludesAny(
  body: string | null | undefined,
  values: readonly string[]
): boolean {
  if (body == null || body === '') {
    return false
  }

  return values.some(value => body.includes(value))
}

export function bodyIncludesBotHandle(
  body: string | null | undefined
): boolean {
  return bodyIncludesAny(body, BOT_HANDLES)
}

export function bodyIncludesIgnoreKeyword(
  body: string | null | undefined
): boolean {
  return bodyIncludesAny(body, IGNORE_KEYWORDS)
}
