/**
 * Tests for retry logic with exponential backoff
 */

import {
  calculateBackoffDelay,
  getRetryStrategy,
  shouldRetry,
  type RetryConfig
} from '../src/retry-logic'

describe('retry-logic', () => {
  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff delay', () => {
      // Base delay of 1000ms with exponential growth
      expect(calculateBackoffDelay(0, 1000)).toBe(1000) // 1s
      expect(calculateBackoffDelay(1, 1000)).toBe(2000) // 2s
      expect(calculateBackoffDelay(2, 1000)).toBe(4000) // 4s
      expect(calculateBackoffDelay(3, 1000)).toBe(8000) // 8s
      expect(calculateBackoffDelay(4, 1000)).toBe(16000) // 16s
    })

    it('should respect maximum delay cap', () => {
      const maxDelay = 60000 // 60 seconds
      // After many attempts, should not exceed max
      expect(calculateBackoffDelay(10, 1000, maxDelay)).toBe(maxDelay)
      expect(calculateBackoffDelay(20, 1000, maxDelay)).toBe(maxDelay)
    })

    it('should handle zero attempt number', () => {
      expect(calculateBackoffDelay(0, 1000)).toBe(1000)
    })

    it('should use default max delay if not provided', () => {
      // Should have a reasonable default max (e.g., 5 minutes = 300000ms)
      const delay = calculateBackoffDelay(20, 1000)
      expect(delay).toBeLessThanOrEqual(300000)
    })
  })

  describe('getRetryStrategy', () => {
    it('should return aggressive retry for rate_limit errors', () => {
      const strategy = getRetryStrategy('rate_limit')
      expect(strategy.maxAttempts).toBeGreaterThan(3)
      expect(strategy.baseDelay).toBeGreaterThan(1000)
      expect(strategy.shouldRetry).toBe(true)
    })

    it('should return moderate retry for timeout errors', () => {
      const strategy = getRetryStrategy('timeout')
      expect(strategy.maxAttempts).toBeGreaterThan(1)
      expect(strategy.shouldRetry).toBe(true)
    })

    it('should return moderate retry for network errors', () => {
      const strategy = getRetryStrategy('network')
      expect(strategy.maxAttempts).toBeGreaterThan(1)
      expect(strategy.shouldRetry).toBe(true)
    })

    it('should return conservative retry for api_error', () => {
      const strategy = getRetryStrategy('api_error')
      expect(strategy.maxAttempts).toBeGreaterThanOrEqual(1)
      expect(strategy.shouldRetry).toBe(true)
    })

    it('should return no retry for token_limit errors', () => {
      const strategy = getRetryStrategy('token_limit')
      expect(strategy.shouldRetry).toBe(false)
      expect(strategy.maxAttempts).toBe(0)
    })

    it('should return conservative retry for unknown errors', () => {
      const strategy = getRetryStrategy('unknown')
      expect(strategy.maxAttempts).toBeGreaterThanOrEqual(1)
      expect(strategy.shouldRetry).toBe(true)
    })

    it('should return different strategies for different error types', () => {
      const rateLimitStrategy = getRetryStrategy('rate_limit')
      const timeoutStrategy = getRetryStrategy('timeout')
      const tokenLimitStrategy = getRetryStrategy('token_limit')

      // Rate limit should have longer delays than timeout
      expect(rateLimitStrategy.baseDelay).toBeGreaterThan(
        timeoutStrategy.baseDelay
      )

      // Token limit should not retry
      expect(tokenLimitStrategy.shouldRetry).toBe(false)
      expect(rateLimitStrategy.shouldRetry).toBe(true)
    })
  })

  describe('shouldRetry', () => {
    const config: RetryConfig = {
      maxAttempts: 3
    }

    it('should allow retry when under max attempts', () => {
      expect(shouldRetry(0, 'rate_limit', config)).toBe(true)
      expect(shouldRetry(1, 'rate_limit', config)).toBe(true)
      expect(shouldRetry(2, 'rate_limit', config)).toBe(true)
    })

    it('should not allow retry when at or over max attempts', () => {
      expect(shouldRetry(3, 'rate_limit', config)).toBe(false)
      expect(shouldRetry(4, 'rate_limit', config)).toBe(false)
    })

    it('should respect error type retry strategy', () => {
      // token_limit should never retry regardless of attempts
      expect(shouldRetry(0, 'token_limit', config)).toBe(false)
      expect(shouldRetry(1, 'token_limit', config)).toBe(false)
    })

    it('should allow retry for retryable errors', () => {
      expect(shouldRetry(0, 'rate_limit', config)).toBe(true)
      expect(shouldRetry(0, 'timeout', config)).toBe(true)
      expect(shouldRetry(0, 'network', config)).toBe(true)
    })

    it('should use error-specific max attempts when provided', () => {
      const customConfig: RetryConfig = {
        maxAttempts: 5,
        perErrorTypeMaxAttempts: {
          rate_limit: 10,
          timeout: 3
        }
      }

      // Should use error-specific max for rate_limit
      expect(shouldRetry(9, 'rate_limit', customConfig)).toBe(true)
      expect(shouldRetry(10, 'rate_limit', customConfig)).toBe(false)

      // Should use error-specific max for timeout
      expect(shouldRetry(2, 'timeout', customConfig)).toBe(true)
      expect(shouldRetry(3, 'timeout', customConfig)).toBe(false)

      // Should use global max for other errors
      expect(shouldRetry(4, 'api_error', customConfig)).toBe(true)
      expect(shouldRetry(5, 'api_error', customConfig)).toBe(false)
    })
  })

  describe('RetryStrategy interface', () => {
    it('should have consistent structure', () => {
      const strategy = getRetryStrategy('rate_limit')
      expect(strategy).toHaveProperty('maxAttempts')
      expect(strategy).toHaveProperty('baseDelay')
      expect(strategy).toHaveProperty('shouldRetry')
      expect(typeof strategy.maxAttempts).toBe('number')
      expect(typeof strategy.baseDelay).toBe('number')
      expect(typeof strategy.shouldRetry).toBe('boolean')
    })
  })

  describe('edge cases', () => {
    it('should handle negative attempt numbers gracefully', () => {
      expect(calculateBackoffDelay(-1, 1000)).toBe(1000)
    })

    it('should handle very large attempt numbers', () => {
      const delay = calculateBackoffDelay(100, 1000)
      expect(delay).toBeGreaterThan(0)
      expect(delay).toBeLessThanOrEqual(300000) // Should cap at max
    })

    it('should handle zero base delay', () => {
      expect(calculateBackoffDelay(0, 0)).toBe(0)
      expect(calculateBackoffDelay(1, 0)).toBe(0)
    })
  })

  describe('integration scenarios', () => {
    it('should provide increasing delays for multiple retries', () => {
      const strategy = getRetryStrategy('timeout')
      const delays: number[] = []

      for (let attempt = 0; attempt < strategy.maxAttempts; attempt++) {
        delays.push(calculateBackoffDelay(attempt, strategy.baseDelay))
      }

      // Each delay should be greater than or equal to the previous
      for (let i = 1; i < delays.length; i++) {
        expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1])
      }
    })

    it('should handle full retry cycle for rate_limit error', () => {
      const config: RetryConfig = {maxAttempts: 5}
      const strategy = getRetryStrategy('rate_limit')

      // Simulate retry cycle
      const attempts: Array<{
        attempt: number
        shouldRetry: boolean
        delay: number
      }> = []

      for (let attempt = 0; attempt <= strategy.maxAttempts; attempt++) {
        attempts.push({
          attempt,
          shouldRetry: shouldRetry(attempt, 'rate_limit', config),
          delay: calculateBackoffDelay(attempt, strategy.baseDelay)
        })
      }

      // First N attempts should allow retry
      expect(attempts[0].shouldRetry).toBe(true)
      expect(attempts[4].shouldRetry).toBe(true)

      // After max attempts, should not retry
      expect(attempts[5].shouldRetry).toBe(false)

      // Delays should increase
      expect(attempts[1].delay).toBeGreaterThan(attempts[0].delay)
      expect(attempts[2].delay).toBeGreaterThan(attempts[1].delay)
    })
  })
})
