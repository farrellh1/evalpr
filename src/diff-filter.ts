import { minimatch } from 'minimatch'

/**
 * Extract the target path (b/<path> side) from a `diff --git` header.
 * Returns null if not found.
 */
function extractTargetPath(section: string): string | null {
  // Format: diff --git a/<path> b/<path>
  const match = /^diff --git a\/.+ b\/(.+)$/m.exec(section)
  if (!match) return null
  return match[1]
}

/**
 * Drop entire file sections from a unified diff whose target path matches
 * any of the provided ignore-path globs.
 *
 * This must be called BEFORE sending the diff to the reviewer LLM so that
 * large generated files (e.g. dist/index.js) do not exceed the model's
 * context window.
 */
export function filterDiffByPaths(diff: string, ignorePaths: string[]): string {
  if (ignorePaths.length === 0) return diff
  if (!diff.includes('diff --git ')) return diff

  // Split on the newline that separates file sections.
  // The regex consumes the `\n` before each `diff --git` marker so each
  // element begins cleanly with `diff --git`. We restore the consumed
  // newlines when joining.
  const sections = diff.split(/\n(?=diff --git )/)

  // Verify at least one section has a diff header (handles edge cases)
  const hasDiffHeaders = sections.some((s) => s.startsWith('diff --git '))
  if (!hasDiffHeaders) return diff

  const remaining = sections.filter((section) => {
    if (!section.startsWith('diff --git ')) return true // keep non-standard sections

    const targetPath = extractTargetPath(section)
    if (targetPath === null) return true

    const shouldIgnore = ignorePaths.some((pattern) =>
      minimatch(targetPath, pattern, { dot: true })
    )
    return !shouldIgnore
  })

  if (remaining.length === 0) return ''

  // Rejoin with the `\n` separators consumed by the split.
  // Restore a trailing newline if the original had one (the split may have
  // stripped the `\n` from the end of a non-final section).
  let result = remaining.join('\n')
  if (diff.endsWith('\n') && result.length > 0 && !result.endsWith('\n')) {
    result += '\n'
  }
  return result
}
