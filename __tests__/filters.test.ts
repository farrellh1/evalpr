import { describe, it, expect } from '@jest/globals'
import {
  shouldSkipPR,
  applyIgnorePaths,
  type SkipReason,
  type PRMeta
} from '../src/filters.js'

const basePR: PRMeta = {
  draft: false,
  user_type: 'User',
  title: 'Add feature',
  changed_files: 5
}

describe('shouldSkipPR', () => {
  it('does not skip a normal PR', () => {
    expect(shouldSkipPR(basePR, { skipDrafts: true, maxFiles: 20 })).toBeNull()
  })

  it('skips drafts when enabled', () => {
    expect(
      shouldSkipPR(
        { ...basePR, draft: true },
        { skipDrafts: true, maxFiles: 20 }
      )
    ).toBe<SkipReason>('draft')
  })

  it('does not skip drafts when disabled', () => {
    expect(
      shouldSkipPR(
        { ...basePR, draft: true },
        { skipDrafts: false, maxFiles: 20 }
      )
    ).toBeNull()
  })

  it('always skips bots', () => {
    expect(
      shouldSkipPR(
        { ...basePR, user_type: 'Bot' },
        { skipDrafts: false, maxFiles: 20 }
      )
    ).toBe<SkipReason>('bot')
  })

  it('skips when [skip-review] in title', () => {
    expect(
      shouldSkipPR(
        { ...basePR, title: 'Hotfix [skip-review]' },
        { skipDrafts: true, maxFiles: 20 }
      )
    ).toBe<SkipReason>('skip-tag')
  })

  it('skips when too many files', () => {
    expect(
      shouldSkipPR(
        { ...basePR, changed_files: 50 },
        { skipDrafts: true, maxFiles: 20 }
      )
    ).toBe<SkipReason>('max-files')
  })
})

describe('applyIgnorePaths', () => {
  it('passes when no ignore paths match', () => {
    expect(applyIgnorePaths('src/x.ts', ['legacy/**'])).toBe(false)
  })

  it('ignores when a glob matches', () => {
    expect(applyIgnorePaths('legacy/old.ts', ['legacy/**'])).toBe(true)
  })

  it('ignores generated files', () => {
    expect(applyIgnorePaths('src/proto.generated.ts', ['*.generated.ts'])).toBe(
      true
    )
  })

  it('handles multiple patterns', () => {
    const patterns = ['node_modules/**', 'dist/**', '*.lock']
    expect(applyIgnorePaths('node_modules/x.js', patterns)).toBe(true)
    expect(applyIgnorePaths('package-lock.json', patterns)).toBe(true)
    expect(applyIgnorePaths('src/x.ts', patterns)).toBe(false)
  })
})
