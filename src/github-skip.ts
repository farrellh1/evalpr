import type { Octokit, PRRef } from './github.js'
import type { SkipReason } from './filters.js'

export async function postSkipSummary(
  octokit: Octokit,
  ref: PRRef,
  commitSha: string,
  reason: SkipReason,
  fileCount?: number
): Promise<void> {
  const body = renderSkipBody(reason, fileCount)
  await octokit.rest.pulls.createReview({
    ...ref,
    commit_id: commitSha,
    event: 'COMMENT',
    body
  })
}

function renderSkipBody(reason: SkipReason, fileCount?: number): string {
  switch (reason) {
    case 'draft':
      return '**evalpr** skipped: draft PR. Mark ready for review to trigger.'
    case 'bot':
      return '**evalpr** skipped: PR opened by a bot.'
    case 'skip-tag':
      return '**evalpr** skipped: `[skip-review]` in PR title.'
    case 'max-files':
      return `**evalpr** skipped: PR too large (${
        fileCount ?? 'too many'
      } files). Increase \`max_files\` in your workflow to override.`
  }
}
