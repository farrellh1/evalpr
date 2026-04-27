import { describe, it, expect } from '@jest/globals'
import { defaultPrinciples } from '../src/default-principles.js'
import { PrincipleSchema } from '../src/schemas.js'

describe('defaultPrinciples', () => {
  it('contains 15-20 principles', () => {
    expect(defaultPrinciples.length).toBeGreaterThanOrEqual(15)
    expect(defaultPrinciples.length).toBeLessThanOrEqual(20)
  })

  it('every principle is a valid Principle', () => {
    for (const p of defaultPrinciples) {
      expect(() => PrincipleSchema.parse(p)).not.toThrow()
    }
  })

  it('all ids are unique', () => {
    const ids = defaultPrinciples.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all ids are kebab-case', () => {
    for (const p of defaultPrinciples) {
      expect(p.id).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/)
    }
  })

  it('covers all 7 categories at least once', () => {
    const categories = new Set(defaultPrinciples.map((p) => p.category))
    expect(categories).toEqual(
      new Set([
        'correctness',
        'security',
        'readability',
        'maintainability',
        'performance',
        'testing',
        'project'
      ])
    )
  })
})
