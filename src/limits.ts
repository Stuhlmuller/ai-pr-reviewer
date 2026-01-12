export class TokenLimits {
  maxTokens: number
  requestTokens: number
  responseTokens: number
  knowledgeCutOff: string

  constructor(model = 'gpt-3.5-turbo') {
    // Updated knowledge cutoff for newer models
    this.knowledgeCutOff = '2024-10-01'

    // Claude models (Anthropic)
    if (
      model === 'claude-opus-4' ||
      model === 'claude-opus-4-20250514' ||
      model === 'claude-opus-4.5'
    ) {
      this.maxTokens = 200000
      this.responseTokens = 4096
      this.knowledgeCutOff = '2024-10-01'
    } else if (
      model === 'claude-sonnet-4' ||
      model === 'claude-sonnet-4-20250514' ||
      model === 'claude-sonnet-4.5' ||
      model === 'claude-3-5-sonnet-20241022' ||
      model === 'claude-3-5-sonnet-20240620' ||
      model === 'claude-3-5-haiku-20241022' ||
      model === 'claude-3-haiku-20240307'
    ) {
      this.maxTokens = 200000
      this.responseTokens = 8192
      this.knowledgeCutOff = '2024-10-01'
    }
    // GPT-4o models (latest and most capable)
    else if (
      model === 'gpt-4o' ||
      model === 'chatgpt-4o-latest' ||
      model === 'gpt-4o-mini'
    ) {
      this.maxTokens = 128000
      this.responseTokens = 16384
      this.knowledgeCutOff = '2024-10-01'
    }
    // o1 models (reasoning models)
    else if (model === 'o1-preview') {
      this.maxTokens = 128000
      this.responseTokens = 32768
      this.knowledgeCutOff = '2024-10-01'
    } else if (model === 'o1-mini') {
      this.maxTokens = 128000
      this.responseTokens = 65536
      this.knowledgeCutOff = '2024-10-01'
    }
    // GPT-4 Turbo models (including vision variants)
    else if (
      model === 'gpt-4-turbo' ||
      model === 'gpt-4-turbo-2024-04-09' ||
      model === 'gpt-4-turbo-preview' ||
      model === 'gpt-4-0125-preview' ||
      model === 'gpt-4-1106-preview' ||
      model === 'gpt-4-turbo-vision-preview' ||
      model === 'gpt-4-vision-preview' ||
      model === 'gpt-4-1106-vision-preview'
    ) {
      this.maxTokens = 128000
      this.responseTokens = 4096
      this.knowledgeCutOff = '2024-04-01'
    }
    // Original GPT-4 models
    else if (model === 'gpt-4-32k') {
      this.maxTokens = 32600
      this.responseTokens = 4000
      this.knowledgeCutOff = '2021-09-01'
    } else if (model === 'gpt-4') {
      this.maxTokens = 8000
      this.responseTokens = 2000
      this.knowledgeCutOff = '2021-09-01'
    }
    // GPT-3.5 Turbo models
    else if (model === 'gpt-3.5-turbo-16k') {
      this.maxTokens = 16300
      this.responseTokens = 3000
      this.knowledgeCutOff = '2021-09-01'
    } else if (
      model.startsWith('gpt-3.5-turbo') ||
      model === 'gpt-3.5-turbo-0125' ||
      model === 'gpt-3.5-turbo-1106'
    ) {
      this.maxTokens = 16385
      this.responseTokens = 4096
      this.knowledgeCutOff = '2021-09-01'
    }
    // Default fallback
    else {
      this.maxTokens = 4000
      this.responseTokens = 1000
      this.knowledgeCutOff = '2021-09-01'
    }
    // provide some margin for the request tokens
    this.requestTokens = this.maxTokens - this.responseTokens - 100
  }

  string(): string {
    return `max_tokens=${this.maxTokens}, request_tokens=${this.requestTokens}, response_tokens=${this.responseTokens}`
  }
}
