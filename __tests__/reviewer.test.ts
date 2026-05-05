import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { callReviewer, sanitizeJsonEscapes } from '../src/reviewer.js'
import { ZERO_USAGE } from '../src/openrouter.js'
import type { Principle, Context } from '../src/types.js'
import type { OpenRouterClient } from '../src/openrouter.js'

const create = jest.fn() as jest.MockedFunction<
  (args: unknown) => Promise<unknown>
>
const fakeClient = {
  chat: { completions: { create } }
} as unknown as OpenRouterClient

const principles: Principle[] = [
  { id: 'p1', description: 'd1', severity: 'warning', category: 'correctness' }
]
const ctx: Context = {}

describe('callReviewer', () => {
  beforeEach(() => create.mockReset())

  it('parses a valid JSON array response', async () => {
    create.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify([{
        file: 'a.ts', line: 1, type: 'bug', severity: 'warning',
        body: 'b', principle_cited: 'p1', reasoning: 'r'
      }]) } }],
      usage: { prompt_tokens: 100, completion_tokens: 20 }
    })

    const result = await callReviewer(
      fakeClient,
      'anthropic/claude-sonnet-4.6',
      'diff content',
      principles,
      ctx
    )

    expect(result.comments).toHaveLength(1)
    expect(result.comments[0].file).toBe('a.ts')
    expect(result.usage).toEqual({ input_tokens: 100, output_tokens: 20 })
  })

  it('strips markdown code fences if present', async () => {
    create.mockResolvedValueOnce({
      choices: [{ message: { content: '```json\n[]\n```' } }]
    })
    const result = await callReviewer(fakeClient, 'm', 'd', principles, ctx)
    expect(result.comments).toEqual([])
    expect(result.usage).toEqual(ZERO_USAGE)
  })

  it('retries once on malformed JSON, then throws', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: 'not json' } }]
    })

    await expect(
      callReviewer(fakeClient, 'm', 'd', principles, ctx)
    ).rejects.toThrow(/malformed/i)

    expect(create).toHaveBeenCalledTimes(2)
  })

  it('rejects on Zod validation failure even if JSON parses', async () => {
    create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([{ file: 'a' }]) // missing required fields
          }
        }
      ]
    })

    await expect(
      callReviewer(fakeClient, 'm', 'd', principles, ctx)
    ).rejects.toThrow()
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('returns valid output from second attempt when first attempt is malformed', async () => {
    create
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'not json' } }],
        usage: { prompt_tokens: 50, completion_tokens: 5 }
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify([{
          file: 'b.ts', line: 7, type: 'bug', severity: 'warning',
          body: 'b', principle_cited: 'p1', reasoning: 'r'
        }]) } }],
        usage: { prompt_tokens: 60, completion_tokens: 8 }
      })

    const result = await callReviewer(fakeClient, 'm', 'd', principles, ctx)
    expect(result.comments).toHaveLength(1)
    expect(result.comments[0].file).toBe('b.ts')
    // failed attempt's tokens are billed and counted
    expect(result.usage).toEqual({ input_tokens: 110, output_tokens: 13 })
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('throws a clear error when content is empty', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: '' } }]
    })
    await expect(
      callReviewer(fakeClient, 'm', 'd', principles, ctx)
    ).rejects.toThrow(/malformed after retry/i)
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('recovers when the model emits invalid backslash escapes (e.g. \\%)', async () => {
    const raw =
      '[{"file":"a.ts","line":1,"type":"bug","severity":"warning",' +
      '"body":"Use \\% wildcard","principle_cited":"p1","reasoning":"r"}]'
    create.mockResolvedValueOnce({
      choices: [{ message: { content: raw } }]
    })

    const result = await callReviewer(fakeClient, 'm', 'd', principles, ctx)
    expect(result.comments).toHaveLength(1)
    expect(result.comments[0].body).toContain('\\%')
    expect(create).toHaveBeenCalledTimes(1)
  })
})

describe('sanitizeJsonEscapes', () => {
  it('escapes invalid backslash sequences', () => {
    expect(sanitizeJsonEscapes('foo\\%bar')).toBe('foo\\\\%bar')
    expect(sanitizeJsonEscapes('regex \\d+')).toBe('regex \\\\d+')
  })

  it('preserves valid JSON escapes', () => {
    expect(sanitizeJsonEscapes('line\\nbreak')).toBe('line\\nbreak')
    expect(sanitizeJsonEscapes('quote\\"')).toBe('quote\\"')
    expect(sanitizeJsonEscapes('back\\\\slash')).toBe('back\\\\slash')
    expect(sanitizeJsonEscapes('unicode\\u0041')).toBe('unicode\\u0041')
  })

  it('passes through strings with no backslashes', () => {
    expect(sanitizeJsonEscapes('plain text')).toBe('plain text')
  })
})
