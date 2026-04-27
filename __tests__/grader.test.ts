import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { gradeComment, gradeAll } from '../src/grader.js'
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

  it('returns a parsed Score', async () => {
    create.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(validScore) } }]
    })
    const score = await gradeComment(fakeClient, 'm', comment, principles, {})
    expect(score.final_score).toBe(78)
  })

  it('returns confidence=0 score on persistent malformed output', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: 'broken' } }]
    })
    const score = await gradeComment(fakeClient, 'm', comment, principles, {})
    expect(score.confidence).toBe(0)
    expect(score.final_score).toBe(0)
    expect(create).toHaveBeenCalledTimes(2)
  })
})

describe('gradeAll', () => {
  beforeEach(() => create.mockReset())

  it('grades comments in parallel', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validScore) } }]
    })
    const comments = [
      comment,
      { ...comment, file: 'b.ts' },
      { ...comment, file: 'c.ts' }
    ]
    const scored = await gradeAll(fakeClient, 'm', comments, principles, {})
    expect(scored).toHaveLength(3)
    expect(scored.every((s) => s.score.final_score === 78)).toBe(true)
  })
})
