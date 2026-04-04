import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test
} from '@jest/globals'

const mockCreate = jest.fn()
const mockOpenAI = jest.fn().mockImplementation(() => ({
  chat: {
    completions: {
      create: mockCreate
    }
  }
}))

jest.mock('@actions/core', () => ({
  info: jest.fn(),
  setFailed: jest.fn(),
  warning: jest.fn()
}))

jest.mock('../src/fetch-polyfill', () => ({}))

jest.mock('openai', () => ({
  __esModule: true,
  default: mockOpenAI
}))

describe('Bot', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: 'test-api-key',
      OPENAI_API_ORG: 'test-org'
    }
    mockCreate.mockResolvedValue({
      id: 'chatcmpl_123',
      choices: [
        {
          message: {
            content: 'summary_output_01'
          }
        }
      ]
    })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('uses the official OpenAI client with configured request settings', async () => {
    const {Bot} = await import('../src/bot')
    const {OpenAIOptions, Options} = await import('../src/options')

    const options = new Options(
      true,
      false,
      false,
      '0',
      false,
      false,
      null,
      'system_prompt_01',
      'gpt-4o-mini',
      'gpt-4o-mini',
      '0.2',
      '4',
      '12345',
      '6',
      '7',
      'https://example.test/v1',
      'en-US'
    )

    const bot = new Bot(
      options,
      new OpenAIOptions('gpt-4o-mini', options.lightTokenLimits)
    )

    const [text, ids] = await bot.chat('patch_input_01', {})

    expect(mockOpenAI).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      baseURL: 'https://example.test/v1',
      maxRetries: 4,
      organization: 'test-org',
      timeout: 12345
    })
    expect(mockCreate).toHaveBeenCalledWith({
      messages: [
        {
          content: expect.stringContaining('system_prompt_01'),
          role: 'system'
        },
        {
          content: 'patch_input_01',
          role: 'user'
        }
      ],
      model: 'gpt-4o-mini',
      temperature: 0.2
    })
    expect(text).toBe('summary_output_01')
    expect(ids.parentMessageId).toBe('chatcmpl_123')
    expect(ids.tokenUsage).toBeDefined()
  })
})
