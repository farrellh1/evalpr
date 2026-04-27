import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Context } from './types.js'

export const MAX_PER_FILE_BYTES = 4 * 1024
export const MAX_TOTAL_BYTES = 12 * 1024

const TRUNCATION_MARKER = '\n\n[truncated]'

type ReadFileFn = (path: string, encoding: BufferEncoding) => Promise<string>

async function tryRead(
  repoRoot: string,
  name: string,
  readFileFn: ReadFileFn
): Promise<string | undefined> {
  try {
    return await readFileFn(join(repoRoot, name), 'utf8')
  } catch {
    return undefined
  }
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + TRUNCATION_MARKER
}

export async function loadContext(
  repoRoot: string,
  readFileFn: ReadFileFn = readFile
): Promise<Context> {
  const [conventions, readme, contributing] = await Promise.all([
    tryRead(repoRoot, 'CONVENTIONS.md', readFileFn),
    tryRead(repoRoot, 'README.md', readFileFn),
    tryRead(repoRoot, 'CONTRIBUTING.md', readFileFn)
  ])

  const ctx: Context = {}
  let used = 0

  const slot = (text: string | undefined): string | undefined => {
    if (text === undefined) return undefined
    const remaining = MAX_TOTAL_BYTES - used
    if (remaining <= 0) return undefined
    const perFileMax = Math.min(MAX_PER_FILE_BYTES, remaining)
    const out = clip(text, perFileMax)
    used += out.length
    return out
  }

  const c = slot(conventions)
  const r = slot(readme)
  const k = slot(contributing)

  if (c !== undefined) ctx.conventions = c
  if (r !== undefined) ctx.readme = r
  if (k !== undefined) ctx.contributing = k

  return ctx
}
