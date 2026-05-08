import { readFile, writeFile } from 'node:fs/promises'
import { spearman } from '../src/stats.js'

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
  score: { final_score: number; rationale: string }
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

interface ComparisonOutput {
  generated_at: string
  reviewer_model: string
  graders: {
    name: string
    model: string
    grader_cost_usd: number
    aggregate_per_threshold: PerThreshold[]
  }[]
  reviewer_cost_usd: number
  spearman_matrix: { a: string; b: string; rho: number; n: number }[]
  disagreements: {
    comment_id: string
    file: string
    line: number
    principle_cited: string
    comment_body: string
    expected_match: boolean
    scores: Record<string, number>
    spread: number
  }[]
}

function aggregate(results: FixtureResult[]): PerThreshold[] {
  const agg: Record<number, { tp: number; fp: number; fn: number; n: number }> =
    {}
  for (const r of results) {
    for (const t of r.per_threshold) {
      const a = (agg[t.threshold] ??= { tp: 0, fp: 0, fn: 0, n: 0 })
      a.tp += t.tp
      a.fp += t.fp
      a.fn += t.fn
      a.n += t.retained_per_pr
    }
  }
  return Object.keys(agg)
    .map((s) => parseInt(s, 10))
    .sort((a, b) => a - b)
    .map((threshold) => {
      const { tp, fp, fn, n } = agg[threshold]
      const precision = tp + fp === 0 ? 0 : tp / (tp + fp)
      const recall = tp + fn === 0 ? 1 : tp / (tp + fn)
      const f1 =
        precision + recall === 0
          ? 0
          : (2 * precision * recall) / (precision + recall)
      return {
        threshold,
        tp,
        fp,
        fn,
        precision: Math.round(precision * 100) / 100,
        recall: Math.round(recall * 100) / 100,
        f1: Math.round(f1 * 100) / 100,
        retained_per_pr: Math.round((n / results.length) * 10) / 10
      }
    })
}

async function main() {
  const args = process.argv.slice(2)
  const inputs =
    args.length > 0
      ? args
      : [
          'scripts/results-haiku.json',
          'scripts/results-sonnet.json',
          'scripts/results-opus.json'
        ]

  const files: { name: string; data: ResultsFile }[] = []
  for (const path of inputs) {
    const data = JSON.parse(await readFile(path, 'utf8')) as ResultsFile
    const name = path.replace(/^.*results-(.+)\.json$/, '$1')
    files.push({ name, data })
  }

  console.log(
    `Loaded ${files.length} grader files: ${files.map((f) => f.name).join(', ')}`
  )

  // Build comment_id → score map per grader
  const scoresByGrader: Record<string, Map<string, number>> = {}
  for (const { name, data } of files) {
    const m = new Map<string, number>()
    for (const r of data.results) {
      for (const c of r.graded_comments) {
        m.set(c.comment_id, c.score.final_score)
      }
    }
    scoresByGrader[name] = m
  }

  // Comment IDs present in ALL graders (intersection)
  const allIds =
    files.length === 0
      ? new Set<string>()
      : files
          .map(({ name }) => new Set(scoresByGrader[name].keys()))
          .reduce(
            (acc, s) => new Set([...acc].filter((x) => s.has(x))),
            new Set(scoresByGrader[files[0].name].keys())
          )

  // Spearman matrix
  const matrix: { a: string; b: string; rho: number; n: number }[] = []
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const a = files[i].name
      const b = files[j].name
      const xs: number[] = []
      const ys: number[] = []
      for (const id of allIds) {
        xs.push(scoresByGrader[a].get(id)!)
        ys.push(scoresByGrader[b].get(id)!)
      }
      matrix.push({
        a,
        b,
        rho: xs.length > 1 ? Math.round(spearman(xs, ys) * 1000) / 1000 : 0,
        n: xs.length
      })
    }
  }

  // Disagreements: top 10 by score-spread
  const commentMeta = new Map<string, PersistedComment>()
  for (const { data } of files) {
    for (const r of data.results) {
      for (const c of r.graded_comments) {
        if (!commentMeta.has(c.comment_id)) commentMeta.set(c.comment_id, c)
      }
    }
  }

  const disagreements: ComparisonOutput['disagreements'] = []
  for (const id of allIds) {
    const scores: Record<string, number> = {}
    let min = Infinity
    let max = -Infinity
    for (const { name } of files) {
      const s = scoresByGrader[name].get(id)!
      scores[name] = s
      if (s < min) min = s
      if (s > max) max = s
    }
    const spread = max - min
    const meta = commentMeta.get(id)!
    disagreements.push({
      comment_id: id,
      file: meta.file,
      line: meta.line,
      principle_cited: meta.principle_cited,
      comment_body: meta.comment_body,
      expected_match: meta.expected_match,
      scores,
      spread
    })
  }
  disagreements.sort((a, b) => b.spread - a.spread)
  const topDisagreements = disagreements.slice(0, 10)

  const output: ComparisonOutput = {
    generated_at: new Date().toISOString(),
    reviewer_model: files[0].data.reviewer_model,
    reviewer_cost_usd: files[0].data.reviewer_cost_usd_total,
    graders: files.map(({ name, data }) => ({
      name,
      model: data.grader_model,
      grader_cost_usd: data.grader_cost_usd_total,
      aggregate_per_threshold: aggregate(data.results)
    })),
    spearman_matrix: matrix,
    disagreements: topDisagreements
  }

  await writeFile('scripts/comparison.json', JSON.stringify(output, null, 2))
  console.log(`\nWrote scripts/comparison.json`)

  // Console summary
  console.log(`\n=== Cost vs Quality (threshold 70) ===`)
  console.log(
    `Reviewer (cached, one-shot per PR): $${output.reviewer_cost_usd.toFixed(4)}`
  )
  console.log(`\ngrader  | grader cost | F1 @70 | retained/PR`)
  for (const g of output.graders) {
    const at70 = g.aggregate_per_threshold.find((t) => t.threshold === 70)
    console.log(
      `${g.name.padEnd(7)} | $${g.grader_cost_usd.toFixed(4).padStart(8)} | ${
        at70?.f1.toFixed(2).padStart(6) ?? '  N/A'
      } | ${at70?.retained_per_pr.toFixed(1).padStart(11) ?? '  N/A'}`
    )
  }

  console.log(`\n=== Spearman correlation (per-comment final_score) ===`)
  for (const { a, b, rho, n } of output.spearman_matrix) {
    console.log(`${a} ↔ ${b}: ρ=${rho.toFixed(3)} (n=${n})`)
  }

  console.log(`\n=== Top 5 disagreements ===`)
  for (const d of topDisagreements.slice(0, 5)) {
    const scoreStr = Object.entries(d.scores)
      .map(([n, s]) => `${n}=${s}`)
      .join(' ')
    console.log(
      `[spread ${d.spread}] ${d.file}:${d.line} (${d.principle_cited}, expected_match=${d.expected_match}) ${scoreStr}`
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
