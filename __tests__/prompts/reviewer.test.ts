import { describe, it, expect } from '@jest/globals'
import { buildReviewerPrompt } from '../../src/prompts/reviewer.js'
import type { Principle, Context } from '../../src/types.js'

const principles: Principle[] = [
  {
    id: 'p1',
    description: 'd1',
    severity: 'warning',
    category: 'correctness'
  }
]

describe('buildReviewerPrompt', () => {
  it('includes all principle ids', () => {
    const ctx: Context = {}
    const prompt = buildReviewerPrompt(principles, ctx)
    expect(prompt).toContain('p1')
    expect(prompt).toContain('d1')
  })

  it('includes context sections when present', () => {
    const ctx: Context = {
      conventions: 'CONV',
      readme: 'RDM',
      contributing: 'CONTRIB'
    }
    const prompt = buildReviewerPrompt(principles, ctx)
    expect(prompt).toContain('CONV')
    expect(prompt).toContain('RDM')
    expect(prompt).toContain('CONTRIB')
  })

  it('omits empty context cleanly', () => {
    const prompt = buildReviewerPrompt(principles, {})
    expect(prompt).not.toContain('Project context:')
  })

  it('instructs JSON-only output', () => {
    const prompt = buildReviewerPrompt(principles, {})
    expect(prompt.toLowerCase()).toContain('json')
    expect(prompt).toContain('ReviewComment[]')
  })

  it('snapshots stable output', () => {
    const prompt = buildReviewerPrompt(principles, { conventions: 'X' })
    expect(prompt).toMatchSnapshot()
  })
})
