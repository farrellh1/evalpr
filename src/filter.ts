import type { GradedComment } from './types.js'

export function filterByThreshold(
  comments: GradedComment[],
  threshold: number
): GradedComment[] {
  return comments.map((c) => ({
    ...c,
    retained: c.score.final_score >= threshold
  }))
}
