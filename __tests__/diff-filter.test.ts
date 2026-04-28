import { describe, it, expect } from '@jest/globals'
import { filterDiffByPaths } from '../src/diff-filter.js'

// Realistic unified-diff fixtures

const srcFooSection = `diff --git a/src/foo.ts b/src/foo.ts
index abc1234..def5678 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,4 +1,5 @@
 import { something } from './utils.js'
-const x = null
+const x = undefined
+const y = 42
 export { x }
`

const distIndexSection = `diff --git a/dist/index.js b/dist/index.js
index 0000000..1111111 100644
--- a/dist/index.js
+++ b/dist/index.js
@@ -1,3 +1,4 @@
 /***/ (function(module, exports) {
+var __webpack = {}
 module.exports = {}
 /***/ })
`

const srcASection = `diff --git a/src/a.ts b/src/a.ts
index aaaaaaa..bbbbbbb 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,3 @@
 export const a = 1
+export const b = 2
 export default a
`

const distXSection = `diff --git a/dist/x.js b/dist/x.js
index 1234567..89abcde 100644
--- a/dist/x.js
+++ b/dist/x.js
@@ -1,2 +1,2 @@
-var old = true
+var newer = true
`

const nodeModulesYSection = `diff --git a/node_modules/y.js b/node_modules/y.js
index fedcba9..0000001 100644
--- a/node_modules/y.js
+++ b/node_modules/y.js
@@ -1,2 +1,2 @@
-exports.version = '1.0.0'
+exports.version = '1.1.0'
`

const pkgGeneratedSection = `diff --git a/pkg/generated/x.ts b/pkg/generated/x.ts
index aaaa111..bbbb222 100644
--- a/pkg/generated/x.ts
+++ b/pkg/generated/x.ts
@@ -1,2 +1,3 @@
 export type Foo = string
+export type Bar = number
 export type Baz = boolean
`

describe('filterDiffByPaths', () => {
  it('returns input unchanged when ignorePaths is empty', () => {
    const diff = srcFooSection + distIndexSection
    expect(filterDiffByPaths(diff, [])).toBe(diff)
  })

  it('drops a single matching file section', () => {
    const diff = srcFooSection + distIndexSection
    const result = filterDiffByPaths(diff, ['dist/**'])
    expect(result).toContain('src/foo.ts')
    expect(result).not.toContain('dist/index.js')
    expect(result).toBe(srcFooSection)
  })

  it('drops multiple files matching different globs', () => {
    const diff = srcASection + distXSection + nodeModulesYSection
    const result = filterDiffByPaths(diff, ['dist/**', 'node_modules/**'])
    expect(result).toContain('src/a.ts')
    expect(result).not.toContain('dist/x.js')
    expect(result).not.toContain('node_modules/y.js')
    expect(result).toBe(srcASection)
  })

  it('returns input unchanged when no globs match', () => {
    const diff = srcFooSection
    const result = filterDiffByPaths(diff, ['dist/**'])
    expect(result).toBe(diff)
  })

  it('returns empty string when all file sections match', () => {
    const diff = distXSection + nodeModulesYSection
    const result = filterDiffByPaths(diff, ['dist/**', 'node_modules/**'])
    expect(result).toBe('')
  })

  it('matches middle-segment glob (**/generated/**)', () => {
    const diff = srcFooSection + pkgGeneratedSection
    const result = filterDiffByPaths(diff, ['**/generated/**'])
    expect(result).toContain('src/foo.ts')
    expect(result).not.toContain('pkg/generated/x.ts')
    expect(result).toBe(srcFooSection)
  })

  it('returns unchanged for non-standard diff (no diff --git headers)', () => {
    const nonStandard = 'some text without diff headers\nanother line\n'
    expect(filterDiffByPaths(nonStandard, ['dist/**'])).toBe(nonStandard)
  })

  it('returns unchanged for empty string input', () => {
    expect(filterDiffByPaths('', ['dist/**'])).toBe('')
  })
})
