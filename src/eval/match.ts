import type { GradedComment, Principle } from '../types.js'
import { defaultPrinciples } from '../default-principles.js'
import type { Expected, ExpectedFinding } from './fixture.js'

export interface MatchResult {
  tp: number
  fp: number
  fn: number
  matched_expected: ExpectedFinding[]
  matched_retained: GradedComment[]
  unmatched_retained: GradedComment[]
  unmatched_expected: ExpectedFinding[]
}

function categoryOf(
  principleId: string,
  principles: Principle[]
): string | undefined {
  return principles.find((p) => p.id === principleId)?.category
}

function commentMatchesExpected(
  c: GradedComment,
  e: ExpectedFinding,
  principles: Principle[]
): boolean {
  if (c.file !== e.file) return false
  if (c.line < e.line_range[0] || c.line > e.line_range[1]) return false
  const cat = categoryOf(c.principle_cited, principles)
  return cat === e.category
}

export function matchAgainstExpected(
  retained: GradedComment[],
  expected: Expected,
  principles: Principle[] = defaultPrinciples
): MatchResult {
  const matchedExpected: ExpectedFinding[] = []
  const matchedRetained: GradedComment[] = []
  const unmatchedRetained: GradedComment[] = []
  const remainingExpected = [...expected.expected_findings]

  for (const c of retained) {
    const idx = remainingExpected.findIndex((e) =>
      commentMatchesExpected(c, e, principles)
    )
    if (idx >= 0) {
      matchedExpected.push(remainingExpected[idx])
      matchedRetained.push(c)
      remainingExpected.splice(idx, 1)
    } else {
      unmatchedRetained.push(c)
    }
  }

  return {
    tp: matchedRetained.length,
    fp: unmatchedRetained.length,
    fn: remainingExpected.length,
    matched_expected: matchedExpected,
    matched_retained: matchedRetained,
    unmatched_retained: unmatchedRetained,
    unmatched_expected: remainingExpected
  }
}
