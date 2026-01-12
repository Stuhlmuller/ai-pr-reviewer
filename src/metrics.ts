/**
 * Cost tracking and metrics collection for AI API usage
 *
 * Tracks token usage and costs across different AI providers and models
 */

export interface ModelPricing {
  inputCostPer1M: number // Cost per 1M input tokens in USD
  outputCostPer1M: number // Cost per 1M output tokens in USD
  provider: 'openai' | 'anthropic'
}

/**
 * Model pricing as of January 2025
 * Source: https://openai.com/api/pricing/ and https://www.anthropic.com/pricing
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI GPT-4o models
  'gpt-4o': {
    inputCostPer1M: 2.5,
    outputCostPer1M: 10.0,
    provider: 'openai'
  },
  'chatgpt-4o-latest': {
    inputCostPer1M: 2.5,
    outputCostPer1M: 10.0,
    provider: 'openai'
  },
  'gpt-4o-mini': {
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
    provider: 'openai'
  },

  // OpenAI o1 models (reasoning models, higher cost)
  'o1-preview': {
    inputCostPer1M: 15.0,
    outputCostPer1M: 60.0,
    provider: 'openai'
  },
  'o1-mini': {
    inputCostPer1M: 3.0,
    outputCostPer1M: 12.0,
    provider: 'openai'
  },

  // OpenAI GPT-4 Turbo models
  'gpt-4-turbo': {
    inputCostPer1M: 10.0,
    outputCostPer1M: 30.0,
    provider: 'openai'
  },
  'gpt-4-turbo-2024-04-09': {
    inputCostPer1M: 10.0,
    outputCostPer1M: 30.0,
    provider: 'openai'
  },
  'gpt-4-turbo-preview': {
    inputCostPer1M: 10.0,
    outputCostPer1M: 30.0,
    provider: 'openai'
  },
  'gpt-4-0125-preview': {
    inputCostPer1M: 10.0,
    outputCostPer1M: 30.0,
    provider: 'openai'
  },
  'gpt-4-1106-preview': {
    inputCostPer1M: 10.0,
    outputCostPer1M: 30.0,
    provider: 'openai'
  },

  // Original GPT-4 models
  'gpt-4': {
    inputCostPer1M: 30.0,
    outputCostPer1M: 60.0,
    provider: 'openai'
  },
  'gpt-4-32k': {
    inputCostPer1M: 60.0,
    outputCostPer1M: 120.0,
    provider: 'openai'
  },

  // GPT-3.5 Turbo models (most cost-effective)
  'gpt-3.5-turbo': {
    inputCostPer1M: 0.5,
    outputCostPer1M: 1.5,
    provider: 'openai'
  },
  'gpt-3.5-turbo-0125': {
    inputCostPer1M: 0.5,
    outputCostPer1M: 1.5,
    provider: 'openai'
  },
  'gpt-3.5-turbo-1106': {
    inputCostPer1M: 1.0,
    outputCostPer1M: 2.0,
    provider: 'openai'
  },
  'gpt-3.5-turbo-16k': {
    inputCostPer1M: 3.0,
    outputCostPer1M: 4.0,
    provider: 'openai'
  },

  // Anthropic Claude Opus models
  'claude-opus-4': {
    inputCostPer1M: 15.0,
    outputCostPer1M: 75.0,
    provider: 'anthropic'
  },
  'claude-opus-4-20250514': {
    inputCostPer1M: 15.0,
    outputCostPer1M: 75.0,
    provider: 'anthropic'
  },
  'claude-opus-4.5': {
    inputCostPer1M: 15.0,
    outputCostPer1M: 75.0,
    provider: 'anthropic'
  },

  // Anthropic Claude Sonnet models
  'claude-sonnet-4': {
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    provider: 'anthropic'
  },
  'claude-sonnet-4-20250514': {
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    provider: 'anthropic'
  },
  'claude-sonnet-4.5': {
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    provider: 'anthropic'
  },
  'claude-3-5-sonnet-20241022': {
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    provider: 'anthropic'
  },
  'claude-3-5-sonnet-20240620': {
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    provider: 'anthropic'
  },

  // Anthropic Claude Haiku models (most cost-effective)
  'claude-3-5-haiku-20241022': {
    inputCostPer1M: 0.8,
    outputCostPer1M: 4.0,
    provider: 'anthropic'
  },
  'claude-3-haiku-20240307': {
    inputCostPer1M: 0.25,
    outputCostPer1M: 1.25,
    provider: 'anthropic'
  }
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  model: string
}

export interface CostMetrics {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  inputCost: number
  outputCost: number
  totalCost: number
  model: string
  provider: 'openai' | 'anthropic'
}

export interface FileCostMetrics {
  filename: string
  summaryCost: CostMetrics | null
  reviewCost: CostMetrics | null
  totalCost: number
}

export interface PRCostSummary {
  files: FileCostMetrics[]
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCost: number
  lightModelCost: number
  heavyModelCost: number
  lightModel: string
  heavyModel: string
}

/**
 * Calculate cost for a given token usage and model
 */
