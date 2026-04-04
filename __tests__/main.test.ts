import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test
} from '@jest/globals'

const mockCodeReview = jest.fn()
const mockHandleReviewComment = jest.fn()
const mockBot = jest.fn()

jest.mock('../src/bot', () => ({
  Bot: mockBot
}))

jest.mock('../src/review', () => ({
  codeReview: mockCodeReview
}))

jest.mock('../src/review-comment', () => ({
  handleReviewComment: mockHandleReviewComment
}))

jest.mock('@actions/core', () => ({
  getBooleanInput: jest.fn((name: string) => name === 'enable_resume'),
  getInput: jest.fn((name: string) => {
    const values = new Map<string, string>([
      ['max_files', '0'],
      ['system_message', 'System prompt'],
      ['openai_light_model', 'gpt-4o-mini'],
      ['openai_heavy_model', 'gpt-4o-mini'],
      ['openai_model_temperature', '0.1'],
      ['openai_retries', '2'],
      ['openai_timeout_ms', '30000'],
      ['openai_concurrency_limit', '6'],
      ['github_concurrency_limit', '6'],
      ['openai_base_url', 'https://api.openai.com/v1'],
      ['language', 'en-US'],
      ['smart_review_min_lines', '3'],
      ['max_retry_attempts', '3'],
      ['summarize', 'summary prompt'],
      ['summarize_release_notes', 'release notes prompt']
    ])

    return values.get(name) ?? ''
  }),
  getMultilineInput: jest.fn(() => []),
  info: jest.fn(),
  setFailed: jest.fn(),
  warning: jest.fn()
}))

describe('run', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      GITHUB_EVENT_NAME: 'pull_request_target'
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('routes pull_request_target events to code review', async () => {
    const {run} = await import('../src/run')

    await run()

    expect(mockBot).toHaveBeenCalledTimes(2)
    expect(mockCodeReview).toHaveBeenCalledTimes(1)
    expect(mockHandleReviewComment).not.toHaveBeenCalled()
  })
})
