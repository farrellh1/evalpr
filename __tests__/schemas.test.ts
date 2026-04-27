import { describe, it, expect } from '@jest/globals'
import {
  PrincipleSchema,
  ReviewCommentSchema,
  ScoreSchema,
  EvalprConfigSchema
} from '../src/schemas.js'

describe('PrincipleSchema', () => {
  it('parses a valid principle', () => {
    const result = PrincipleSchema.parse({
      id: 'no-default-export',
      description: 'Avoid side effects in pure functions',
      severity: 'warning',
      category: 'correctness'
    })
    expect(result.id).toBe('no-default-export')
    expect(result.severity).toBe('warning')
    expect(result.category).toBe('correctness')
  })

  it('rejects an unknown severity', () => {
    expect(() =>
      PrincipleSchema.parse({
        id: 'no-default-export',
        description: 'Some principle',
        severity: 'critical',
        category: 'correctness'
      })
    ).toThrow()
  })

  it('rejects an unknown category', () => {
    expect(() =>
      PrincipleSchema.parse({
        id: 'no-default-export',
        description: 'Some principle',
        severity: 'warning',
        category: 'aesthetics'
      })
    ).toThrow()
  })
})

describe('ReviewCommentSchema', () => {
  it('parses a valid comment', () => {
    const result = ReviewCommentSchema.parse({
      file: 'src/auth.ts',
      line: 42,
      type: 'bug',
      severity: 'error',
      body: 'This will cause a null dereference',
      principle_cited: 'no-default-export',
      reasoning: 'The value may be undefined when accessed here'
    })
    expect(result.line).toBe(42)
    expect(result.file).toBe('src/auth.ts')
  })

  it('rejects negative line numbers', () => {
    expect(() =>
      ReviewCommentSchema.parse({
        file: 'src/auth.ts',
        line: -1,
        type: 'bug',
        severity: 'error',
        body: 'Something wrong',
        principle_cited: 'no-default-export',
        reasoning: 'Because reasons'
      })
    ).toThrow()
  })
})

describe('ScoreSchema', () => {
  it('parses a valid score', () => {
    const result = ScoreSchema.parse({
      confidence: 90,
      specificity: 75,
      calibration: 80,
      principle_alignment: 85,
      final_score: 82,
      rationale: 'Comment is well-reasoned and specific'
    })
    expect(result.final_score).toBe(82)
    expect(result.rationale).toBe('Comment is well-reasoned and specific')
  })

  it('rejects scores outside 0-100', () => {
    expect(() =>
      ScoreSchema.parse({
        confidence: 150,
        specificity: 75,
        calibration: 80,
        principle_alignment: 85,
        final_score: 82,
        rationale: 'Some rationale'
      })
    ).toThrow()
  })
})

describe('EvalprConfigSchema', () => {
  it('parses an empty config', () => {
    const result = EvalprConfigSchema.parse({})
    expect(result).toEqual({})
  })

  it('parses a config with all sections', () => {
    const result = EvalprConfigSchema.parse({
      principles: {
        add: [
          {
            id: 'no-default-export',
            description: 'Custom principle',
            severity: 'info',
            category: 'project'
          }
        ],
        remove: ['performance-async-blocking'],
        override: [
          {
            id: 'naming-clarity',
            description: 'Override description',
            severity: 'error',
            category: 'security'
          }
        ]
      },
      review: {
        confidence_threshold: 70,
        ignore_paths: ['dist/**', 'node_modules/**']
      }
    })
    expect(result.principles?.add?.[0].id).toBe('no-default-export')
    expect(result.principles?.remove?.[0]).toBe('performance-async-blocking')
    expect(result.review?.confidence_threshold).toBe(70)
    expect(result.review?.ignore_paths).toHaveLength(2)
  })
})
