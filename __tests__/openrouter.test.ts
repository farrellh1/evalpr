import { describe, it, expect } from '@jest/globals'
import {
  createOpenRouterClient,
  OPENROUTER_BASE_URL
} from '../src/openrouter.js'

describe('createOpenRouterClient', () => {
  it('creates a client pointed at the OpenRouter base URL', () => {
    const client = createOpenRouterClient('test-key')
    expect(client.baseURL).toBe(OPENROUTER_BASE_URL)
  })

  it('throws if no api key', () => {
    expect(() => createOpenRouterClient('')).toThrow(/api key/i)
  })

  it('throws if api key is whitespace only', () => {
    expect(() => createOpenRouterClient('   ')).toThrow(/api key/i)
  })
})
