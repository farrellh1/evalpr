import { describe, it, expect } from '@jest/globals'
import { createOpenRouterClient } from '../src/openrouter.js'

describe('createOpenRouterClient', () => {
  it('creates a client with the OpenRouter base URL', () => {
    const client = createOpenRouterClient('test-key')
    expect(client.baseURL).toBe('https://openrouter.ai/api/v1')
  })

  it('throws if no api key', () => {
    expect(() => createOpenRouterClient('')).toThrow(/api key/i)
  })
})
