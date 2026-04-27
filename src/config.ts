import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { EvalprConfigSchema } from './schemas.js'
import type { EvalprConfig, Principle } from './types.js'

type ReadFileFn = (path: string, encoding: BufferEncoding) => Promise<string>

export async function loadConfig(
  repoRoot: string,
  configPath: string,
  readFileFn: ReadFileFn = readFile
): Promise<EvalprConfig> {
  let raw: string
  try {
    raw = await readFileFn(join(repoRoot, configPath), 'utf8')
  } catch {
    return {}
  }
  try {
    const parsed = parseYaml(raw) ?? {}
    return EvalprConfigSchema.parse(parsed)
  } catch {
    return {}
  }
}

export function mergePrinciples(
  defaults: Principle[],
  cfg: EvalprConfig
): Principle[] {
  const removed = new Set(cfg.principles?.remove ?? [])
  const overrides = new Map(
    (cfg.principles?.override ?? []).map((p) => [p.id, p])
  )
  const adds = cfg.principles?.add ?? []

  // Treat 'add' of an existing default id as an override.
  for (const a of adds) {
    overrides.set(a.id, a)
  }

  const merged: Principle[] = []
  const seen = new Set<string>()
  for (const p of defaults) {
    if (removed.has(p.id)) continue
    const o = overrides.get(p.id)
    merged.push(o ?? p)
    seen.add(p.id)
  }
  // Append truly new adds (ids not in defaults)
  for (const a of adds) {
    if (!seen.has(a.id)) {
      merged.push(a)
      seen.add(a.id)
    }
  }

  return merged
}
