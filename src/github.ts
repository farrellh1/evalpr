import * as core from '@actions/core'
import type { getOctokit } from '@actions/github'
import type { GradedComment } from './types.js'

export type Octokit = ReturnType<typeof getOctokit>

export interface PRRef {
  owner: string
  repo: string
  pull_number: number
}

export interface SummaryMeta {
  reviewerModel: string
  graderModel: string
  version: string
}

export async function fetchDiff(octokit: Octokit, ref: PRRef): Promise<string> {
  const res = await octokit.rest.pulls.get({
    ...ref,
    mediaType: { format: 'diff' }
  })
  return res.data as unknown as string
}

export async function postReview(
  octokit: Octokit,
  ref: PRRef,
  retained: GradedComment[],
  hiddenCount: number,
  commitSha: string,
  meta: SummaryMeta
): Promise<void> {
  for (const c of retained) {
    try {
      await octokit.rest.pulls.createReviewComment({
        ...ref,
        commit_id: commitSha,
        path: c.file,
        line: c.line,
        side: 'RIGHT',
        body: renderInlineBody(c)
      })
    } catch (err) {
      core.warning(
        `Failed to post inline comment on ${c.file}:${c.line}: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }
  }

  const summary = renderSummary(retained, hiddenCount, meta)
  await octokit.rest.pulls.createReview({
    ...ref,
    commit_id: commitSha,
    event: 'COMMENT',
    body: summary
  })
}

function renderInlineBody(c: GradedComment): string {
  return `**${labelFor(c.severity)} — ${c.type}**

${c.body}

<sub>evalpr · principle: \`${c.principle_cited}\` · score: ${c.score.final_score}</sub>`
}

function labelFor(sev: GradedComment['severity']): string {
  switch (sev) {
    case 'error':
      return '🔴 error'
    case 'warning':
      return '🟡 warning'
    case 'suggestion':
      return '🔵 suggestion'
    case 'info':
      return 'ℹ info'
  }
}

function renderSummary(
  retained: GradedComment[],
  hiddenCount: number,
  meta: SummaryMeta
): string {
  const counts = new Map<string, number>()
  for (const c of retained) {
    counts.set(c.principle_cited, (counts.get(c.principle_cited) ?? 0) + 1)
  }
  const triggeredLine =
    counts.size > 0
      ? `\n\nTriggered: ${[...counts.entries()]
          .map(([id, n]) => (n > 1 ? `\`${id}\` ×${n}` : `\`${id}\``))
          .join(', ')}`
      : ''

  const footer = `\n\n<sub>Reviewed by ${friendlyModel(
    meta.reviewerModel
  )} · Graded by ${friendlyModel(meta.graderModel)} · evalpr v${meta.version}</sub>`

  return `**evalpr** posted ${retained.length} high-confidence finding${
    retained.length === 1 ? '' : 's'
  }. ${hiddenCount} low-confidence finding${
    hiddenCount === 1 ? '' : 's'
  } hidden.${triggeredLine}${footer}`
}

function friendlyModel(id: string): string {
  const last = id.split('/').pop() ?? id
  const m = last.match(/^claude-([a-z]+)-([\d.]+)$/)
  if (m) return `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}`
  return last
}
