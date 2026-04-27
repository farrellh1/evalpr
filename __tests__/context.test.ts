import { describe, it, expect } from '@jest/globals'
import {
  loadContext,
  MAX_PER_FILE_BYTES,
  MAX_TOTAL_BYTES
} from '../src/context.js'

function makeReader(files: Record<string, string>) {
  return async (path: string): Promise<string> => {
    const name = path.split('/').pop()!
    if (!(name in files)) {
      const err = new Error('ENOENT')
      ;(err as NodeJS.ErrnoException).code = 'ENOENT'
      throw err
    }
    return files[name]
  }
}

describe('loadContext', () => {
  it('returns empty when no files present', async () => {
    const ctx = await loadContext('/repo', makeReader({}))
    expect(ctx).toEqual({})
  })

  it('reads CONVENTIONS.md, README.md, CONTRIBUTING.md', async () => {
    const ctx = await loadContext(
      '/repo',
      makeReader({
        'CONVENTIONS.md': 'conv',
        'README.md': 'rdm',
        'CONTRIBUTING.md': 'contrib'
      })
    )
    expect(ctx.conventions).toBe('conv')
    expect(ctx.readme).toBe('rdm')
    expect(ctx.contributing).toBe('contrib')
  })

  it('truncates files larger than per-file budget', async () => {
    const big = 'x'.repeat(MAX_PER_FILE_BYTES + 100)
    const ctx = await loadContext('/repo', makeReader({ 'README.md': big }))
    expect(ctx.readme!.length).toBeLessThanOrEqual(
      MAX_PER_FILE_BYTES + 200 // truncation marker overhead
    )
    expect(ctx.readme).toMatch(/\[truncated\]/)
  })

  it('respects total context budget', async () => {
    const each = 'x'.repeat(MAX_PER_FILE_BYTES)
    const ctx = await loadContext(
      '/repo',
      makeReader({
        'CONVENTIONS.md': each,
        'README.md': each,
        'CONTRIBUTING.md': each
      })
    )
    const total =
      (ctx.conventions?.length ?? 0) +
      (ctx.readme?.length ?? 0) +
      (ctx.contributing?.length ?? 0)
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_BYTES + 600) // markers overhead
  })
})