export function calculateCost(usage: TokenUsage): CostMetrics {
  const pricing = MODEL_PRICING[usage.model]

  if (!pricing) {
    // Default to GPT-3.5 Turbo pricing if model not found
    return {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.inputTokens + usage.outputTokens,
      inputCost: (usage.inputTokens / 1_000_000) * 0.5,
      outputCost: (usage.outputTokens / 1_000_000) * 1.5,
      totalCost:
        (usage.inputTokens / 1_000_000) * 0.5 +
        (usage.outputTokens / 1_000_000) * 1.5,
      model: usage.model,
      provider: 'openai'
    }
  }

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputCostPer1M
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputCostPer1M

  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.inputTokens + usage.outputTokens,
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    model: usage.model,
    provider: pricing.provider
  }
}

/**
 * Aggregate metrics across multiple files
 */
export function aggregateMetrics(files: FileCostMetrics[]): PRCostSummary {
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCost = 0
  let lightModelCost = 0
  let heavyModelCost = 0
  let lightModel = ''
  let heavyModel = ''

  for (const file of files) {
    if (file.summaryCost) {
      totalInputTokens += file.summaryCost.inputTokens
      totalOutputTokens += file.summaryCost.outputTokens
      totalCost += file.summaryCost.totalCost
      lightModelCost += file.summaryCost.totalCost
      lightModel = file.summaryCost.model
    }

    if (file.reviewCost) {
      totalInputTokens += file.reviewCost.inputTokens
      totalOutputTokens += file.reviewCost.outputTokens
      totalCost += file.reviewCost.totalCost
      heavyModelCost += file.reviewCost.totalCost
      heavyModel = file.reviewCost.model
    }
  }

  return {
    files,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    totalCost,
    lightModelCost,
    heavyModelCost,
    lightModel,
    heavyModel
  }
}

/**
 * Format cost metrics as markdown for PR comment
 */
export function formatCostMetrics(summary: PRCostSummary): string {
  const lines: string[] = []

  lines.push('## 💰 Cost & Token Usage')
  lines.push('')
  lines.push(
    `**Total Cost:** $${summary.totalCost.toFixed(
      4
    )} (${summary.totalTokens.toLocaleString()} tokens)`
  )
  lines.push('')

  // Model breakdown
  if (summary.lightModel || summary.heavyModel) {
    lines.push('### Model Breakdown')
    lines.push('')

    if (summary.lightModel) {
      lines.push(
        `- **Light Model** (\`${
          summary.lightModel
        }\`): $${summary.lightModelCost.toFixed(4)}`
      )
    }

    if (summary.heavyModel) {
      lines.push(
        `- **Heavy Model** (\`${
          summary.heavyModel
        }\`): $${summary.heavyModelCost.toFixed(4)}`
      )
    }

    lines.push('')
  }

  // File-level breakdown (only for files with significant cost)
  const significantFiles = summary.files
    .filter(file => file.totalCost > 0.001) // Only show files costing more than $0.001
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 10) // Top 10 most expensive files

  if (significantFiles.length > 0) {
    lines.push('### Top Files by Cost')
    lines.push('')
    lines.push('| File | Summary | Review | Total |')
    lines.push('|------|---------|--------|-------|')

    for (const file of significantFiles) {
      const summaryStr = file.summaryCost
        ? `$${file.summaryCost.totalCost.toFixed(4)}`
        : '-'
      const reviewStr = file.reviewCost
        ? `$${file.reviewCost.totalCost.toFixed(4)}`
        : '-'
      const totalStr = `$${file.totalCost.toFixed(4)}`

      lines.push(
        `| \`${file.filename}\` | ${summaryStr} | ${reviewStr} | ${totalStr} |`
      )
    }

    lines.push('')
  }

  // Token breakdown
  lines.push('### Token Usage')
  lines.push('')
  lines.push(`- **Input Tokens:** ${summary.totalInputTokens.toLocaleString()}`)
  lines.push(
    `- **Output Tokens:** ${summary.totalOutputTokens.toLocaleString()}`
  )
  lines.push('')

  // Cost optimization tip
  if (summary.totalCost > 1.0) {
    lines.push('> 💡 **Tip:** Consider using cheaper models for summaries:')
    lines.push('> - OpenAI: `gpt-4o-mini` ($0.15/$0.60 per 1M tokens)')
    lines.push('> - Anthropic: `claude-3-haiku` ($0.25/$1.25 per 1M tokens)')
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Format cost as a concise string for inline display
 */
export function formatInlineCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`
  } else if (cost < 1.0) {
    return `$${cost.toFixed(3)}`
  }
  return `$${cost.toFixed(2)}`
}
