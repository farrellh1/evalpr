import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { fetchDiff, postReview, type Octokit } from '../src/github.js'
import type { GradedComment } from '../src/types.js'

const get = jest.fn() as jest.MockedFunction<
  (args: unknown) => Promise<unknown>
>
const createReviewComment = jest.fn() as jest.MockedFunction<
  (args: unknown) => Promise<unknown>
>
const createReview = jest.fn() as jest.MockedFunction<
  (args: unknown) => Promise<unknown>
>

const fakeOctokit = {
  rest: {
    pulls: { get, createReviewComment, createReview }
  }
} as unknown as Octokit

const ref = { owner: 'o', repo: 'r', pull_number: 1 }

beforeEach(() => {
  get.mockReset()
  createReviewComment.mockReset()
  createReview.mockReset()
})

const make = (file: string, line: number): GradedComment => ({
  file,
  line,
  type: 'bug',
  severity: 'warning',
  body: `Issue at ${file}:${line}`,
  principle_cited: 'p',
  reasoning: 'r',
  score: {
    confidence: 80,
    specificity: 80,
    calibration: 80,
    principle_alignment: 80,
    final_score: 80,
    rationale: 'x'
  },
  retained: true
})

describe('fetchDiff', () => {
  it('requests diff format and returns string', async () => {
    get.mockResolvedValueOnce({ data: 'diff content' })
    const diff = await fetchDiff(fakeOctokit, ref)
    expect(diff).toBe('diff content')
    const call = get.mock.calls[0][0] as { mediaType: { format: string } }
    expect(call.mediaType.format).toBe('diff')
  })
})

describe('postReview', () => {
  it('posts inline comment per retained comment + summary', async () => {
    const retained = [make('a.ts', 1), make('b.ts', 2)]
    createReviewComment.mockResolvedValue({})
    createReview.mockResolvedValue({})

    await postReview(fakeOctokit, ref, retained, 3, 'commit-sha', ['p'])

    expect(createReviewComment).toHaveBeenCalledTimes(2)
    expect(createReview).toHaveBeenCalledTimes(1)

    const summary = (createReview.mock.calls[0][0] as { body: string }).body
    expect(summary).toMatch(/2 high-confidence/)
    expect(summary).toMatch(/3 low-confidence/)
  })

  it('continues if one inline comment fails', async () => {
    const retained = [make('a.ts', 1), make('b.ts', 2)]
    createReviewComment
      .mockRejectedValueOnce(new Error('rate limit'))
      .mockResolvedValueOnce({})
    createReview.mockResolvedValue({})

    await postReview(fakeOctokit, ref, retained, 0, 'sha', [])

    expect(createReviewComment).toHaveBeenCalledTimes(2)
    expect(createReview).toHaveBeenCalledTimes(1)
  })

  it('still posts summary even if zero retained', async () => {
    createReview.mockResolvedValue({})
    await postReview(fakeOctokit, ref, [], 5, 'sha', ['p'])
    expect(createReview).toHaveBeenCalledTimes(1)
    expect(createReviewComment).not.toHaveBeenCalled()
  })
})
