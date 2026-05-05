import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { gradeComment, gradeAll } from '../src/grader.js'
import { ZERO_USAGE } from '../src/openrouter.js'
import type { Principle, ReviewComment } from '../src/types.js'
import type { OpenRouterClient } from '../src/openrouter.js'

const create = jest.fn() as jest.MockedFunction<
  (args: unknown) => Promise<unknown>
>
const fakeClient = {
  chat: { completions: { create } }
} as unknown as OpenRouterClient

const principles: Principle[] = [
  { id: 'p1', description: 'd', severity: 'warning', category: 'correctness' }
]

const comment: ReviewComment = {
  file: 'a.ts',
  line: 1,
  type: 'bug',
  severity: 'warning',
  body: 'b',
  principle_cited: 'p1',
  reasoning: 'r'
}

const validScore = {
  confidence: 80,
  specificity: 70,
  calibration: 75,
  principle_alignment: 85,
  final_score: 78,
  rationale: 'matches'
}

describe('gradeComment', () => {
  beforeEach(() => create.mockReset())

  it('returns parsed score plus usage', async () => {
    create.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(validScore) } }],
      usage: { prompt_tokens: 200, completion_tokens: 30 }
    })
    const result = await gradeComment(fakeClient, 'm', comment, principles, {})
    expect(result.score.final_score).toBe(78)
    expect(result.usage).toEqual({ input_tokens: 200, output_tokens: 30 })
  })

  it('returns FAILED_SCORE on persistent malformed output but preserves billed usage', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: 'broken' } }],
      usage: { prompt_tokens: 150, completion_tokens: 4 }
    })
    const result = await gradeComment(fakeClient, 'm', comment, principles, {})
    expect(result.score.confidence).toBe(0)
    expect(result.score.final_score).toBe(0)
    // Both attempts billed; usage accumulates even on parse failure.
    expect(result.usage).toEqual({ input_tokens: 300, output_tokens: 8 })
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('returns ZERO_USAGE when API call itself throws', async () => {
    create.mockRejectedValue(new Error('network down'))
    const result = await gradeComment(fakeClient, 'm', comment, principles, {})
    expect(result.score.final_score).toBe(0)
    expect(result.usage).toEqual(ZERO_USAGE)
  })
})

describe('gradeAll', () => {
  beforeEach(() => create.mockReset())

  it('grades comments in parallel and sums usage', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validScore) } }],
      usage: { prompt_tokens: 100, completion_tokens: 20 }
    })
    const comments = [
      comment,
      { ...comment, file: 'b.ts' },
      { ...comment, file: 'c.ts' }
    ]
    const result = await gradeAll(fakeClient, 'm', comments, principles, {})
    expect(result.graded).toHaveLength(3)
    expect(result.graded.every((s) => s.score.final_score === 78)).toBe(true)
    expect(result.usage).toEqual({ input_tokens: 300, output_tokens: 60 })
  })
})
