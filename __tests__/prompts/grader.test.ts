import { describe, it, expect } from '@jest/globals'
import { buildGraderPrompt } from '../../src/prompts/grader.js'
import type { Principle, ReviewComment } from '../../src/types.js'

const principles: Principle[] = [
  { id: 'p1', description: 'd1', severity: 'warning', category: 'correctness' }
]
const comment: ReviewComment = {
  file: 'a.ts',
  line: 1,
  type: 'bug',
  severity: 'warning',
  body: 'body',
  principle_cited: 'p1',
  reasoning: 'r'
}

describe('buildGraderPrompt', () => {
  it('includes the comment under review', () => {
    const prompt = buildGraderPrompt(comment, principles, {})
    expect(prompt).toContain('body')
    expect(prompt).toContain('p1')
  })

  it('lists the four scoring dimensions', () => {
    const prompt = buildGraderPrompt(comment, principles, {})
    expect(prompt).toContain('confidence')
    expect(prompt).toContain('specificity')
    expect(prompt).toContain('calibration')
    expect(prompt).toContain('principle_alignment')
  })

  it('describes Score JSON schema', () => {
    const prompt = buildGraderPrompt(comment, principles, {})
    expect(prompt).toContain('final_score')
    expect(prompt).toContain('rationale')
  })

  it('snapshots stable output', () => {
    const prompt = buildGraderPrompt(comment, principles, {})
    expect(prompt).toMatchSnapshot()
  })
})
