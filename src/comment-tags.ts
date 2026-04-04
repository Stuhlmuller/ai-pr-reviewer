import {BOT_NAME, LEGACY_BOT_NAME} from './brand'

const OSS_PREFIX = '<!-- This is an auto-generated'

export const COMMENT_TAG = `${OSS_PREFIX} comment by OSS ${BOT_NAME} -->`
const LEGACY_COMMENT_TAG = `${OSS_PREFIX} comment by OSS ${LEGACY_BOT_NAME} -->`

export const COMMENT_REPLY_TAG = `${OSS_PREFIX} reply by OSS ${BOT_NAME} -->`
const LEGACY_COMMENT_REPLY_TAG = `${OSS_PREFIX} reply by OSS ${LEGACY_BOT_NAME} -->`

export const SUMMARIZE_TAG = `${OSS_PREFIX} comment: summarize by OSS ${BOT_NAME} -->`
const LEGACY_SUMMARIZE_TAG = `${OSS_PREFIX} comment: summarize by OSS ${LEGACY_BOT_NAME} -->`

export const IN_PROGRESS_START_TAG = `${OSS_PREFIX} comment: summarize review in progress by OSS ${BOT_NAME} -->`
const LEGACY_IN_PROGRESS_START_TAG = `${OSS_PREFIX} comment: summarize review in progress by OSS ${LEGACY_BOT_NAME} -->`

export const IN_PROGRESS_END_TAG = `<!-- end of auto-generated comment: summarize review in progress by OSS ${BOT_NAME} -->`
const LEGACY_IN_PROGRESS_END_TAG = `<!-- end of auto-generated comment: summarize review in progress by OSS ${LEGACY_BOT_NAME} -->`

export const DESCRIPTION_START_TAG = `${OSS_PREFIX} comment: release notes by OSS ${BOT_NAME} -->`
const LEGACY_DESCRIPTION_START_TAG = `${OSS_PREFIX} comment: release notes by OSS ${LEGACY_BOT_NAME} -->`

export const DESCRIPTION_END_TAG = `<!-- end of auto-generated comment: release notes by OSS ${BOT_NAME} -->`
const LEGACY_DESCRIPTION_END_TAG = `<!-- end of auto-generated comment: release notes by OSS ${LEGACY_BOT_NAME} -->`

export const RAW_SUMMARY_START_TAG = `${OSS_PREFIX} comment: raw summary by OSS ${BOT_NAME} -->
<!--
`
const LEGACY_RAW_SUMMARY_START_TAG = `${OSS_PREFIX} comment: raw summary by OSS ${LEGACY_BOT_NAME} -->
<!--
`

export const RAW_SUMMARY_END_TAG = `-->
<!-- end of auto-generated comment: raw summary by OSS ${BOT_NAME} -->`
const LEGACY_RAW_SUMMARY_END_TAG = `-->
<!-- end of auto-generated comment: raw summary by OSS ${LEGACY_BOT_NAME} -->`

export const SHORT_SUMMARY_START_TAG = `${OSS_PREFIX} comment: short summary by OSS ${BOT_NAME} -->
<!--
`
const LEGACY_SHORT_SUMMARY_START_TAG = `${OSS_PREFIX} comment: short summary by OSS ${LEGACY_BOT_NAME} -->
<!--
`

export const SHORT_SUMMARY_END_TAG = `-->
<!-- end of auto-generated comment: short summary by OSS ${BOT_NAME} -->`
const LEGACY_SHORT_SUMMARY_END_TAG = `-->
<!-- end of auto-generated comment: short summary by OSS ${LEGACY_BOT_NAME} -->`

const TAG_ALIASES: Record<string, string[]> = {
  [COMMENT_TAG]: [COMMENT_TAG, LEGACY_COMMENT_TAG],
  [COMMENT_REPLY_TAG]: [COMMENT_REPLY_TAG, LEGACY_COMMENT_REPLY_TAG],
  [SUMMARIZE_TAG]: [SUMMARIZE_TAG, LEGACY_SUMMARIZE_TAG],
  [IN_PROGRESS_START_TAG]: [
    IN_PROGRESS_START_TAG,
    LEGACY_IN_PROGRESS_START_TAG
  ],
  [IN_PROGRESS_END_TAG]: [IN_PROGRESS_END_TAG, LEGACY_IN_PROGRESS_END_TAG],
  [DESCRIPTION_START_TAG]: [
    DESCRIPTION_START_TAG,
    LEGACY_DESCRIPTION_START_TAG
  ],
  [DESCRIPTION_END_TAG]: [DESCRIPTION_END_TAG, LEGACY_DESCRIPTION_END_TAG],
  [RAW_SUMMARY_START_TAG]: [
    RAW_SUMMARY_START_TAG,
    LEGACY_RAW_SUMMARY_START_TAG
  ],
  [RAW_SUMMARY_END_TAG]: [RAW_SUMMARY_END_TAG, LEGACY_RAW_SUMMARY_END_TAG],
  [SHORT_SUMMARY_START_TAG]: [
    SHORT_SUMMARY_START_TAG,
    LEGACY_SHORT_SUMMARY_START_TAG
  ],
  [SHORT_SUMMARY_END_TAG]: [SHORT_SUMMARY_END_TAG, LEGACY_SHORT_SUMMARY_END_TAG]
}

export function getTagAliases(tag: string): string[] {
  return TAG_ALIASES[tag] ?? [tag]
}

function getTagAliasPairs(
  startTag: string,
  endTag: string
): Array<[string, string]> {
  const startTags = getTagAliases(startTag)
  const endTags = getTagAliases(endTag)
  const pairCount = Math.max(startTags.length, endTags.length)

  return Array.from({length: pairCount}, (_, index) => [
    startTags[index] ?? startTag,
    endTags[index] ?? endTag
  ])
}

export function bodyHasTag(
  body: string | null | undefined,
  tag: string
): boolean {
  if (body == null || body === '') {
    return false
  }

  return getTagAliases(tag).some(alias => body.includes(alias))
}

export function replaceTagAlias(
  body: string,
  fromTag: string,
  toTag: string
): string {
  for (const alias of getTagAliases(fromTag)) {
    if (body.includes(alias)) {
      return body.replace(alias, toTag)
    }
  }

  return body
}

export function getContentWithinTagAliases(
  content: string,
  startTag: string,
  endTag: string
): string {
  for (const [candidateStartTag, candidateEndTag] of getTagAliasPairs(
    startTag,
    endTag
  )) {
    const start = content.indexOf(candidateStartTag)
    const end = content.indexOf(candidateEndTag)
    if (start >= 0 && end >= 0) {
      return content.slice(start + candidateStartTag.length, end)
    }
  }

  return ''
}

export function removeContentWithinTagAliases(
  content: string,
  startTag: string,
  endTag: string
): string {
  for (const [candidateStartTag, candidateEndTag] of getTagAliasPairs(
    startTag,
    endTag
  )) {
    const start = content.indexOf(candidateStartTag)
    const end = content.lastIndexOf(candidateEndTag)
    if (start >= 0 && end >= 0) {
      return (
        content.slice(0, start) + content.slice(end + candidateEndTag.length)
      )
    }
  }

  return content
}
