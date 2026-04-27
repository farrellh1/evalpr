import type { OpenRouterClient } from './openrouter.js'
import type { Principle, Context, ReviewComment } from './types.js'
import { ReviewCommentArraySchema } from './schemas.js'
import { buildReviewerPrompt } from './prompts/reviewer.js'

const FENCE = /^```(?:json)?\s*\n([\s\S]*?)\n```$/

function stripFences(text: string): string {
  const trimmed = text.trim()
  const m = trimmed.match(FENCE)
  return m ? m[1].trim() : trimmed
}

async function callOnce(
  client: OpenRouterClient,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.2
  })
  return res.choices[0]?.message?.content ?? ''
}

export async function callReviewer(
  client: OpenRouterClient,
  model: string,
  diff: string,
  principles: Principle[],
  ctx: Context
): Promise<ReviewComment[]> {
  const systemPrompt = buildReviewerPrompt(principles, ctx)
  const userPrompt = `Pull request diff:\n\n${diff}`

  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const reminder =
        attempt === 0
          ? ''
          : '\n\nIMPORTANT: Output ONLY a valid JSON array. No markdown, no prose.'
      const content = await callOnce(
        client,
        model,
        systemPrompt + reminder,
        userPrompt
      )
      const stripped = stripFences(content)
      const parsed = JSON.parse(stripped)
      return ReviewCommentArraySchema.parse(parsed)
    } catch (err) {
      lastError = err
    }
  }
  throw new Error(
    `Reviewer output malformed after retry: ${(lastError as Error).message}`
  )
}
