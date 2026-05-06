import OpenAI from 'openai'

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export function createOpenRouterClient(apiKey: string): OpenAI {
  if (!apiKey?.trim()) {
    throw new Error('OpenRouter api key is required')
  }
  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      // Required by OpenRouter for attribution; do not remove.
      'HTTP-Referer': 'https://github.com/farrellh1/evalpr',
      'X-Title': 'evalpr'
    }
  })
}

export type OpenRouterClient = OpenAI

// USD per million tokens. List price (Anthropic). OpenRouter charges ~5% over.
// Source: anthropic.com/pricing as of 2026-05-05.
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'anthropic/claude-sonnet-4.6': { input: 3, output: 15 },
  'anthropic/claude-haiku-4.5': { input: 1, output: 5 },
  'anthropic/claude-opus-4.7': { input: 15, output: 75 }
}

export interface Usage {
  input_tokens: number
  output_tokens: number
}

export const ZERO_USAGE: Usage = { input_tokens: 0, output_tokens: 0 }

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens
  }
}

export function computeCost(model: string, usage: Usage): number {
  const p = MODEL_PRICING[model]
  if (!p) {
    throw new Error(
      `computeCost: no pricing entry for model "${model}". Add it to MODEL_PRICING in src/openrouter.ts.`
    )
  }
  return (
    (usage.input_tokens / 1_000_000) * p.input +
    (usage.output_tokens / 1_000_000) * p.output
  )
}

interface MaybeUsageResponse {
  usage?: { prompt_tokens?: number; completion_tokens?: number } | undefined
}

export function extractUsage(res: MaybeUsageResponse): Usage {
  return {
    input_tokens: res.usage?.prompt_tokens ?? 0,
    output_tokens: res.usage?.completion_tokens ?? 0
  }
}
