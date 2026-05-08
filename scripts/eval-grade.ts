import { readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { config as dotenvConfig } from 'dotenv'
import {
  createOpenRouterClient,
  computeCost,
  ZERO_USAGE,
  addUsage
} from '../src/openrouter.js'
import { defaultPrinciples } from '../src/default-principles.js'
import { gradeAll } from '../src/grader.js'
import { filterByThreshold } from '../src/filter.js'
import { loadFixture } from '../src/eval/fixture.js'
import { matchAgainstExpected } from '../src/eval/match.js'
import { computeCacheKey, loadReviewerCache } from '../src/eval/cache.js'
import { buildReviewerPrompt } from '../src/prompts/reviewer.js'
import type { GradedComment, Score } from '../src/types.js'

dotenvConfig({ path: '.env.local' })

const FIXTURES_DIR = 'fixtures'
const THRESHOLDS = [50, 60, 70, 80, 90]
const REVIEWER_MODEL =
  process.env.REVIEWER_MODEL || 'anthropic/claude-sonnet-4.6'

const GRADER_SHORTNAMES: Record<string, string> = {
  'anthropic/claude-haiku-4.5': 'haiku',
  'anthropic/claude-sonnet-4.6': 'sonnet',
  'anthropic/claude-opus-4.7': 'opus'
}

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

interface PersistedComment {
  comment_id: string
  file: string
  line: number
  principle_cited: string
  comment_body: string
  score: Score
  expected_match: boolean
  retained_at_thresholds: number[]
}

interface FixtureResult {
  fixture: string
  graded_comments: PersistedComment[]
  per_threshold: PerThreshold[]
  cost: {
    grader: { input_tokens: number; output_tokens: number; cost_usd: number }
    reviewer_cached: {
      input_tokens: number
      output_tokens: number
      cost_usd: number
    }
  }
}

interface ResultsFile {
  generated_at: string
  reviewer_model: string
  grader_model: string
  reviewer_cost_usd_total: number
  grader_cost_usd_total: number
  results: FixtureResult[]
}

function arg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: npm run eval:grade -- --grader <haiku|sonnet|opus> [--fixture <name>]

Options:
  --grader <name>    Required. One of haiku, sonnet, opus.
  --fixture <name>   Run only fixtures whose directory name contains <name>
  --help, -h         Show this help`)
    process.exit(0)
  }

  const graderShort = arg(args, '--grader')
  if (!graderShort) throw new Error('--grader <haiku|sonnet|opus> is required')
  const graderModel = Object.entries(GRADER_SHORTNAMES).find(
    ([, s]) => s === graderShort
  )?.[0]
  if (!graderModel) {
    throw new Error(
      `Unknown grader "${graderShort}". Use one of: ${Object.values(GRADER_SHORTNAMES).join(', ')}`
    )
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set')
  const client = createOpenRouterClient(apiKey)

  const onlyFixture = arg(args, '--fixture')
  const dirs = (await readdir(FIXTURES_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((d) => !onlyFixture || d.includes(onlyFixture))

  const results: FixtureResult[] = []
  let graderUsageTotal = ZERO_USAGE
  let reviewerUsageTotal = ZERO_USAGE

  for (const dirName of dirs) {
    const dir = join(FIXTURES_DIR, dirName)
    console.log(`\n=== ${dirName} ===`)
    const fixture = await loadFixture(dir)
    const ctx = fixture.context ? { conventions: fixture.context } : {}

    const prompt = buildReviewerPrompt(defaultPrinciples, ctx)
    const cacheKey = computeCacheKey({
      reviewer_model: REVIEWER_MODEL,
      prompt,
      principles_json: JSON.stringify(defaultPrinciples),
      diff: fixture.diff
    })
    const cached = await loadReviewerCache(dir, cacheKey)
    if (!cached) {
      throw new Error(
        `${dirName}: no reviewer cache. Run \`npm run eval:review\` first.`
      )
    }
    console.log(`  reviewer cached: ${cached.comments.length} comments`)

    const { graded, usage: graderUsage } = await gradeAll(
      client,
      graderModel,
      cached.comments,
      defaultPrinciples,
      ctx
    )

    const perThreshold: PerThreshold[] = []
    const retainedAt: Map<string, number[]> = new Map()

    for (const t of THRESHOLDS) {
      const flagged = filterByThreshold(graded, t)
      const retained = flagged.filter((c) => c.retained)
      for (const c of retained) {
        const id = `${dirName}:${c.file}:${c.line}`
        if (!retainedAt.has(id)) retainedAt.set(id, [])
        retainedAt.get(id)!.push(t)
      }
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

    // Compute expected_match per comment by checking if any threshold's match included it.
    const allFlagged = filterByThreshold(graded, 0).map((c) => ({
      ...c,
      retained: true
    })) as GradedComment[]
    const matchAll = matchAgainstExpected(allFlagged, fixture.expected)
    const matchedSet = new Set(
      matchAll.matched_retained.map((c) => `${c.file}:${c.line}`)
    )

    const persistedComments: PersistedComment[] = graded.map((c) => {
      const id = `${dirName}:${c.file}:${c.line}`
      return {
        comment_id: id,
        file: c.file,
        line: c.line,
        principle_cited: c.principle_cited,
        comment_body: c.body,
        score: c.score,
        expected_match: matchedSet.has(`${c.file}:${c.line}`),
        retained_at_thresholds: retainedAt.get(id) ?? []
      }
    })

    const graderCost = computeCost(graderModel, graderUsage)
    const reviewerCost = computeCost(REVIEWER_MODEL, cached.usage)
    graderUsageTotal = addUsage(graderUsageTotal, graderUsage)
    reviewerUsageTotal = addUsage(reviewerUsageTotal, cached.usage)

    console.log(
      `  grader: ${graderUsage.input_tokens}+${graderUsage.output_tokens} tok, $${graderCost.toFixed(4)}`
    )

    results.push({
      fixture: dirName,
      graded_comments: persistedComments,
      per_threshold: perThreshold,
      cost: {
        grader: {
          input_tokens: graderUsage.input_tokens,
          output_tokens: graderUsage.output_tokens,
          cost_usd: graderCost
        },
        reviewer_cached: {
          input_tokens: cached.usage.input_tokens,
          output_tokens: cached.usage.output_tokens,
          cost_usd: reviewerCost
        }
      }
    })
  }

  const out: ResultsFile = {
    generated_at: new Date().toISOString(),
    reviewer_model: REVIEWER_MODEL,
    grader_model: graderModel,
    reviewer_cost_usd_total: computeCost(REVIEWER_MODEL, reviewerUsageTotal),
    grader_cost_usd_total: computeCost(graderModel, graderUsageTotal),
    results
  }

  const outPath = `scripts/results-${graderShort}.json`
  await writeFile(outPath, JSON.stringify(out, null, 2))
  console.log(`\nWrote ${outPath}`)
  console.log(
    `Reviewer total (cached): $${out.reviewer_cost_usd_total.toFixed(4)}`
  )
  console.log(`Grader total: $${out.grader_cost_usd_total.toFixed(4)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
