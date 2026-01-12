import {TokenLimits} from './limits'

/**
 * Options for sending a chat message to an AI provider
 */
export interface ChatOptions {
  systemMessage?: string
  timeoutMs?: number
  temperature?: number
  topP?: number
  parentMessageId?: string
  conversationId?: string
}

/**
 * Token usage information for a chat response
 */
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

/**
 * Response from an AI provider's chat method
 */
export interface ChatResponse {
  text: string
  parentMessageId?: string
  conversationId?: string
  tokenUsage?: TokenUsage
}

/**
 * Abstract interface for AI providers (OpenAI, Anthropic, etc.)
 * All AI providers must implement this interface to be used by the code reviewer
 */
export interface AIProvider {
  /**
   * Send a message to the AI and get a response
   * @param message - The user message to send
   * @param options - Optional configuration for the chat
   * @returns Promise resolving to the AI's response
   */
  chat(_message: string, _options?: ChatOptions): Promise<ChatResponse>

  /**
   * Get the token limits for the provider's model
   * @returns TokenLimits object with max, request, and response token limits
   */
  getModelLimits(): TokenLimits

  /**
   * Get the name of the provider (e.g., 'OpenAI', 'Anthropic')
   * @returns The provider name
   */
  getProviderName(): string

  /**
   * Get the model name being used (e.g., 'gpt-4', 'claude-sonnet-4')
   * @returns The model name
   */
  getModelName(): string
}
