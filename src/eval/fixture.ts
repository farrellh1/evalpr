import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { CategoryEnum, SeverityEnum } from '../schemas.js'

type ReadFileFn = (p: string, enc: 'utf8') => Promise<string>

export const ExpectedFindingSchema = z.object({
  file: z.string(),
  line_range: z.tuple([z.number().int(), z.number().int()]),
  category: CategoryEnum,
  min_severity: SeverityEnum,
  must_cite_principle: z.string().optional()
})

export const ExpectedSchema = z.object({
  description: z.string(),
  expected_findings: z.array(ExpectedFindingSchema),
  expected_clean: z.boolean(),
  max_acceptable_findings: z.number().int().nonnegative()
})

export type ExpectedFinding = z.infer<typeof ExpectedFindingSchema>
export type Expected = z.infer<typeof ExpectedSchema>

export interface Fixture {
  id: string
  diff: string
  context?: string
  expected: Expected
}

async function tryRead(
  path: string,
  readFileFn: ReadFileFn
): Promise<string | undefined> {
  try {
    return await readFileFn(path, 'utf8')
  } catch {
    return undefined
  }
}

export async function loadFixture(
  dir: string,
  readFileFn: ReadFileFn = readFile
): Promise<Fixture> {
  const id = dir.split('/').pop() ?? dir

  const [diff, context, expectedRaw] = await Promise.all([
    readFileFn(join(dir, 'diff.patch'), 'utf8'),
    tryRead(join(dir, 'context.md'), readFileFn),
    readFileFn(join(dir, 'expected.json'), 'utf8')
  ])

  const expected = ExpectedSchema.parse(JSON.parse(expectedRaw))

  const fixture: Fixture = { id, diff, expected }
  if (context !== undefined) fixture.context = context

  return fixture
}
