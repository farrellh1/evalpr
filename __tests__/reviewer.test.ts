import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { callReviewer } from '../src/reviewer.js'
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
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                file: 'a.ts',
                line: 1,
                type: 'bug',
                severity: 'warning',
                body: 'b',
                principle_cited: 'p1',
                reasoning: 'r'
              }
            ])
          }
        }
      ]
    })

    const result = await callReviewer(
      fakeClient,
      'anthropic/claude-sonnet-4.6',
      'diff content',
      principles,
      ctx
    )

    expect(result).toHaveLength(1)
    expect(result[0].file).toBe('a.ts')
  })

  it('strips markdown code fences if present', async () => {
    create.mockResolvedValueOnce({
      choices: [{ message: { content: '```json\n[]\n```' } }]
    })
    const result = await callReviewer(fakeClient, 'm', 'd', principles, ctx)
    expect(result).toEqual([])
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
        choices: [{ message: { content: 'not json' } }]
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  file: 'b.ts',
                  line: 7,
                  type: 'bug',
                  severity: 'warning',
                  body: 'b',
                  principle_cited: 'p1',
                  reasoning: 'r'
                }
              ])
            }
          }
        ]
      })

    const result = await callReviewer(fakeClient, 'm', 'd', principles, ctx)
    expect(result).toHaveLength(1)
    expect(result[0].file).toBe('b.ts')
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
})
