import { describe, it, expect } from '@jest/globals'
import { filterByThreshold } from '../src/filter.js'
import type { GradedComment } from '../src/types.js'

const make = (final_score: number, file = 'a.ts'): GradedComment => ({
  file,
  line: 1,
  type: 'bug',
  severity: 'warning',
  body: 'b',
  principle_cited: 'p',
  reasoning: 'r',
  score: {
    confidence: final_score,
    specificity: final_score,
    calibration: final_score,
    principle_alignment: final_score,
    final_score,
    rationale: 'x'
  },
  retained: false
})

describe('filterByThreshold', () => {
  it('marks comments at or above threshold as retained', () => {
    const out = filterByThreshold([make(70), make(69)], 70)
    expect(out[0].retained).toBe(true)
    expect(out[1].retained).toBe(false)
  })

  it('all retained when threshold is 0', () => {
    const out = filterByThreshold([make(0), make(50), make(100)], 0)
    expect(out.every((c) => c.retained)).toBe(true)
  })

  it('none retained when threshold is 101', () => {
    const out = filterByThreshold([make(100)], 101)
    expect(out[0].retained).toBe(false)
  })
})
