import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { config as dotenvConfig } from 'dotenv'
import {
  createOpenRouterClient,
  computeCost,
  ZERO_USAGE,
  addUsage
} from '../src/openrouter.js'
import { defaultPrinciples } from '../src/default-principles.js'
import { callReviewer } from '../src/reviewer.js'
import { loadFixture } from '../src/eval/fixture.js'
import {
  computeCacheKey,
  loadReviewerCache,
  saveReviewerCache,
  type ReviewerCachePayload
} from '../src/eval/cache.js'
import { buildReviewerPrompt } from '../src/prompts/reviewer.js'

dotenvConfig({ path: '.env.local' })

const FIXTURES_DIR = 'fixtures'
const REVIEWER_MODEL =
  process.env.REVIEWER_MODEL || 'anthropic/claude-sonnet-4.6'

function arg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: npm run eval:review [-- --fixture <name>] [--refresh]

Options:
  --fixture <name>   Run only fixtures whose directory name contains <name>
  --refresh          Ignore cache, regenerate every fixture
  --help, -h         Show this help`)
    process.exit(0)
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set')
  const client = createOpenRouterClient(apiKey)

  const onlyFixture = arg(args, '--fixture')
  const forceRefresh = args.includes('--refresh')

  const dirs = (await readdir(FIXTURES_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((d) => !onlyFixture || d.includes(onlyFixture))

  let freshUsage = ZERO_USAGE
  let cachedUsage = ZERO_USAGE
  let cacheHits = 0
  let cacheMisses = 0

  for (const dirName of dirs) {
    const dir = join(FIXTURES_DIR, dirName)
    const fixture = await loadFixture(dir)
    const ctx = fixture.context ? { conventions: fixture.context } : {}

    const prompt = buildReviewerPrompt(defaultPrinciples, ctx)
    const cacheKey = computeCacheKey({
      reviewer_model: REVIEWER_MODEL,
      prompt,
      principles_json: JSON.stringify(defaultPrinciples),
      diff: fixture.diff
    })

    if (!forceRefresh) {
      const cached = await loadReviewerCache(dir, cacheKey)
      if (cached) {
        console.log(
          `${dirName}: cache hit (${cached.comments.length} comments)`
        )
        cacheHits++
        cachedUsage = addUsage(cachedUsage, cached.usage)
        continue
      }
    }

    console.log(`${dirName}: running reviewer...`)
    const { comments, usage } = await callReviewer(
      client,
      REVIEWER_MODEL,
      fixture.diff,
      defaultPrinciples,
      ctx
    )
    const payload: ReviewerCachePayload = {
      cache_key: cacheKey,
      reviewer_model: REVIEWER_MODEL,
      generated_at: new Date().toISOString(),
      comments,
      usage
    }
    await saveReviewerCache(dir, payload)
    cacheMisses++
    freshUsage = addUsage(freshUsage, usage)
    const cost = computeCost(REVIEWER_MODEL, usage)
    console.log(
      `  → ${comments.length} comments, ${usage.input_tokens}+${usage.output_tokens} tok, $${cost.toFixed(4)}`
    )
  }

  const freshCost = computeCost(REVIEWER_MODEL, freshUsage)
  const cachedCost = computeCost(REVIEWER_MODEL, cachedUsage)
  console.log(`\n=== Reviewer summary ===`)
  console.log(
    `Fixtures: ${dirs.length} (${cacheHits} cached, ${cacheMisses} fresh)`
  )
  console.log(
    `This run (fresh only): ${freshUsage.input_tokens}+${freshUsage.output_tokens} tok, $${freshCost.toFixed(4)}`
  )
  console.log(
    `Cache total (all fixtures, fresh + cached): $${(freshCost + cachedCost).toFixed(4)}`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
