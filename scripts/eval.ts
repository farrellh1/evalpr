import { readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { config as dotenvConfig } from 'dotenv'
import { createOpenRouterClient } from '../src/openrouter.js'
import { defaultPrinciples } from '../src/default-principles.js'
import { callReviewer } from '../src/reviewer.js'
import { gradeAll } from '../src/grader.js'
import { filterByThreshold } from '../src/filter.js'
import { loadFixture } from '../src/eval/fixture.js'
import { matchAgainstExpected } from '../src/eval/match.js'

dotenvConfig({ path: '.env.local' })

const FIXTURES_DIR = 'fixtures'
const THRESHOLDS = [50, 60, 70, 80, 90]
const REVIEWER_MODEL =
  process.env.REVIEWER_MODEL || 'anthropic/claude-sonnet-4.6'
const GRADER_MODEL = process.env.GRADER_MODEL || 'anthropic/claude-haiku-4.5'

interface PerThreshold {
  threshold: number
  tp: number
  fp: number
  fn: number
  precision: number
  recall: number
  f1: number
  retained_per_pr: number
}

interface FixtureResult {
  fixture: string
  per_threshold: PerThreshold[]
}

function arg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

function printAggregate(results: FixtureResult[]): void {
  const all: Record<number, { tp: number; fp: number; fn: number; n: number }> =
    {}
  for (const r of results) {
    for (const t of r.per_threshold) {
      const a = (all[t.threshold] ??= { tp: 0, fp: 0, fn: 0, n: 0 })
      a.tp += t.tp
      a.fp += t.fp
      a.fn += t.fn
      a.n += t.retained_per_pr
    }
  }
  console.log('\n=== Aggregate ===')
  console.log('threshold | precision | recall | F1   | findings/PR')
  for (const t of Object.keys(all)
    .map((s) => parseInt(s, 10))
    .sort((a, b) => a - b)) {
    const { tp, fp, fn, n } = all[t]
    const p = tp + fp === 0 ? 0 : tp / (tp + fp)
    const r = tp + fn === 0 ? 1 : tp / (tp + fn)
    const f1 = p + r === 0 ? 0 : (2 * p * r) / (p + r)
    console.log(
      `${t.toString().padStart(9)} | ${p.toFixed(2).padStart(9)} | ${r
        .toFixed(2)
        .padStart(6)} | ${f1.toFixed(2).padStart(4)} | ${(n / results.length)
        .toFixed(1)
        .padStart(11)}`
    )
  }
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: npm run eval [-- --fixture <name>] [--threshold <n>]

Options:
  --fixture <name>   Run only fixtures whose directory name contains <name>
  --threshold <n>    Run only the given threshold (otherwise: 50,60,70,80,90)
  --help, -h         Show this help`)
    process.exit(0)
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set')
  const client = createOpenRouterClient(apiKey)

  const onlyFixture = arg(args, '--fixture')
  const onlyThreshold = arg(args, '--threshold')

  const dirs = (await readdir(FIXTURES_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((d) => !onlyFixture || d.includes(onlyFixture))

  const results: FixtureResult[] = []

  for (const dirName of dirs) {
    const dir = join(FIXTURES_DIR, dirName)
    console.log(`\n=== ${dirName} ===`)
    const fixture = await loadFixture(dir)
    const ctx = fixture.context ? { conventions: fixture.context } : {}

    const reviewerComments = await callReviewer(
      client,
      REVIEWER_MODEL,
      fixture.diff,
      defaultPrinciples,
      ctx
    )
    console.log(`  reviewer: ${reviewerComments.length} findings`)

    const graded = await gradeAll(
      client,
      GRADER_MODEL,
      reviewerComments,
      defaultPrinciples,
      ctx
    )

    const perThreshold: PerThreshold[] = []
    const thresholds = onlyThreshold
      ? [parseInt(onlyThreshold, 10)]
      : THRESHOLDS

    for (const t of thresholds) {
      const flagged = filterByThreshold(graded, t)
      const retained = flagged.filter((c) => c.retained)
      const m = matchAgainstExpected(retained, fixture.expected)
      const precision = m.tp + m.fp === 0 ? 0 : m.tp / (m.tp + m.fp)
      const recall = m.tp + m.fn === 0 ? 1 : m.tp / (m.tp + m.fn)
      const f1 =
        precision + recall === 0
          ? 0
          : (2 * precision * recall) / (precision + recall)
      perThreshold.push({
        threshold: t,
        tp: m.tp,
        fp: m.fp,
        fn: m.fn,
        precision: round(precision),
        recall: round(recall),
        f1: round(f1),
        retained_per_pr: retained.length
      })
    }

    results.push({ fixture: dirName, per_threshold: perThreshold })
  }

  await writeFile(
    'scripts/eval-results.json',
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        reviewer_model: REVIEWER_MODEL,
        grader_model: GRADER_MODEL,
        results
      },
      null,
      2
    )
  )

  printAggregate(results)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
