import './fetch-polyfill'

import {info, setFailed, warning} from '@actions/core'
import OpenAI from 'openai'
import {OpenAIOptions, Options} from './options'
import {getTokenCount} from './tokenizer'
import type {TokenUsage} from './ai-provider'

// define type to save parentMessageId and conversationId
export interface Ids {
  parentMessageId?: string
  conversationId?: string
  tokenUsage?: TokenUsage
}

export class Bot {
  private readonly api: OpenAI | null = null

  private readonly options: Options

  constructor(options: Options, openaiOptions: OpenAIOptions) {
    this.options = options
    if (process.env.OPENAI_API_KEY) {
      const currentDate = new Date().toISOString().split('T')[0]
      const systemMessage = `${options.systemMessage} 
Knowledge cutoff: ${openaiOptions.tokenLimits.knowledgeCutOff}
Current date: ${currentDate}

IMPORTANT: Entire response must be in the language with ISO code: ${options.language}
`

      this.api = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: options.apiBaseUrl,
        maxRetries: options.openaiRetries,
        organization: process.env.OPENAI_API_ORG ?? undefined,
        timeout: options.openaiTimeoutMS
      })
      this.systemMessage = systemMessage
      this.model = openaiOptions.model
    } else {
      const err =
        "Unable to initialize the OpenAI API, both 'OPENAI_API_KEY' environment variable are not available"
      throw new Error(err)
    }
  }

  private readonly systemMessage: string = ''

  private readonly model: string = 'gpt-4o-mini'

  chat = async (message: string, ids: Ids): Promise<[string, Ids]> => {
    let res: [string, Ids] = ['', {}]
    try {
      res = await this.chat_(message, ids)
      return res
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e))
      warning(`Failed to chat: ${error.message}, backtrace: ${error.stack}`)
      return res
    }
  }

  private readonly chat_ = async (
    message: string,
    ids: Ids
  ): Promise<[string, Ids]> => {
    // record timing
    const start = Date.now()
    if (!message) {
      return ['', {}]
    }

    let responseText = ''
    let responseId: string | undefined

    if (this.api != null) {
      try {
        const response = await this.api.chat.completions.create({
          messages: [
            {
              content: this.systemMessage,
              role: 'system'
            },
            {
              content: message,
              role: 'user'
            }
          ],
          model: this.model,
          temperature: this.options.openaiModelTemperature
        })

        responseId = response.id
        const content = response.choices[0]?.message?.content
        if (typeof content === 'string') {
          responseText = content
        }
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e))
        info(
          `failed to send message to openai: ${error.message}, backtrace: ${error.stack}`
        )
      }
      const end = Date.now()
      info(`openai chat.completions.create response time: ${end - start} ms`)
    } else {
      setFailed('The OpenAI API is not initialized')
    }
    if (!responseText) {
      warning('openai response is null')
    }
    // remove the prefix "with " in the response
    if (responseText.startsWith('with ')) {
      responseText = responseText.substring(5)
    }
    if (this.options.debug) {
      info(`openai responses: ${responseText}`)
    }

    // Calculate token usage (estimate using tokenizer)
    const inputTokens = getTokenCount(message)
    const outputTokens = getTokenCount(responseText)
    const tokenUsage: TokenUsage = {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens
    }

    if (this.options.debug) {
      info(
        `Token usage - Input: ${inputTokens}, Output: ${outputTokens}, Total: ${tokenUsage.totalTokens}`
      )
    }

    const newIds: Ids = {
      parentMessageId: responseId ?? ids.parentMessageId,
      tokenUsage
    }
    return [responseText, newIds]
  }
}
