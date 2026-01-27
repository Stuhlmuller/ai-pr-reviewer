/**
 * Retry Logic Module
 *
 * Provides exponential backoff and retry strategies for handling failures
 * during PR review processing (API rate limits, timeouts, network errors).
 */

import {type ErrorType} from './review-state'

export interface RetryStrategy {
  /** Maximum number of retry attempts for this error type */
  maxAttempts: number
  /** Base delay in milliseconds before first retry */
  baseDelay: number
  /** Whether this error type should be retried */
  shouldRetry: boolean
}

export interface RetryConfig {
  /** Global maximum retry attempts (can be overridden per error type) */
  maxAttempts: number
  /** Per-error-type maximum attempts override */
  perErrorTypeMaxAttempts?: {
    [key in ErrorType]?: number
  }
}

/**
 * Default maximum delay cap (5 minutes)
 */
const DEFAULT_MAX_DELAY = 300000 // 5 minutes in milliseconds

/**
 * Calculates exponential backoff delay for a given retry attempt
 *
 * Formula: baseDelay * 2^attempt
 * Example with baseDelay=1000ms:
 *   - Attempt 0: 1s
 *   - Attempt 1: 2s
 *   - Attempt 2: 4s
 *   - Attempt 3: 8s
 *   - Attempt 4: 16s
 *
 * @param attempt - The retry attempt number (0-indexed)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay cap in milliseconds (default: 5 minutes)
 * @returns Calculated delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number = DEFAULT_MAX_DELAY
): number {
  // Handle edge cases
  if (attempt < 0) {
    attempt = 0
  }
  if (baseDelay === 0) {
    return 0
  }

  // Calculate exponential backoff: baseDelay * 2^attempt
  const delay = baseDelay * Math.pow(2, attempt)

  // Cap at maximum delay
  return Math.min(delay, maxDelay)
}

/**
 * Gets the retry strategy for a specific error type
 *
 * Different error types have different retry strategies:
 * - rate_limit: Aggressive retry with longer delays (API rate limits are temporary)
 * - timeout: Moderate retry with medium delays
 * - network: Moderate retry with medium delays
 * - api_error: Conservative retry (might be permanent issue)
 * - token_limit: No retry (content too large, won't succeed on retry)
 * - unknown: Conservative retry
 *
 * @param errorType - The type of error that occurred
 * @returns Retry strategy for this error type
 */
export function getRetryStrategy(errorType: ErrorType): RetryStrategy {
  switch (errorType) {
    case 'rate_limit':
      return {
        maxAttempts: 5,
        baseDelay: 5000, // Start with 5 seconds
        shouldRetry: true
      }

    case 'timeout':
    case 'network':
      // Timeout and network errors have the same strategy
      return {
        maxAttempts: 3,
        baseDelay: 2000, // Start with 2 seconds
        shouldRetry: true
      }

    case 'token_limit':
      // Token limit errors won't be fixed by retrying
      return {
        maxAttempts: 0,
        baseDelay: 0,
        shouldRetry: false
      }

    case 'api_error':
    case 'unknown':
    default:
      // API errors and unknown errors have the same conservative strategy
      return {
        maxAttempts: 2,
        baseDelay: 1000, // Start with 1 second
        shouldRetry: true
      }
  }
}

/**
 * Determines if a retry should be attempted based on current attempt number,
 * error type, and configuration
 *
 * @param currentAttempt - The current attempt number (0-indexed)
 * @param errorType - The type of error that occurred
 * @param config - Retry configuration
 * @returns true if retry should be attempted, false otherwise
 */
export function shouldRetry(
  currentAttempt: number,
  errorType: ErrorType,
  config: RetryConfig
): boolean {
  // Get the retry strategy for this error type
  const strategy = getRetryStrategy(errorType)

  // If the error type shouldn't be retried at all, return false
  if (!strategy.shouldRetry) {
    return false
  }

  // Check if there's a per-error-type max attempts override
  const maxAttempts =
    config.perErrorTypeMaxAttempts?.[errorType] ?? config.maxAttempts

  // Allow retry if we haven't exceeded the maximum attempts
  return currentAttempt < maxAttempts
}
