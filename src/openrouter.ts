import OpenAI from 'openai'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export function createOpenRouterClient(apiKey: string): OpenAI {
  if (!apiKey) {
    throw new Error('OpenRouter api key is required')
  }
  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/farrellh1/evalpr',
      'X-Title': 'evalpr'
    }
  })
}

export type OpenRouterClient = OpenAI
