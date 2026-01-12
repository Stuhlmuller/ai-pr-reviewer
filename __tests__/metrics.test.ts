import {
  MODEL_PRICING,
  calculateCost,
  aggregateMetrics,
  formatCostMetrics,
  formatInlineCost,
  type TokenUsage,
  type FileCostMetrics
} from '../src/metrics'

describe('metrics', () => {
  describe('MODEL_PRICING', () => {
    it('should have pricing for OpenAI models', () => {
      expect(MODEL_PRICING['gpt-4o']).toBeDefined()
      expect(MODEL_PRICING['gpt-4o'].provider).toBe('openai')
      expect(MODEL_PRICING['gpt-3.5-turbo']).toBeDefined()
      expect(MODEL_PRICING['gpt-4']).toBeDefined()
    })

    it('should have pricing for Anthropic models', () => {
      expect(MODEL_PRICING['claude-opus-4']).toBeDefined()
      expect(MODEL_PRICING['claude-opus-4'].provider).toBe('anthropic')
      expect(MODEL_PRICING['claude-sonnet-4']).toBeDefined()
      expect(MODEL_PRICING['claude-3-haiku-20240307']).toBeDefined()
    })

    it('should have reasonable pricing ranges', () => {
      // Check that pricing is within expected ranges
      for (const [, pricing] of Object.entries(MODEL_PRICING)) {
        expect(pricing.inputCostPer1M).toBeGreaterThan(0)
        expect(pricing.inputCostPer1M).toBeLessThan(100)
        expect(pricing.outputCostPer1M).toBeGreaterThan(0)
        expect(pricing.outputCostPer1M).toBeLessThan(200)
        // Output should typically be more expensive than input
        expect(pricing.outputCostPer1M).toBeGreaterThanOrEqual(
          pricing.inputCostPer1M
        )
      }
    })
  })

  describe('calculateCost', () => {
    it('should calculate cost for GPT-4o', () => {
      const usage: TokenUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        model: 'gpt-4o'
      }

      const cost = calculateCost(usage)

      expect(cost.inputTokens).toBe(1000)
      expect(cost.outputTokens).toBe(500)
      expect(cost.totalTokens).toBe(1500)
      expect(cost.model).toBe('gpt-4o')
      expect(cost.provider).toBe('openai')
      // GPT-4o: $2.50 per 1M input, $10.00 per 1M output
      expect(cost.inputCost).toBeCloseTo(0.0025, 6)
      expect(cost.outputCost).toBeCloseTo(0.005, 6)
      expect(cost.totalCost).toBeCloseTo(0.0075, 6)
    })

    it('should calculate cost for GPT-3.5 Turbo', () => {
      const usage: TokenUsage = {
        inputTokens: 10000,
        outputTokens: 2000,
        model: 'gpt-3.5-turbo'
      }

      const cost = calculateCost(usage)

      // GPT-3.5 Turbo: $0.50 per 1M input, $1.50 per 1M output
      expect(cost.inputCost).toBeCloseTo(0.005, 6)
      expect(cost.outputCost).toBeCloseTo(0.003, 6)
      expect(cost.totalCost).toBeCloseTo(0.008, 6)
    })

    it('should calculate cost for Claude Opus', () => {
      const usage: TokenUsage = {
        inputTokens: 5000,
        outputTokens: 1000,
        model: 'claude-opus-4'
      }

      const cost = calculateCost(usage)

      expect(cost.provider).toBe('anthropic')
      // Claude Opus: $15.00 per 1M input, $75.00 per 1M output
      expect(cost.inputCost).toBeCloseTo(0.075, 6)
      expect(cost.outputCost).toBeCloseTo(0.075, 6)
      expect(cost.totalCost).toBeCloseTo(0.15, 6)
    })

    it('should calculate cost for Claude Haiku (cheapest)', () => {
      const usage: TokenUsage = {
        inputTokens: 10000,
        outputTokens: 2000,
        model: 'claude-3-haiku-20240307'
      }

      const cost = calculateCost(usage)

      expect(cost.provider).toBe('anthropic')
      // Claude Haiku: $0.25 per 1M input, $1.25 per 1M output
      expect(cost.inputCost).toBeCloseTo(0.0025, 6)
      expect(cost.outputCost).toBeCloseTo(0.0025, 6)
      expect(cost.totalCost).toBeCloseTo(0.005, 6)
    })

    it('should handle unknown model with default pricing', () => {
      const usage: TokenUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        model: 'unknown-model'
      }

      const cost = calculateCost(usage)

      expect(cost.model).toBe('unknown-model')
      expect(cost.provider).toBe('openai')
      // Should use GPT-3.5 Turbo pricing as default
      expect(cost.totalCost).toBeGreaterThan(0)
    })

    it('should handle zero tokens', () => {
      const usage: TokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        model: 'gpt-4o'
      }

      const cost = calculateCost(usage)

      expect(cost.totalTokens).toBe(0)
      expect(cost.totalCost).toBe(0)
    })

    it('should handle large token counts', () => {
      const usage: TokenUsage = {
        inputTokens: 1_000_000, // 1M tokens
        outputTokens: 500_000, // 500K tokens
        model: 'gpt-4o'
      }

      const cost = calculateCost(usage)

      // GPT-4o: $2.50 per 1M input, $10.00 per 1M output
      expect(cost.inputCost).toBeCloseTo(2.5, 6)
      expect(cost.outputCost).toBeCloseTo(5.0, 6)
      expect(cost.totalCost).toBeCloseTo(7.5, 6)
    })
  })

  describe('aggregateMetrics', () => {
    it('should aggregate metrics from multiple files', () => {
      const files: FileCostMetrics[] = [
        {
          filename: 'file1.ts',
          summaryCost: {
            inputTokens: 1000,
            outputTokens: 200,
            totalTokens: 1200,
            inputCost: 0.001,
            outputCost: 0.0003,
            totalCost: 0.0013,
            model: 'gpt-3.5-turbo',
            provider: 'openai'
          },
          reviewCost: {
            inputTokens: 2000,
            outputTokens: 500,
            totalTokens: 2500,
            inputCost: 0.005,
            outputCost: 0.005,
            totalCost: 0.01,
            model: 'gpt-4o',
            provider: 'openai'
          },
          totalCost: 0.0113
        },
        {
          filename: 'file2.ts',
          summaryCost: {
            inputTokens: 500,
            outputTokens: 100,
            totalTokens: 600,
            inputCost: 0.0005,
            outputCost: 0.00015,
            totalCost: 0.00065,
            model: 'gpt-3.5-turbo',
            provider: 'openai'
          },
          reviewCost: null,
          totalCost: 0.00065
        }
      ]

      const summary = aggregateMetrics(files)

      expect(summary.files).toHaveLength(2)
      expect(summary.totalInputTokens).toBe(3500)
      expect(summary.totalOutputTokens).toBe(800)
      expect(summary.totalTokens).toBe(4300)
      expect(summary.totalCost).toBeCloseTo(0.01195, 5)
      expect(summary.lightModel).toBe('gpt-3.5-turbo')
      expect(summary.heavyModel).toBe('gpt-4o')
      expect(summary.lightModelCost).toBeCloseTo(0.00195, 5)
      expect(summary.heavyModelCost).toBeCloseTo(0.01, 5)
    })

    it('should handle files with only summary cost', () => {
      const files: FileCostMetrics[] = [
        {
          filename: 'file1.ts',
          summaryCost: {
            inputTokens: 1000,
            outputTokens: 200,
            totalTokens: 1200,
            inputCost: 0.001,
            outputCost: 0.0003,
            totalCost: 0.0013,
            model: 'gpt-3.5-turbo',
            provider: 'openai'
          },
          reviewCost: null,
          totalCost: 0.0013
        }
      ]

      const summary = aggregateMetrics(files)

      expect(summary.totalCost).toBeCloseTo(0.0013, 5)
      expect(summary.lightModelCost).toBeCloseTo(0.0013, 5)
      expect(summary.heavyModelCost).toBe(0)
      expect(summary.heavyModel).toBe('')
    })

    it('should handle empty file list', () => {
      const files: FileCostMetrics[] = []

      const summary = aggregateMetrics(files)

      expect(summary.files).toHaveLength(0)
      expect(summary.totalTokens).toBe(0)
      expect(summary.totalCost).toBe(0)
      expect(summary.lightModelCost).toBe(0)
      expect(summary.heavyModelCost).toBe(0)
    })
  })

  describe('formatCostMetrics', () => {
    it('should format cost metrics as markdown', () => {
      const files: FileCostMetrics[] = [
        {
          filename: 'expensive-file.ts',
          summaryCost: {
            inputTokens: 5000,
            outputTokens: 1000,
            totalTokens: 6000,
            inputCost: 0.0025,
            outputCost: 0.0015,
            totalCost: 0.004,
            model: 'gpt-3.5-turbo',
            provider: 'openai'
          },
          reviewCost: {
            inputTokens: 10000,
            outputTokens: 2000,
            totalTokens: 12000,
            inputCost: 0.025,
            outputCost: 0.02,
            totalCost: 0.045,
            model: 'gpt-4o',
            provider: 'openai'
          },
          totalCost: 0.049
        },
        {
          filename: 'cheap-file.ts',
          summaryCost: {
            inputTokens: 100,
            outputTokens: 20,
            totalTokens: 120,
            inputCost: 0.00005,
            outputCost: 0.00003,
            totalCost: 0.00008,
            model: 'gpt-3.5-turbo',
            provider: 'openai'
          },
          reviewCost: null,
          totalCost: 0.00008
        }
      ]

      const summary = aggregateMetrics(files)
      const markdown = formatCostMetrics(summary)

      expect(markdown).toContain('## 💰 Cost & Token Usage')
      expect(markdown).toContain('**Total Cost:**')
      expect(markdown).toContain('### Model Breakdown')
      expect(markdown).toContain('gpt-3.5-turbo')
      expect(markdown).toContain('gpt-4o')
      expect(markdown).toContain('### Top Files by Cost')
      expect(markdown).toContain('expensive-file.ts')
      // cheap-file.ts is below $0.001 threshold, so it should not appear
      expect(markdown).not.toContain('cheap-file.ts')
      expect(markdown).toContain('### Token Usage')
      expect(markdown).toContain('**Input Tokens:**')
      expect(markdown).toContain('**Output Tokens:**')
    })

    it('should include optimization tip for expensive reviews', () => {
      const files: FileCostMetrics[] = [
        {
          filename: 'file.ts',
          summaryCost: null,
          reviewCost: {
            inputTokens: 100000,
            outputTokens: 20000,
            totalTokens: 120000,
            inputCost: 0.5,
            outputCost: 0.6,
            totalCost: 1.1,
            model: 'gpt-4o',
            provider: 'openai'
          },
          totalCost: 1.1
        }
      ]

      const summary = aggregateMetrics(files)
      const markdown = formatCostMetrics(summary)

      expect(markdown).toContain('💡 **Tip:**')
      expect(markdown).toContain('gpt-4o-mini')
      expect(markdown).toContain('claude-3-haiku')
    })

    it('should not include optimization tip for cheap reviews', () => {
      const files: FileCostMetrics[] = [
        {
          filename: 'file.ts',
          summaryCost: {
            inputTokens: 1000,
            outputTokens: 200,
            totalTokens: 1200,
            inputCost: 0.0005,
            outputCost: 0.0003,
            totalCost: 0.0008,
            model: 'gpt-3.5-turbo',
            provider: 'openai'
          },
          reviewCost: null,
          totalCost: 0.0008
        }
      ]

      const summary = aggregateMetrics(files)
      const markdown = formatCostMetrics(summary)

      expect(markdown).not.toContain('💡 **Tip:**')
    })
  })

  describe('formatInlineCost', () => {
    it('should format very small costs with 4 decimals', () => {
      expect(formatInlineCost(0.0001)).toBe('$0.0001')
      expect(formatInlineCost(0.0099)).toBe('$0.0099')
    })

    it('should format small costs with 3 decimals', () => {
      expect(formatInlineCost(0.01)).toBe('$0.010')
      expect(formatInlineCost(0.5)).toBe('$0.500')
      expect(formatInlineCost(0.999)).toBe('$0.999')
    })

    it('should format large costs with 2 decimals', () => {
      expect(formatInlineCost(1.0)).toBe('$1.00')
      expect(formatInlineCost(5.5)).toBe('$5.50')
      expect(formatInlineCost(123.456)).toBe('$123.46')
    })
  })
})
