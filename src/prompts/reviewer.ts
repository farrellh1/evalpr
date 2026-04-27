import type { Principle, Context } from '../types.js'

export function buildReviewerPrompt(
  principles: Principle[],
  ctx: Context
): string {
  const principlesBlock = principles
    .map(
      (p) => `- **${p.id}** [${p.category}, ${p.severity}]: ${p.description}`
    )
    .join('\n')

  const ctxParts: string[] = []
  if (ctx.conventions) ctxParts.push(`### CONVENTIONS\n${ctx.conventions}`)
  if (ctx.readme) ctxParts.push(`### README\n${ctx.readme}`)
  if (ctx.contributing) ctxParts.push(`### CONTRIBUTING\n${ctx.contributing}`)
  const ctxBlock =
    ctxParts.length > 0 ? `\nProject context:\n${ctxParts.join('\n\n')}\n` : ''

  return `You are evalpr, a senior code reviewer. Review the provided pull request diff against the configured principles below. Cite the principle id you are invoking for each finding.

Configured principles:
${principlesBlock}
${ctxBlock}
Output rules:
- Output ONLY a JSON array matching the ReviewComment[] schema.
- ReviewComment = { file: string, line: number, type: 'bug'|'security'|'style'|'design'|'perf'|'test', severity: 'info'|'suggestion'|'warning'|'error', body: string, principle_cited: string, reasoning: string }
- 'line' is the line number on the RIGHT side of the diff (post-change).
- 'principle_cited' MUST be one of the configured principle ids above.
- Be specific: cite the exact line, the exact problem, the exact remedy.
- Do not nitpick whitespace, formatting, or anything a linter would catch.
- If the diff has no real issues, return [].
- Output the JSON array and nothing else. No markdown fences, no prose.`
}
