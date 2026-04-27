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
