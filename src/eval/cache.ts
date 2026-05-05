import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ReviewComment } from '../types.js'
import type { Usage } from '../openrouter.js'

export interface CacheKeyInputs {
  reviewer_model: string
  prompt: string
  principles_json: string
  diff: string
}

export interface ReviewerCachePayload {
  cache_key: string
  reviewer_model: string
  generated_at: string
  comments: ReviewComment[]
  usage: Usage
}

export function computeCacheKey(inputs: CacheKeyInputs): string {
  const h = createHash('sha256')
  h.update(inputs.reviewer_model)
  h.update('\0')
  h.update(inputs.prompt)
  h.update('\0')
  h.update(inputs.principles_json)
  h.update('\0')
  h.update(inputs.diff)
  return h.digest('hex').slice(0, 16)
}

function cachePath(fixtureDir: string): string {
  return join(fixtureDir, '.cache', 'reviewer.json')
}

export async function loadReviewerCache(
  fixtureDir: string,
  expectedKey: string
): Promise<ReviewerCachePayload | null> {
  try {
    const raw = await readFile(cachePath(fixtureDir), 'utf8')
    const payload = JSON.parse(raw) as ReviewerCachePayload
    if (payload.cache_key !== expectedKey) return null
    return payload
  } catch {
    return null
  }
}

export async function saveReviewerCache(
  fixtureDir: string,
  payload: ReviewerCachePayload
): Promise<void> {
  await mkdir(join(fixtureDir, '.cache'), { recursive: true })
  await writeFile(cachePath(fixtureDir), JSON.stringify(payload, null, 2))
}
