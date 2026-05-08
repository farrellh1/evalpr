import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  computeCacheKey,
  loadReviewerCache,
  saveReviewerCache,
  type ReviewerCachePayload
} from '../src/eval/cache.js'

describe('computeCacheKey', () => {
  it('produces a stable hex string', () => {
    const k = computeCacheKey({
      reviewer_model: 'm',
      prompt: 'p',
      principles_json: '[]',
      diff: 'd'
    })
    expect(k).toMatch(/^[0-9a-f]{16}$/)
  })

  it('changes when any input changes', () => {
    const base = {
      reviewer_model: 'm',
      prompt: 'p',
      principles_json: '[]',
      diff: 'd'
    }
    const k0 = computeCacheKey(base)
    expect(computeCacheKey({ ...base, reviewer_model: 'm2' })).not.toBe(k0)
    expect(computeCacheKey({ ...base, prompt: 'p2' })).not.toBe(k0)
    expect(computeCacheKey({ ...base, principles_json: '[1]' })).not.toBe(k0)
    expect(computeCacheKey({ ...base, diff: 'd2' })).not.toBe(k0)
  })
})

describe('reviewer cache I/O', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'evalpr-cache-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('returns null on cache miss', async () => {
    const result = await loadReviewerCache(dir, 'somekey')
    expect(result).toBeNull()
  })

  it('returns null when stored key does not match', async () => {
    await mkdir(join(dir, '.cache'), { recursive: true })
    await writeFile(
      join(dir, '.cache', 'reviewer.json'),
      JSON.stringify({
        cache_key: 'old',
        comments: [],
        usage: {},
        generated_at: 'x',
        reviewer_model: 'm'
      })
    )
    const result = await loadReviewerCache(dir, 'new')
    expect(result).toBeNull()
  })

  it('returns payload when stored key matches', async () => {
    const payload: ReviewerCachePayload = {
      cache_key: 'matchme',
      reviewer_model: 'anthropic/claude-sonnet-4.6',
      generated_at: '2026-05-05T00:00:00Z',
      comments: [],
      usage: { input_tokens: 100, output_tokens: 20 }
    }
    await saveReviewerCache(dir, payload)
    const loaded = await loadReviewerCache(dir, 'matchme')
    expect(loaded).toEqual(payload)
  })
})
