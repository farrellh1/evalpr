import { describe, it, expect } from '@jest/globals'
import { matchAgainstExpected } from '../../src/eval/match.js'
import type { GradedComment } from '../../src/types.js'
import type { Expected } from '../../src/eval/fixture.js'

const principleByCategory: Record<string, string> = {
  correctness: 'null-undefined-handling',
  security: 'input-validation',
  readability: 'naming-clarity',
  maintainability: 'orthogonality',
  performance: 'obvious-quadratic',
  testing: 'testability',
  project: 'match-existing-conventions'
}

const make = (file: string, line: number, category: string): GradedComment => ({
  file,
  line,
  type: 'bug',
  severity: 'warning',
  body: 'b',
  principle_cited: principleByCategory[category] ?? 'null-undefined-handling',
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

const baseExpected: Expected = {
  description: 'test fixture',
  expected_findings: [
    {
      file: 'src/x.ts',
      line_range: [10, 14],
      category: 'correctness',
      min_severity: 'warning'
    }
  ],
  expected_clean: false,
  max_acceptable_findings: 3
}

describe('matchAgainstExpected', () => {
  it('TP: retained matches expected by file+line+category', () => {
    const retained = [make('src/x.ts', 12, 'correctness')]
    const result = matchAgainstExpected(retained, baseExpected)
    expect(result.tp).toBe(1)
    expect(result.fp).toBe(0)
    expect(result.fn).toBe(0)
  })

  it('FP + FN: retained on different file misses expected', () => {
    const retained = [make('src/other.ts', 12, 'correctness')]
    const result = matchAgainstExpected(retained, baseExpected)
    expect(result.fp).toBe(1)
    expect(result.fn).toBe(1)
    expect(result.tp).toBe(0)
  })

  it('FN only: empty retained with one expected finding', () => {
    const result = matchAgainstExpected([], baseExpected)
    expect(result.fn).toBe(1)
    expect(result.tp).toBe(0)
    expect(result.fp).toBe(0)
  })

  it('Clean fixture FP: retained against expected_clean fixture yields fp:1, fn:0', () => {
    const cleanExpected: Expected = {
      description: 'clean fixture',
      expected_findings: [],
      expected_clean: true,
      max_acceptable_findings: 3
    }
    const retained = [make('src/x.ts', 12, 'correctness')]
    const result = matchAgainstExpected(retained, cleanExpected)
    expect(result.fp).toBe(1)
    expect(result.fn).toBe(0)
    expect(result.tp).toBe(0)
  })

  it('Category mismatch: retained resolves to different category than expected', () => {
    // retained cites a security principle, expected wants correctness
    const retained = [make('src/x.ts', 12, 'security')]
    const result = matchAgainstExpected(retained, baseExpected)
    expect(result.tp).toBe(0)
    expect(result.fp).toBe(1)
    expect(result.fn).toBe(1)
  })
})
