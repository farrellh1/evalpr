import type { Principle, Context, ReviewComment } from '../types.js'

export function buildGraderPrompt(
  comment: ReviewComment,
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

  return `You are evalpr's grader. A reviewer LLM produced a code review comment. Score it on four dimensions, each 0-100:

1. confidence: how likely is this finding a real, actionable issue?
2. specificity: does it cite concrete code, line, and a concrete fix — not vague advice?
3. calibration: is the claimed severity reasonable? (style nit at 'error' is bad calibration)
4. principle_alignment: does the cited principle id exist in the configured set, and does the reasoning actually follow from it? Penalize if principle_cited is not in the configured list, or if the reasoning contradicts project conventions.

Configured principles:
${principlesBlock}
${ctxBlock}
Comment under review:
- file: ${comment.file}
- line: ${comment.line}
- type: ${comment.type}
- severity: ${comment.severity}
- principle_cited: ${comment.principle_cited}
- reasoning: ${comment.reasoning}
- body: ${comment.body}

Output rules:
- Output ONLY a JSON object matching the Score schema.
- Score = { confidence: number, specificity: number, calibration: number, principle_alignment: number, final_score: number, rationale: string }
- final_score = 0.40*confidence + 0.25*principle_alignment + 0.20*specificity + 0.15*calibration (rounded to integer).
- rationale: 1-2 sentences, plain text.
- Output JSON only. No markdown fences, no prose.`
}
