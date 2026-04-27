import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { postSkipSummary } from '../src/github-skip.js'
import type { Octokit } from '../src/github.js'

const createReview = jest.fn() as jest.MockedFunction<
  (args: unknown) => Promise<unknown>
>
const fakeOctokit = {
  rest: { pulls: { createReview } }
} as unknown as Octokit
const ref = { owner: 'o', repo: 'r', pull_number: 1 }

beforeEach(() => createReview.mockReset())

describe('postSkipSummary', () => {
  it('posts a draft skip summary', async () => {
    createReview.mockResolvedValue({})
    await postSkipSummary(fakeOctokit, ref, 'sha', 'draft')
    const body = (createReview.mock.calls[0][0] as { body: string }).body
    expect(body).toMatch(/skipped: draft/i)
  })

  it('posts a bot skip summary', async () => {
    createReview.mockResolvedValue({})
    await postSkipSummary(fakeOctokit, ref, 'sha', 'bot')
    expect((createReview.mock.calls[0][0] as { body: string }).body).toMatch(
      /bot/i
    )
  })

  it('includes file count for max-files skip', async () => {
    createReview.mockResolvedValue({})
    await postSkipSummary(fakeOctokit, ref, 'sha', 'max-files', 50)
    expect((createReview.mock.calls[0][0] as { body: string }).body).toMatch(
      /50 files/
    )
  })
})
