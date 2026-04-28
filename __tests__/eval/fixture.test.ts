import { describe, it, expect } from '@jest/globals'
import { loadFixture, ExpectedSchema } from '../../src/eval/fixture.js'

const DIFF_CONTENT = 'diff --git a/src/foo.ts b/src/foo.ts\n+added line\n'
const CONTEXT_CONTENT = '# Context\nSome background info.'
const EXPECTED_JSON = JSON.stringify({
  description: 'Test fixture description.',
  expected_findings: [
    {
      file: 'src/foo.ts',
      line_range: [1, 5],
      category: 'correctness',
      min_severity: 'warning',
      must_cite_principle: 'null-undefined-handling'
    }
  ],
  expected_clean: false,
  max_acceptable_findings: 3
})

function makeReader(files: Record<string, string>) {
  return async (path: string): Promise<string> => {
    if (path in files) return files[path]
    const err = new Error(`ENOENT: no such file: ${path}`)
    ;(err as NodeJS.ErrnoException).code = 'ENOENT'
    throw err
  }
}

describe('loadFixture', () => {
  it('happy path: loads diff, context, and expected', async () => {
    const dir = '/fixtures/my-fixture'
    const reader = makeReader({
      '/fixtures/my-fixture/diff.patch': DIFF_CONTENT,
      '/fixtures/my-fixture/context.md': CONTEXT_CONTENT,
      '/fixtures/my-fixture/expected.json': EXPECTED_JSON
    })

    const fixture = await loadFixture(dir, reader)

    expect(fixture.id).toBe('my-fixture')
    expect(fixture.diff).toBe(DIFF_CONTENT)
    expect(fixture.context).toBe(CONTEXT_CONTENT)
    expect(fixture.expected.description).toBe('Test fixture description.')
    expect(fixture.expected.expected_findings).toHaveLength(1)
    expect(fixture.expected.expected_clean).toBe(false)
    expect(fixture.expected.max_acceptable_findings).toBe(3)
  })

  it('missing context.md returns context: undefined', async () => {
    const dir = '/fixtures/no-context'
    const reader = makeReader({
      '/fixtures/no-context/diff.patch': DIFF_CONTENT,
      '/fixtures/no-context/expected.json': EXPECTED_JSON
    })

    const fixture = await loadFixture(dir, reader)

    expect(fixture.context).toBeUndefined()
    expect(fixture.diff).toBe(DIFF_CONTENT)
  })

  it('throws if diff.patch is missing', async () => {
    const dir = '/fixtures/bad'
    const reader = makeReader({
      '/fixtures/bad/expected.json': EXPECTED_JSON
    })

    await expect(loadFixture(dir, reader)).rejects.toThrow()
  })

  it('throws if expected.json is missing', async () => {
    const dir = '/fixtures/bad2'
    const reader = makeReader({
      '/fixtures/bad2/diff.patch': DIFF_CONTENT
    })

    await expect(loadFixture(dir, reader)).rejects.toThrow()
  })

  it('ExpectedSchema accepts a valid full payload', () => {
    const payload = {
      description: 'Full payload test.',
      expected_findings: [
        {
          file: 'src/bar.ts',
          line_range: [10, 20],
          category: 'security',
          min_severity: 'error',
          must_cite_principle: 'auth-check'
        },
        {
          file: 'src/baz.ts',
          line_range: [5, 5],
          category: 'performance',
          min_severity: 'info'
        }
      ],
      expected_clean: false,
      max_acceptable_findings: 5
    }

    const result = ExpectedSchema.parse(payload)
    expect(result.expected_findings[0].must_cite_principle).toBe('auth-check')
    expect(result.expected_findings[1].must_cite_principle).toBeUndefined()
  })
})
