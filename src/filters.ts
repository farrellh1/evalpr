import { minimatch } from 'minimatch'
import { basename } from 'node:path'

export interface PRMeta {
  draft: boolean
  user_type: string
  title: string
  changed_files: number
}

export type SkipReason = 'draft' | 'bot' | 'skip-tag' | 'max-files'

export interface FilterOptions {
  skipDrafts: boolean
  maxFiles: number
}

export function shouldSkipPR(
  pr: PRMeta,
  opts: FilterOptions
): SkipReason | null {
  if (pr.user_type === 'Bot') return 'bot'
  if (opts.skipDrafts && pr.draft) return 'draft'
  if (pr.title.includes('[skip-review]')) return 'skip-tag'
  if (pr.changed_files > opts.maxFiles) return 'max-files'
  return null
}

export function applyIgnorePaths(file: string, patterns: string[]): boolean {
  const base = basename(file)
  return patterns.some((p) => {
    if (minimatch(file, p, { matchBase: true, dot: true })) return true
    // For patterns without slashes (matchBase semantics), also match against
    // basename using a contains-style glob so that e.g. *.lock matches
    // package-lock.json (which contains "lock" as a segment).
    if (!p.includes('/')) {
      const stem = p.replace(/^\*\./, '')
      if (stem !== p) return base.includes(stem)
    }
    return false
  })
}
