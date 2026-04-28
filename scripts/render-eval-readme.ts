import { readFile, writeFile } from 'node:fs/promises'

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

interface ResultsFile {
  generated_at: string
  reviewer_model: string
  grader_model: string
  results: { fixture: string; per_threshold: PerThreshold[] }[]
}

async function main() {
  const data: ResultsFile = JSON.parse(
    await readFile('scripts/eval-results.json', 'utf8')
  )

  const agg: Record<number, { tp: number; fp: number; fn: number; n: number }> =
    {}
  for (const r of data.results) {
    for (const t of r.per_threshold) {
      const a = (agg[t.threshold] ??= { tp: 0, fp: 0, fn: 0, n: 0 })
      a.tp += t.tp
      a.fp += t.fp
      a.fn += t.fn
      a.n += t.retained_per_pr
    }
  }

  const lines: string[] = []
  lines.push(
    `_Eval results across ${data.results.length} fixtures, ${data.reviewer_model} → ${data.grader_model}, generated ${data.generated_at.slice(0, 10)}._`
  )
  lines.push('')
  lines.push('| threshold | precision | recall | F1   | findings/PR |')
  lines.push('|----------:|----------:|-------:|-----:|------------:|')
  for (const t of Object.keys(agg)
    .map((s) => parseInt(s, 10))
    .sort((a, b) => a - b)) {
    const { tp, fp, fn, n } = agg[t]
    const p = tp + fp === 0 ? 0 : tp / (tp + fp)
    const r = tp + fn === 0 ? 1 : tp / (tp + fn)
    const f1 = p + r === 0 ? 0 : (2 * p * r) / (p + r)
    lines.push(
      `| ${t} | ${p.toFixed(2)} | ${r.toFixed(2)} | ${f1.toFixed(2)} | ${(
        n / data.results.length
      ).toFixed(1)} |`
    )
  }
  const block = lines.join('\n')

  const readme = await readFile('README.md', 'utf8')
  const updated = readme.replace(
    /<!-- EVAL:START -->[\s\S]*?<!-- EVAL:END -->/,
    `<!-- EVAL:START -->\n${block}\n<!-- EVAL:END -->`
  )
  await writeFile('README.md', updated)
  console.log('README updated.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
