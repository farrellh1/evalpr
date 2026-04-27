import { z } from 'zod'
import {
  PrincipleSchema,
  ReviewCommentSchema,
  ScoreSchema,
  EvalprConfigSchema
} from './schemas.js'

export type Principle = z.infer<typeof PrincipleSchema>
export type ReviewComment = z.infer<typeof ReviewCommentSchema>
export type Score = z.infer<typeof ScoreSchema>
export type EvalprConfig = z.infer<typeof EvalprConfigSchema>
export type GradedComment = ReviewComment & { score: Score; retained: boolean }
export interface Context {
  conventions?: string
  readme?: string
  contributing?: string
}
