import { z } from 'zod'

export const SeverityEnum = z.enum(['info', 'suggestion', 'warning', 'error'])

export const CategoryEnum = z.enum([
  'correctness',
  'security',
  'readability',
  'maintainability',
  'performance',
  'testing',
  'project'
])

export const PrincipleSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  severity: SeverityEnum,
  category: CategoryEnum
})

export const ReviewCommentSchema = z.object({
  file: z.string().min(1),
  line: z.number().int().nonnegative(),
  type: z.enum(['bug', 'security', 'style', 'design', 'perf', 'test']),
  severity: SeverityEnum,
  body: z.string().min(1),
  principle_cited: z.string().min(1),
  reasoning: z.string().min(1)
})

export const ReviewCommentArraySchema = z.array(ReviewCommentSchema)

export const ScoreSchema = z.object({
  confidence: z.number().min(0).max(100),
  specificity: z.number().min(0).max(100),
  calibration: z.number().min(0).max(100),
  principle_alignment: z.number().min(0).max(100),
  final_score: z.number().min(0).max(100),
  rationale: z.string().min(1)
})

export const EvalprConfigSchema = z.object({
  principles: z
    .object({
      add: z.array(PrincipleSchema).optional(),
      remove: z.array(z.string()).optional(),
      override: z.array(PrincipleSchema).optional()
    })
    .optional(),
  review: z
    .object({
      confidence_threshold: z.number().min(0).max(100).optional(),
      ignore_paths: z.array(z.string()).optional()
    })
    .optional()
})
