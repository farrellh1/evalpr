import { describe, it, expect } from '@jest/globals'
import {
  MODEL_PRICING,
  computeCost,
  addUsage,
  ZERO_USAGE,
  extractUsage,
  type Usage
} from '../src/openrouter.js'

describe('computeCost', () => {
  it('prices Sonnet 4.6 at $3/M input + $15/M output', () => {
    const cost = computeCost('anthropic/claude-sonnet-4.6', {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000
    })
    expect(cost).toBeCloseTo(18, 6)
  })

  it('prices Haiku 4.5 at $1/M input + $5/M output', () => {
    const cost = computeCost('anthropic/claude-haiku-4.5', {
      input_tokens: 100_000,
      output_tokens: 10_000
    })
    expect(cost).toBeCloseTo(0.1 + 0.05, 6)
  })

  it('prices Opus 4.7 at $15/M input + $75/M output', () => {
    const cost = computeCost('anthropic/claude-opus-4.7', {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000
    })
    expect(cost).toBeCloseTo(90, 6)
  })

  it('throws on unknown model so silent zero-cost bugs cannot hide', () => {
    expect(() =>
      computeCost('anthropic/claude-fictional-9.9', ZERO_USAGE)
    ).toThrow(/no pricing entry/i)
  })
})

describe('addUsage', () => {
  it('sums input and output tokens', () => {
    const a: Usage = { input_tokens: 10, output_tokens: 5 }
    const b: Usage = { input_tokens: 3, output_tokens: 7 }
    expect(addUsage(a, b)).toEqual({ input_tokens: 13, output_tokens: 12 })
  })

  it('ZERO_USAGE is the identity', () => {
    const u: Usage = { input_tokens: 7, output_tokens: 3 }
    expect(addUsage(u, ZERO_USAGE)).toEqual(u)
  })
})

describe('extractUsage', () => {
  it('reads prompt_tokens/completion_tokens from OpenAI-shaped response', () => {
    const res = { usage: { prompt_tokens: 100, completion_tokens: 50 } }
    expect(extractUsage(res)).toEqual({ input_tokens: 100, output_tokens: 50 })
  })

  it('returns ZERO_USAGE if usage is missing', () => {
    expect(extractUsage({})).toEqual(ZERO_USAGE)
    expect(extractUsage({ usage: undefined })).toEqual(ZERO_USAGE)
  })
})

describe('MODEL_PRICING', () => {
  it('covers the three models used in eval', () => {
    expect(MODEL_PRICING['anthropic/claude-sonnet-4.6']).toBeDefined()
    expect(MODEL_PRICING['anthropic/claude-haiku-4.5']).toBeDefined()
    expect(MODEL_PRICING['anthropic/claude-opus-4.7']).toBeDefined()
  })
})
