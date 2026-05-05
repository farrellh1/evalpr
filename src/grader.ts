import type { OpenRouterClient } from './openrouter.js'
import { extractUsage, addUsage, ZERO_USAGE, type Usage } from './openrouter.js'
import type {
  Principle,
  Context,
  ReviewComment,
  Score,
  GradedComment
} from './types.js'
import { ScoreSchema } from './schemas.js'
import { buildGraderPrompt } from './prompts/grader.js'

const MAX_ATTEMPTS = 2
const FENCE = /^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/

function stripFences(text: string): string {
  const t = text.trim()
  const m = t.match(FENCE)
  return m ? m[1].trim() : t
}

const FAILED_SCORE: Score = {
  confidence: 0,
  specificity: 0,
  calibration: 0,
  principle_alignment: 0,
  final_score: 0,
  rationale: 'grader output malformed; comment hidden'
}

export interface GradeCommentResult {
  score: Score
  usage: Usage
}

export async function gradeComment(
  client: OpenRouterClient,
  model: string,
  comment: ReviewComment,
  principles: Principle[],
  ctx: Context
): Promise<GradeCommentResult> {
  const systemPrompt = buildGraderPrompt(comment, principles, ctx)
  let totalUsage: Usage = ZERO_USAGE
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const reminder =
        attempt === 0
          ? ''
          : '\n\nIMPORTANT: Output ONLY a valid JSON object. No markdown, no prose.'
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt + reminder },
          { role: 'user', content: 'Score the comment above.' }
        ],
        temperature: 0
      })
      // Capture usage BEFORE any throw — billed regardless of parse success.
      totalUsage = addUsage(totalUsage, extractUsage(res))
      const content = res.choices[0]?.message?.content ?? ''
      if (!content.trim()) throw new Error('grader returned empty content')
      const stripped = stripFences(content)
      const parsed = JSON.parse(stripped)
      return { score: ScoreSchema.parse(parsed), usage: totalUsage }
    } catch {
      // continue; totalUsage already updated for this attempt if response arrived
    }
  }
  return { score: FAILED_SCORE, usage: totalUsage }
}

export interface GradeAllResult {
  graded: GradedComment[]
  usage: Usage
}

export async function gradeAll(
  client: OpenRouterClient,
  model: string,
  comments: ReviewComment[],
  principles: Principle[],
  ctx: Context
): Promise<GradeAllResult> {
  const results = await Promise.all(
    comments.map((c) => gradeComment(client, model, c, principles, ctx))
  )
  const totalUsage = results.reduce(
    (acc, r) => addUsage(acc, r.usage),
    ZERO_USAGE
  )
  const graded = comments.map((c, i) => ({
    ...c,
    score: results[i].score,
    retained: false
  }))
  return { graded, usage: totalUsage }
}
