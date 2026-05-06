import { describe, it, expect } from '@jest/globals'
import { spearman, ranks } from '../src/stats.js'

describe('ranks', () => {
  it('assigns 1-based ranks ascending', () => {
    expect(ranks([10, 20, 30])).toEqual([1, 2, 3])
    expect(ranks([30, 10, 20])).toEqual([3, 1, 2])
  })

  it('averages ties', () => {
    // [10, 10, 20] → ranks 1.5, 1.5, 3
    expect(ranks([10, 10, 20])).toEqual([1.5, 1.5, 3])
  })
})

describe('spearman', () => {
  it('returns 1.0 for perfectly monotonic pairs', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 6)
  })

  it('returns -1.0 for perfectly inverse pairs', () => {
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1, 6)
  })

  it('returns ~0 for uncorrelated pairs', () => {
    const r = spearman([1, 2, 3, 4], [3, 1, 4, 2])
    expect(Math.abs(r)).toBeLessThan(0.5)
  })

  it('throws on length mismatch', () => {
    expect(() => spearman([1, 2], [1, 2, 3])).toThrow(/length/i)
  })

  it('throws on empty input', () => {
    expect(() => spearman([], [])).toThrow(/empty/i)
  })
})
