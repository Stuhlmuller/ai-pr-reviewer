import Anthropic from '@anthropic-ai/sdk'
import pRetry from 'p-retry'
import {TokenLimits} from './limits'
import {AIProvider, ChatOptions, ChatResponse} from './ai-provider'
import * as core from '@actions/core'

/**
 * Anthropic Claude provider implementation
 * Supports Claude Opus, Sonnet, and Haiku models
 */
export class AnthropicProvider implements AIProvider {
  private readonly client: Anthropic
  private readonly model: string
  private readonly tokenLimits: TokenLimits

  constructor(
    apiKey: string,
    model: string = 'claude-3-5-sonnet-20241022',
    retries: number = 3
  ) {
    this.client = new Anthropic({
      apiKey,
      maxRetries: retries
    })
    this.model = model
    this.tokenLimits = new TokenLimits(model)

    core.info(
      `Initialized Anthropic provider with model: ${model} (${this.tokenLimits.string()})`
    )
  }

  async chat(
    message: string,
    options: ChatOptions = {}
  ): Promise<ChatResponse> {
    const {systemMessage, timeoutMs = 120000, temperature, topP} = options

    try {
      const response = await pRetry(
        async () => {
          const abortController = new AbortController()
          const timeoutId = setTimeout(() => abortController.abort(), timeoutMs)

          try {
            const result = await this.client.messages.create(
              {
                model: this.model,
                max_tokens: this.tokenLimits.responseTokens,
                temperature: temperature ?? 1.0,
                top_p: topP,
                system: systemMessage,
                messages: [
                  {
                    role: 'user',
                    content: message
                  }
                ]
              },
              {
                signal: abortController.signal
              }
            )

            clearTimeout(timeoutId)

            // Extract text from the response
            const textContent = result.content.find(
              block => block.type === 'text'
            )
            if (!textContent || textContent.type !== 'text') {
              throw new Error('No text content in Anthropic response')
            }

            return {
              text: textContent.text,
              conversationId: result.id
            }
          } catch (error: unknown) {
            clearTimeout(timeoutId)
            throw error
          }
        },
        {
          retries: 3,
          onFailedAttempt: error => {
            const errorMsg =
              error instanceof Error ? error.message : 'Unknown error'
            core.warning(
              `Anthropic API call failed (attempt ${error.attemptNumber}): ${errorMsg}`
            )
          }
        }
      )

      return response
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      core.error(`Anthropic chat error: ${errorMessage}`)
      throw new Error(`Anthropic API error: ${errorMessage}`)
    }
  }

  getModelLimits(): TokenLimits {
    return this.tokenLimits
  }

  getProviderName(): string {
    return 'Anthropic'
  }

  getModelName(): string {
    return this.model
  }
}
