import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { run, type RunDeps } from '../src/main.js'

function makeDeps(overrides: Partial<RunDeps> = {}): RunDeps {
  const setFailed = jest.fn()
  const warning = jest.fn()
  const setOutput = jest.fn()
  const info = jest.fn()
  const debug = jest.fn()
  const inputs: Record<string, string> = {
    api_key: 'test-key',
    reviewer_model: 'm-rev',
    grader_model: 'm-grade',
    confidence_threshold: '70',
    ignore_paths: 'dist/**',
    max_files: '20',
    skip_drafts: 'true',
    config_path: '.evalpr.yml'
  }
  const getInput = jest.fn(
    (name: unknown): string => inputs[name as string] ?? ''
  )

  const createReview = jest.fn().mockResolvedValue({})
  const createReviewComment = jest.fn().mockResolvedValue({})
  const get = jest.fn().mockResolvedValue({ data: 'diff content' })
  const octokit = {
    rest: { pulls: { get, createReview, createReviewComment } }
  }

  const core = {
    getInput,
    setFailed,
    warning,
    setOutput,
    info,
    debug
  } as unknown as typeof import('@actions/core')

  const github = {
    getOctokit: jest.fn(() => octokit),
    context: {
      repo: { owner: 'o', repo: 'r' },
      payload: {
        pull_request: {
          number: 1,
          draft: false,
          user: { type: 'User' },
          title: 'Test PR',
          changed_files: 2,
          head: { sha: 'sha-abc' }
        }
      }
    }
  } as unknown as typeof import('@actions/github')

  const validReviewerComment = {
    file: 'src/x.ts',
    line: 5,
    type: 'bug' as const,
    severity: 'warning' as const,
    body: 'null deref',
    principle_cited: 'null-undefined-handling',
    reasoning: 'unsafe access'
  }

  const validScore = {
    confidence: 85,
    specificity: 80,
    calibration: 80,
    principle_alignment: 90,
    final_score: 84,
    rationale: 'matches'
  }

  const callReviewer = jest.fn().mockResolvedValue([validReviewerComment])
  const gradeAll = jest
    .fn()
    .mockResolvedValue([
      { ...validReviewerComment, score: validScore, retained: false }
    ])
  const postReview = jest.fn().mockResolvedValue(undefined)
  const postSkipSummary = jest.fn().mockResolvedValue(undefined)
  const loadConfig = jest.fn().mockResolvedValue({})
  const loadContext = jest.fn().mockResolvedValue({})
  const fetchDiff = jest.fn().mockResolvedValue('diff content')
  const createClient = jest.fn().mockReturnValue({})

  return {
    core,
    github,
    createClient: createClient as unknown as RunDeps['createClient'],
    callReviewer: callReviewer as unknown as RunDeps['callReviewer'],
    gradeAll: gradeAll as unknown as RunDeps['gradeAll'],
    postReview: postReview as unknown as RunDeps['postReview'],
    postSkipSummary: postSkipSummary as unknown as RunDeps['postSkipSummary'],
    loadConfig: loadConfig as unknown as RunDeps['loadConfig'],
    loadContext: loadContext as unknown as RunDeps['loadContext'],
    fetchDiff: fetchDiff as unknown as RunDeps['fetchDiff'],
    ...overrides
  }
}

describe('run (integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('happy path: posts retained finding + summary', async () => {
    const deps = makeDeps()
    await run(deps)
    expect(deps.core.setFailed).not.toHaveBeenCalled()
    expect(deps.postReview).toHaveBeenCalledTimes(1)
    expect(deps.postSkipSummary).not.toHaveBeenCalled()
  })

  it('skips drafts cleanly', async () => {
    const deps = makeDeps()
    ;(deps.github.context.payload.pull_request as { draft: boolean }).draft =
      true
    await run(deps)
    expect(deps.core.setFailed).not.toHaveBeenCalled()
    expect(deps.fetchDiff).not.toHaveBeenCalled()
    expect(deps.postSkipSummary).toHaveBeenCalledTimes(1)
    expect(deps.postSkipSummary).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'sha-abc',
      'draft',
      2
    )
  })

  it('soft-fails on malformed reviewer output (posts summary, exits 0)', async () => {
    const callReviewer = jest
      .fn()
      .mockRejectedValue(
        new Error('Reviewer output malformed after retry: ...')
      ) as unknown as RunDeps['callReviewer']
    const deps = makeDeps({ callReviewer })
    await run(deps)
    expect(deps.core.setFailed).not.toHaveBeenCalled()
    expect(deps.core.warning).toHaveBeenCalled()
    // Verify the malformed-soft-fallback summary review was posted via
    // octokit (we look it up via the github mock):
    const octokit = (deps.github.getOctokit as unknown as jest.Mock).mock
      .results[0]?.value as {
      rest: { pulls: { createReview: jest.Mock } }
    }
    expect(octokit.rest.pulls.createReview).toHaveBeenCalled()
    expect(deps.postReview).not.toHaveBeenCalled()
  })

  it('hard-fails when api_key is missing', async () => {
    const deps = makeDeps()
    ;(deps.core.getInput as unknown as jest.Mock).mockImplementation(
      (name: unknown) => (name === 'api_key' ? '' : 'x')
    )
    await run(deps)
    expect(deps.core.setFailed).toHaveBeenCalled()
  })
})
