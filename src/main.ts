import * as actionsCore from '@actions/core'
import * as actionsGithub from '@actions/github'
import { createOpenRouterClient } from './openrouter.js'
import { defaultPrinciples } from './default-principles.js'
import { loadConfig, mergePrinciples } from './config.js'
import { loadContext } from './context.js'
import { shouldSkipPR, applyIgnorePaths } from './filters.js'
import { filterDiffByPaths } from './diff-filter.js'
import { fetchDiff, postReview } from './github.js'
import { VERSION } from './version.js'
import { postSkipSummary } from './github-skip.js'
import { callReviewer } from './reviewer.js'
import { gradeAll } from './grader.js'
import { filterByThreshold } from './filter.js'
import type { OpenRouterClient } from './openrouter.js'
import type {
  Principle,
  Context,
  ReviewComment,
  GradedComment,
  EvalprConfig
} from './types.js'
import type { Octokit, PRRef, SummaryMeta } from './github.js'
import type { SkipReason } from './filters.js'

export interface RunDeps {
  core: typeof actionsCore
  github: typeof actionsGithub
  createClient: (apiKey: string) => OpenRouterClient
  callReviewer: (
    client: OpenRouterClient,
    model: string,
    diff: string,
    principles: Principle[],
    ctx: Context
  ) => Promise<ReviewComment[]>
  gradeAll: (
    client: OpenRouterClient,
    model: string,
    comments: ReviewComment[],
    principles: Principle[],
    ctx: Context
  ) => Promise<GradedComment[]>
  postReview: (
    octokit: Octokit,
    ref: PRRef,
    retained: GradedComment[],
    hiddenCount: number,
    commitSha: string,
    meta: SummaryMeta
  ) => Promise<void>
  postSkipSummary: (
    octokit: Octokit,
    ref: PRRef,
    commitSha: string,
    reason: SkipReason,
    fileCount?: number
  ) => Promise<void>
  loadConfig: (repoRoot: string, configPath: string) => Promise<EvalprConfig>
  loadContext: (repoRoot: string) => Promise<Context>
  fetchDiff: (octokit: Octokit, ref: PRRef) => Promise<string>
}

const defaultDeps: RunDeps = {
  core: actionsCore,
  github: actionsGithub,
  createClient: createOpenRouterClient,
  callReviewer,
  gradeAll,
  postReview,
  postSkipSummary,
  loadConfig: (repoRoot, configPath) => loadConfig(repoRoot, configPath),
  loadContext: (repoRoot) => loadContext(repoRoot),
  fetchDiff
}

export async function run(deps: Partial<RunDeps> = {}): Promise<void> {
  const d: RunDeps = { ...defaultDeps, ...deps }
  try {
    const apiKey = d.core.getInput('api_key')
    if (!apiKey) {
      d.core.setFailed('api_key input is required')
      return
    }

    const reviewerModel =
      d.core.getInput('reviewer_model') || 'anthropic/claude-sonnet-4.6'
    const graderModel =
      d.core.getInput('grader_model') || 'anthropic/claude-haiku-4.5'
    const threshold = parseInt(
      d.core.getInput('confidence_threshold') || '70',
      10
    )
    const ignorePathsInput = d.core.getInput('ignore_paths') || ''
    const maxFiles = parseInt(d.core.getInput('max_files') || '20', 10)
    const skipDrafts = (d.core.getInput('skip_drafts') || 'true') === 'true'
    const configPath = d.core.getInput('config_path') || '.evalpr.yml'

    const pr = d.github.context.payload.pull_request
    if (!pr) {
      d.core.setFailed('Action must be triggered by a pull_request event')
      return
    }

    const ref: PRRef = {
      owner: d.github.context.repo.owner,
      repo: d.github.context.repo.repo,
      pull_number: pr.number as number
    }
    const commitSha = (pr.head as { sha: string }).sha
    const octokit = d.github.getOctokit(process.env.GITHUB_TOKEN ?? '')

    const skip = shouldSkipPR(
      {
        draft: pr.draft as boolean,
        user_type: (pr.user as { type: string } | undefined)?.type ?? 'User',
        title: (pr.title as string) ?? '',
        changed_files: (pr.changed_files as number) ?? 0
      },
      { skipDrafts, maxFiles }
    )

    if (skip) {
      await d.postSkipSummary(
        octokit,
        ref,
        commitSha,
        skip,
        pr.changed_files as number
      )
      return
    }

    const repoRoot = process.env.GITHUB_WORKSPACE ?? process.cwd()
    const cfg = await d.loadConfig(repoRoot, configPath)
    const ctx = await d.loadContext(repoRoot)
    const principles = mergePrinciples(defaultPrinciples, cfg)
    const effectiveThreshold = cfg.review?.confidence_threshold ?? threshold
    const ignorePaths = [
      ...ignorePathsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      ...(cfg.review?.ignore_paths ?? [])
    ]

    const client = d.createClient(apiKey)
    const diff = await d.fetchDiff(octokit, ref)
    const filteredDiff = filterDiffByPaths(diff, ignorePaths)

    let reviewerComments: ReviewComment[]
    try {
      reviewerComments = await d.callReviewer(
        client,
        reviewerModel,
        filteredDiff,
        principles,
        ctx
      )
    } catch (err) {
      d.core.warning(
        `Reviewer failed: ${err instanceof Error ? err.message : String(err)}`
      )
      await octokit.rest.pulls.createReview({
        ...ref,
        commit_id: commitSha,
        event: 'COMMENT',
        body: '**evalpr** reviewer output malformed; skipping this run.'
      })
      return
    }

    const filteredByPath = reviewerComments.filter(
      (c) => !applyIgnorePaths(c.file, ignorePaths)
    )

    const graded = await d.gradeAll(
      client,
      graderModel,
      filteredByPath,
      principles,
      ctx
    )
    const flagged = filterByThreshold(graded, effectiveThreshold)
    const retained = flagged.filter((c) => c.retained)
    const hidden = flagged.length - retained.length

    await d.postReview(octokit, ref, retained, hidden, commitSha, {
      reviewerModel,
      graderModel,
      version: VERSION
    })

    d.core.setOutput('retained_count', retained.length)
    d.core.setOutput('hidden_count', hidden)
  } catch (err) {
    d.core.setFailed(
      `evalpr failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}
