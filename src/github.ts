import * as core from '@actions/core'
import type { getOctokit } from '@actions/github'
import type { GradedComment } from './types.js'

export type Octokit = ReturnType<typeof getOctokit>

export interface PRRef {
  owner: string
  repo: string
  pull_number: number
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
  principleIds: string[]
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

  const summary = renderSummary(retained.length, hiddenCount, principleIds)
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
  retainedCount: number,
  hiddenCount: number,
  principleIds: string[]
): string {
  const principlesLine =
    principleIds.length > 0
      ? `\n\nConfigured principles: ${principleIds
          .map((p) => `\`${p}\``)
          .join(', ')}`
      : ''
  return `**evalpr** posted ${retainedCount} high-confidence finding${
    retainedCount === 1 ? '' : 's'
  }. ${hiddenCount} low-confidence finding${
    hiddenCount === 1 ? '' : 's'
  } hidden.${principlesLine}`
}
