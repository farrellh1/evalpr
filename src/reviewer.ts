import type { OpenRouterClient } from './openrouter.js'
import type { Principle, Context, ReviewComment } from './types.js'
import { ReviewCommentArraySchema } from './schemas.js'
import { buildReviewerPrompt } from './prompts/reviewer.js'

const MAX_ATTEMPTS = 2
const FENCE = /^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/
const ESCAPE_OR_CHAR = /\\(u[0-9a-fA-F]{4}|["\\/bfnrtu]|[\s\S])/g
const VALID_SHORT_ESCAPES = '"\\/bfnrtu'

function stripFences(text: string): string {
  const trimmed = text.trim()
  const m = trimmed.match(FENCE)
  return m ? m[1].trim() : trimmed
}

export function sanitizeJsonEscapes(text: string): string {
  return text.replace(ESCAPE_OR_CHAR, (match, group: string) => {
    if (group.startsWith('u')) return match
    if (VALID_SHORT_ESCAPES.includes(group)) return match
    return '\\\\' + group
  })
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
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
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
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
      if (!content.trim()) {
        throw new Error('reviewer returned empty content')
      }
      const stripped = stripFences(content)
      const parsed = JSON.parse(sanitizeJsonEscapes(stripped))
      return ReviewCommentArraySchema.parse(parsed)
    } catch (err) {
      lastError = err
    }
  }
  throw new Error(
    `Reviewer output malformed after retry: ${errorMessage(lastError)}`,
    { cause: lastError }
  )
}
