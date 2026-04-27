import { describe, it, expect } from '@jest/globals'
import { loadConfig, mergePrinciples } from '../src/config.js'
import type { Principle } from '../src/types.js'

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

describe('loadConfig', () => {
  it('returns empty config when file is missing', async () => {
    expect(await loadConfig('/repo', '.evalpr.yml', makeReader({}))).toEqual({})
  })

  it('parses a valid yaml config', async () => {
    const cfg = await loadConfig(
      '/repo',
      '.evalpr.yml',
      makeReader({
        '.evalpr.yml':
          'review:\n  confidence_threshold: 80\n  ignore_paths:\n    - "legacy/**"\n'
      })
    )
    expect(cfg.review?.confidence_threshold).toBe(80)
  })

  it('returns empty config on malformed yaml (does not throw)', async () => {
    expect(
      await loadConfig(
        '/repo',
        '.evalpr.yml',
        makeReader({ '.evalpr.yml': 'bad: : :' })
      )
    ).toEqual({})
  })
})

const defaults: Principle[] = [
  { id: 'a', description: 'a', severity: 'warning', category: 'correctness' },
  { id: 'b', description: 'b', severity: 'warning', category: 'correctness' }
]

describe('mergePrinciples', () => {
  it('returns defaults when config is empty', () => {
    expect(mergePrinciples(defaults, {})).toEqual(defaults)
  })

  it('removes principles by id', () => {
    expect(
      mergePrinciples(defaults, { principles: { remove: ['a'] } })
    ).toEqual([defaults[1]])
  })

  it('adds new principles', () => {
    const added: Principle = {
      id: 'c',
      description: 'c',
      severity: 'warning',
      category: 'project'
    }
    const out = mergePrinciples(defaults, { principles: { add: [added] } })
    expect(out).toHaveLength(3)
    expect(out.find((p) => p.id === 'c')).toEqual(added)
  })

  it('overrides existing principles by id', () => {
    const override: Principle = {
      id: 'a',
      description: 'NEW',
      severity: 'error',
      category: 'correctness'
    }
    const out = mergePrinciples(defaults, {
      principles: { override: [override] }
    })
    expect(out.find((p) => p.id === 'a')?.description).toBe('NEW')
  })

  it('add of an existing id wins (treated as override)', () => {
    const dup: Principle = {
      id: 'a',
      description: 'DUP',
      severity: 'error',
      category: 'correctness'
    }
    const out = mergePrinciples(defaults, { principles: { add: [dup] } })
    expect(out.find((p) => p.id === 'a')?.description).toBe('DUP')
  })
})
