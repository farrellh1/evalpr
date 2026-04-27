---
title: "evalpr — Design Spec"
type: spec
date: 2026-04-27
status: approved
target_repo: github.com/farrellh1/evalpr
---

# evalpr — Design Spec

## Summary

**evalpr** is an eval-graded AI code review GitHub Action. A two-LLM pipeline (Sonnet 4.6 reviews, Haiku 4.5 grades) posts only high-confidence findings to PRs. Reviews are guided by a configurable principle set (defaults bundled, override per-repo via `.evalpr.yml`) plus lightweight RAG over a repo's `CONVENTIONS.md` / `README.md` / `CONTRIBUTING.md`. Quality is measured by an offline eval harness against a hand-graded fixture set.

**Why it exists:** portfolio piece for an AI Product Engineer pivot (Upwork relaunch + AfterQuery story). Goal is portfolio polish, not product traction. Definition-of-done is Day 6 OR quality bar — whichever first.

**Career frame, deadlines, and Day-7+ flows live in `upwork-relaunch.md`. This spec is purely technical.**

## Locked decisions

| Decision | Value |
|---|---|
| Name | `evalpr` |
| Form factor | GitHub Action (web demo deferred) |
| Stack | TypeScript, `@actions/core` + `@actions/github`, OpenAI SDK pointed at OpenRouter |
| Reviewer model | `anthropic/claude-sonnet-4.6` |
| Grader model | `anthropic/claude-haiku-4.5` |
| Grader call pattern | Per-comment, parallel via `Promise.all` |
| Error mode | Soft — Action exits 0 on evalpr's own bugs, hard-fails only on misconfig |
| Repo | `github.com/farrellh1/evalpr`, public day 1, MIT, conventional commits |
| Scaffold method | `gh repo create farrellh1/evalpr --public --template actions/typescript-action --clone` |
| API key handling | Local `.env.local` for dev (gitignored); GitHub secret for dogfood |
| Spec location | This spec moves to `<repo>/docs/superpowers/specs/2026-04-27-evalpr-design.md` on scaffold |

## Non-goals (v0.1.0)

- No DB / persistence
- No metrics dashboard
- No multi-repo / multi-tenant
- No web UI / web demo
- No interactive `@evalpr review` chat commands
- No incremental review (re-grades full diff each push)
- No model fallback chain
- Eval harness is **not** a CI blocking check (LLM nondeterminism + cost — manual runs only)

## Architecture

```
PR opened/synced
  ↓
GitHub Action triggers (.github/workflows/evalpr.yml in consumer repo)
  ↓
Action runner checks out consumer repo
  ↓
Load configured principle set:
  · Default principle pack (bundled in action)
  · Optional .evalpr.yml override (add/remove/override)
  ↓
Load codebase context (lightweight RAG):
  · CONVENTIONS.md, CONTRIBUTING.md, README.md (if present)
  · Per-file truncate to 4 KB; total context budget 12 KB (truncation note appended on cut)
  ↓
Fetch PR diff via @actions/github (octokit pulls.get, Accept: application/vnd.github.v3.diff)
  ↓
Apply filters: skip drafts, bots, [skip-review] in title, max_files cap, ignore_paths globs
  ↓
LLM #1 — REVIEWER (Sonnet 4.6 via OpenRouter)
   In:  diff + principles + repo context
   Out: ReviewComment[] (Zod-validated JSON)
  ↓
LLM #2 — GRADER (Haiku 4.5 via OpenRouter), per-comment, Promise.all
   In:  one ReviewComment + principles + repo context
   Out: Score { confidence, specificity, calibration, principle_alignment, final_score }
  ↓
Filter: drop comments where final_score < confidence_threshold (default 70)
  ↓
Post via Octokit:
   · Inline comments for retained findings (pulls.createReviewComment)
   · Summary review (pulls.createReview, event: COMMENT)
     "evalpr posted X high-confidence findings. Y low-confidence findings hidden.
      Configured principles: <list>"
```

**Score aggregation (initial weights, tuned via eval harness):**
```
final_score = 0.40*confidence + 0.25*principle_alignment
            + 0.20*specificity + 0.15*calibration
```

## Module structure

```
evalpr/
├── action.yml                       # entrypoint, inputs
├── src/
│   ├── index.ts                     # main(): orchestrator, ~50 LoC
│   ├── config.ts                    # load + merge .evalpr.yml + defaults
│   ├── github.ts                    # octokit wrapper: fetchDiff, postComments, postSummary
│   ├── filters.ts                   # shouldSkipPR, applyIgnorePaths, capFiles
│   ├── context.ts                   # read CONVENTIONS/README/CONTRIBUTING from runner FS
│   ├── openrouter.ts                # OpenAI-SDK wrapper, base_url=openrouter.ai/api/v1
│   ├── reviewer.ts                  # callReviewer(diff, principles, ctx) → ReviewComment[]
│   ├── grader.ts                    # gradeComment(comment, principles, ctx) → Score
│   ├── prompts/
│   │   ├── reviewer.ts              # system prompt builder
│   │   └── grader.ts                # system prompt builder
│   ├── schemas.ts                   # Zod: ReviewComment, Score, EvalprConfig, Principle
│   ├── default-principles.ts        # exports defaultPrinciples: Principle[] (runtime source)
│   └── types.ts                     # shared TS types derived from schemas
├── prompts/
│   └── default-principles.md        # human-curation artifact (Day 2 drafting); NOT used at runtime
├── fixtures/                        # eval harness inputs (Day 5.5)
│   └── pr-NNN-<slug>/{diff.patch, context.md, expected.json}
├── scripts/
│   ├── eval.ts                      # offline eval runner → precision/recall table
│   └── render-eval-readme.ts        # eval-results.json → README markdown table
├── .github/workflows/
│   ├── ci.yml                       # lint, typecheck, test, build, dist diff
│   └── evalpr.yml                   # dogfood install on this repo
├── docs/superpowers/specs/
│   └── 2026-04-27-evalpr-design.md  # this spec (relocated from vault on Day 1)
├── dist/index.js                    # ncc bundle, committed (Action requirement)
├── action.yml
├── package.json
├── tsconfig.json
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore                       # includes .env.local
├── LICENSE                          # MIT
└── README.md                        # hero gif, architecture diagram, eval table, install
```

**Module boundaries:**
- `index.ts` is the **only** file touching `@actions/core` runtime
- `github.ts` is the **only** Octokit caller
- `openrouter.ts` is the **only** HTTP boundary to LLMs
- `reviewer.ts` / `grader.ts` are **pure functions** of inputs → outputs (testable, eval-runnable without GitHub)
- This isolation is what makes the eval harness possible — it calls `reviewer` + `grader` directly, no Action runtime.

## Schemas (Zod, single source of truth in `src/schemas.ts`)

```ts
Principle = {
  id: string,                        // kebab-case, e.g. "no-default-export"
  description: string,
  severity: 'info' | 'suggestion' | 'warning' | 'error',
  category: 'correctness' | 'security' | 'readability'
          | 'maintainability' | 'performance' | 'testing' | 'project',
}

EvalprConfig = {
  principles?: {
    add?: Principle[],
    remove?: string[],               // principle ids
    override?: Principle[],
  },
  review?: {
    confidence_threshold?: number,   // 0-100, default 70
    ignore_paths?: string[],         // glob patterns
  },
}

ReviewComment = {                    // reviewer output, validated
  file: string,
  line: number,                      // RIGHT side of diff (post-change)
  type: 'bug' | 'security' | 'style' | 'design' | 'perf' | 'test',
  severity: 'info' | 'suggestion' | 'warning' | 'error',
  body: string,                      // markdown, the comment shown on the PR
  principle_cited: string,           // principle id from configured set
  reasoning: string,                 // why this matches the principle
}

Score = {                            // grader output, per ReviewComment
  confidence: number,                // 0-100, is it a real issue
  specificity: number,               // 0-100, cites concrete code
  calibration: number,               // 0-100, claimed severity reasonable
  principle_alignment: number,       // 0-100, matches a configured principle
  final_score: number,               // weighted aggregate, 0-100
  rationale: string,                 // 1-2 sentences, why this score
}

GradedComment = ReviewComment & { score: Score, retained: boolean }
```

## Pipeline contracts (function signatures)

```ts
fetchDiff(octokit, pr): Promise<string>                      // unified diff
loadConfig(repoRoot, configPath): Promise<EvalprConfig>
loadContext(repoRoot): Promise<{ conventions?: string, readme?: string, contributing?: string }>
mergePrinciples(defaults: Principle[], cfg: EvalprConfig): Principle[]
callReviewer(diff: string, principles: Principle[], ctx: Context): Promise<ReviewComment[]>
gradeComment(c: ReviewComment, principles: Principle[], ctx: Context): Promise<Score>
filterByThreshold(graded: GradedComment[], t: number): GradedComment[]   // sets `retained`
postReview(octokit, pr, retained: GradedComment[], hidden_count: number): Promise<void>
```

`reviewer.ts` and `grader.ts` know nothing about GitHub or `@actions/core`. This is deliberate.

## `action.yml` inputs

```yaml
name: 'evalpr'
description: 'Eval-graded AI code review for your PRs'
inputs:
  api_key:
    description: 'OpenRouter API key'
    required: true
  reviewer_model:
    default: 'anthropic/claude-sonnet-4.6'
  grader_model:
    default: 'anthropic/claude-haiku-4.5'
  confidence_threshold:
    default: '70'
  ignore_paths:
    default: 'node_modules/**,*.lock,dist/**,build/**,*.min.js'
  max_files:
    default: '20'
  skip_drafts:
    default: 'true'
  config_path:
    default: '.evalpr.yml'
runs:
  using: 'node20'
  main: 'dist/index.js'
```

## Default principle pack

15-20 principles curated from durable engineering literature, NOT Clean Code dogma.

**Storage:** single source of truth in `src/default-principles.ts`, exporting `defaultPrinciples: Principle[]`. The reviewer prompt builder formats this list into a human-readable markdown block at runtime. `prompts/default-principles.md` is NOT used at runtime — it's the human-curation artifact (Day 2 lives here while drafting), but at runtime the typed array is the only source. This avoids parsing markdown at init and keeps `.evalpr.yml` merge straightforward (typed in, typed out).

**Sources drawn from:**
- *The Pragmatic Programmer* — DRY, orthogonality, tracer bullets, broken windows
- *A Philosophy of Software Design* (Ousterhout) — deep modules, complexity isolation
- *Software Engineering at Google* — real tradeoffs, scale realities
- *Effective TypeScript* / *Effective Java* — stack-specific, evidence-based
- *Clean Code* — naming + clarity philosophy only, NOT rigid micro-rules

**Avoid baking in:**
- Strict line-count / function-length rules
- "No comments ever" dogma
- Dogmatic OOP fragmentation
- Citing "Clean Code Ch. X" verbatim — smug + dated

**Categories covered (~15-20 principles total):**
- **correctness** — null/undefined, error propagation, edge cases, off-by-one
- **security** — input validation, injection, secrets, auth boundaries
- **readability** — naming, intent over cleverness, function purpose obvious
- **maintainability** — DRY (with sense), orthogonality, deep vs shallow modules
- **performance** — obvious O(n²) hotspots, blocking I/O in async paths
- **testing** — testability, deterministic boundaries, untested critical paths
- **project** — match what's already in the codebase

## `.evalpr.yml` (per-project override)

```yaml
principles:
  add:
    - id: "result-pattern"
      description: "Use Result<T, E> over throwing exceptions in domain code"
      severity: warning
      category: maintainability
    - id: "no-default-export"
      description: "All exports must be named, no default exports"
      severity: suggestion
      category: project
  remove:
    - "performance-async-blocking"
  override:
    - id: "naming-clarity"
      description: "Variable names must be descriptive; single-letter only in narrow scopes"
      severity: warning
      category: readability

review:
  confidence_threshold: 75
  ignore_paths:
    - "legacy/**"
    - "*.generated.ts"
```

The grader uses the **same** principle set as the reviewer — so it can penalize comments that don't cite a configured principle or contradict project conventions.

## Eval harness

**Goal:** prove reviewer quality with numbers, catch prompt regressions, produce a README-worthy precision/recall table.

**Fixture format (`fixtures/pr-NNN-<slug>/`):**

```
diff.patch        # unified diff, hand-crafted or harvested-from-real-PR-anonymized
context.md        # optional fake CONVENTIONS.md content
expected.json     # gold labels
```

**`expected.json`:**

```jsonc
{
  "description": "Null deref on user.email when user is undefined",
  "expected_findings": [
    {
      "file": "src/user.ts",
      "line_range": [12, 16],
      "category": "correctness",
      "min_severity": "warning",
      "must_cite_principle": "null-undefined-handling"
    }
  ],
  "expected_clean": false,
  "max_acceptable_findings": 3
}
```

**Fixture set (10 total):**
- 6 positive, one per category (correctness, security, readability, maintainability, performance, testing)
- 2 clean (`expected_clean: true`)
- 2 borderline (style-nit territory, should be hidden by threshold)

**Runner (`scripts/eval.ts`):**

```
for each fixture in fixtures/:
  diff   = read diff.patch
  ctx    = read context.md (optional)
  princ  = mergePrinciples(defaults, no .evalpr.yml override)
  raw    = await callReviewer(diff, princ, ctx)
  graded = await Promise.all(raw.map(c => gradeComment(c, princ, ctx)))

  for t in [50, 60, 70, 80, 90]:
    retained = filterByThreshold(graded, t)
    matches  = matchAgainstExpected(retained, expected.expected_findings)
    record(fixture, t, tp, fp, fn)

print precision/recall/F1 table per threshold
write results to scripts/eval-results.json
```

**Match rule:** retained finding is a true positive iff
- same file, AND
- predicted line ∈ expected `line_range`, AND
- predicted category == expected category.

`must_cite_principle` is reported but not required for TP (avoids brittleness when principle ids drift during prompt tuning).

**Run modes:**
- `npm run eval` — full set
- `npm run eval -- --fixture pr-001` — single
- `npm run eval -- --threshold 70` — single threshold (faster prompt iteration)

**Output:** `scripts/render-eval-readme.ts` generates a markdown table from `eval-results.json` + injects into README between `<!-- EVAL:START -->` and `<!-- EVAL:END -->` markers. Pin "results as of v0.1.0" so the table doesn't lie when prompts evolve later.

**Day budget:** Day 5.5 = ~4 hrs. If over, cut to 5 fixtures (3 positive + 1 clean + 1 borderline) — still earns the README screenshot.

**Scope-cut order if Day 5.5 has to drop entirely:** keep at least 3 fixtures + manual run + screenshot. Eval harness is the moat — never delete entirely.

## Filters

| Filter | Rule | Source |
|---|---|---|
| Draft PRs | `pr.draft === true` → skip if `skip_drafts=true` | `action.yml` input |
| Bots | `pr.user.type === 'Bot'` → always skip | hardcoded |
| Skip tag | `[skip-review]` substring in PR title → skip | hardcoded |
| Max files | `pr.changed_files > max_files` → skip with summary | `action.yml` input |
| Path globs | minimatch against `ignore_paths` (action input ∪ `.evalpr.yml`) | both |

When skipping, post a summary review (`event: COMMENT`, body explains skip reason) so the dev knows evalpr ran. Configurable silent mode deferred to v0.2.

## Error handling

| Failure | Behavior | Action exit |
|---|---|---|
| Missing `api_key` input | log, `core.setFailed`, abort | 1 |
| Octokit `pulls.get` fails (auth/404) | log, `core.setFailed` | 1 |
| `.evalpr.yml` malformed | warn, fall back to defaults, continue | 0 |
| Context files (CONVENTIONS etc.) missing | silent, omit from prompt | 0 |
| OpenRouter network error (reviewer) | retry 1× w/ 2s backoff, then summary "evalpr unavailable" | 0 |
| OpenRouter network error (one grader call) | retry 1× then `confidence=0` for that comment → filtered | 0 |
| Reviewer returns malformed JSON | retry 1× w/ stricter "JSON only" reminder, then summary "reviewer output malformed, skipping this run" | 0 |
| Grader returns malformed JSON | retry 1× then `confidence=0` for that comment | 0 |
| Zod validation fails on parsed JSON | same as malformed | 0 |
| Posting one inline comment fails | log per-comment, continue, summary still posts | 0 |
| `max_files` exceeded | summary "PR too large (N files), evalpr skipped" | 0 |
| Filter trips (draft / bot / `[skip-review]`) | summary "evalpr skipped: <reason>" | 0 |

**Principles:**
1. Never red-X the PR check on evalpr's own bug. `setFailed` only for misconfig the user must fix.
2. One retry max. Loops eat OpenRouter $$ and slow PRs.
3. Per-comment grader failure ≠ run failure. A single bad grade just hides that comment.
4. Always post a summary. Even on partial failure, the developer knows something happened.
5. `core.warning` for soft failures, `core.error` only for misconfig.

**Logged but not surfaced:** raw malformed JSON, OpenRouter response IDs, retry attempts. Action logs only, for debug.

## Testing strategy

**1. Unit tests (`src/*.test.ts`, Jest, alongside Day 2-4 code)**

| Module | Cases |
|---|---|
| `config.test.ts` | merge: defaults only, add only, remove only, override only, all three combined, malformed yaml |
| `filters.test.ts` | drafts on/off, bots, `[skip-review]`, max_files boundary, glob ignore_paths |
| `context.test.ts` | all three present, all missing, partial, oversized files (4KB per-file / 12KB total truncation) |
| `schemas.test.ts` | Zod parse + reject on missing/extra/malformed fields |
| `prompts/*.test.ts` | snapshot tests on prompt builder output (catches accidental drift) |

Mocked: filesystem (memfs), Octokit, OpenRouter HTTP. Pure functions everywhere else.

**2. Integration tests (`src/index.test.ts`)**
- Mock Octokit + OpenRouter at HTTP layer (msw)
- Run `main()` end-to-end with a fake PR payload
- Assert: correct comments posted, summary text correct, exit 0

Cases: happy path, malformed reviewer JSON (soft), max_files exceeded, draft PR.

**3. Eval harness (`scripts/eval.ts`, Day 5.5)**
- Real OpenRouter calls, real models
- NOT in CI (LLM nondeterminism + cost). Manual via `npm run eval`.
- Run before tagging releases. Results → `scripts/eval-results.json` → README table.

**Coverage target:** unit + integration ≥ 80% lines. `index.ts` orchestration glue is hard to test cleanly — accept the gap.

**CI (`.github/workflows/ci.yml`):**
- `npm run lint && npm run typecheck && npm test && npm run build`
- `git diff --exit-code dist/` — fails if `dist/` not rebuilt before push (standard for typescript-action)

**Dogfood (Day 5):**
- Install evalpr on `evalpr` repo itself + 1 other public repo
- Open 2-3 synthetic PRs (real bugs, clean, mixed)
- Hand-eyeball → tune prompts → re-run eval → iterate

## Build plan (6 days)

### Day 1 — Scaffold
- `gh repo create farrellh1/evalpr --public --template actions/typescript-action --clone`
- Move into `~/Documents/evalpr/`
- Relocate this spec to `docs/superpowers/specs/2026-04-27-evalpr-design.md`
- Customize: TypeScript, ESLint, Prettier, ncc bundle to `dist/index.js`
- Write `action.yml` with locked inputs
- README skeleton (badges, status: 🚧 in development)
- `.gitignore` includes `.env.local`
- First commit: `feat: scaffold project structure`

### Day 2 — Reviewer pipeline + default principles
- `src/openrouter.ts` — OpenAI SDK pointed at OpenRouter base URL
- `prompts/default-principles.md` — 15-20 curated principles
- `src/prompts/reviewer.ts` — system prompt builder, injects principles + context
- `src/schemas.ts` — Zod schemas for everything
- `src/github.ts` — `fetchDiff()` via octokit `pulls.get` w/ diff Accept header
- `src/reviewer.ts` — call Sonnet, parse JSON, validate with Zod
- Tests: schemas, prompt snapshot, openrouter mock

### Day 3 — Grader + threshold filter
- `src/prompts/grader.ts` — grader system prompt
- `src/grader.ts` — per-comment Haiku call, `Promise.all` parallel
- `src/index.ts` (skeleton) — `filterByThreshold`, glue reviewer → grader → filter
- Tests: grader prompt snapshot, filter boundaries

### Day 4 — Lightweight RAG + filters + config reader
- `src/context.ts` — read CONVENTIONS/README/CONTRIBUTING from runner FS
- Inject into reviewer + grader prompts under "Project context"
- `src/config.ts` — read `.evalpr.yml`, merge with defaults
- `src/filters.ts` — drafts, bots, `[skip-review]`, `max_files`, ignore_paths globs (minimatch)
- Tests: config merge cases, filter cases, context loading

### Day 5 — Comment posting + dogfood
- `src/github.ts` — `postReview` (inline + summary via `pulls.createReview`)
- `src/index.ts` — final orchestrator wiring + error handling per spec
- ncc bundle, commit `dist/`
- Add evalpr to evalpr repo itself + 1 other public repo (workflow YAML + GitHub secret)
- Open synthetic PRs to trigger; tune prompts based on results
- Capture screenshots of best PR comments + summary

### Day 5.5 — Eval harness
- 10 fixture PRs (6 positive, 2 clean, 2 borderline)
- `scripts/eval.ts` runner
- `scripts/render-eval-readme.ts` for README table
- First eval run, tune weights/threshold based on results
- Commit `scripts/eval-results.json`

### Day 6 — Polish + portfolio bundle
- README final pass: hero gif, 3 screenshots, mermaid architecture diagram, eval table, "Used by" links, principles section, customization section
- Loom recording (60-90s)
- Pin `evalpr` to GitHub profile
- Tag `v0.1.0` release
- (Optional) Submit to GitHub Marketplace

## Scope-cut order (drop in this order if behind on Day 3+)

Pre-committed so there's no bikeshedding under pressure:

1. Lightweight RAG (CONVENTIONS context) — eval-graded alone is the moat
2. `.evalpr.yml` config reader (ship default principles only)
3. Inline comments (summary only)
4. Filters (drafts/bots/skip-tag — keep `max_files` always)
5. Blog post (publish week after launch)
6. 2nd dogfooded repo (1 is enough)
7. Eval harness fixtures: 10 → 5 (3 positive + 1 clean + 1 borderline). Never delete the harness entirely.

**Never cut (load-bearing):**
- Eval grader (the actual moat)
- Default principle pack
- Eval harness (≥ 5 fixtures + screenshot)
- README hero gif
- Loom
- 1 dogfooded PR with real comments

## Portfolio deliverables (Day 6)

- **README** — hero gif, install snippet, 3 screenshots, mermaid architecture, eval precision/recall table, "Used by" PRs, principles section, customization section, license
- **Loom (60-90s)** — script:
  - 0:00–0:10 problem ("AI reviewers post too much noise; teams want their own philosophy")
  - 0:10–0:30 install + trigger PR
  - 0:30–0:50 show comments posted; "5 shown, 12 hidden" line; show `.evalpr.yml` example
  - 0:50–1:00 README + repo CTA
- **Dogfood install on 2 public repos** with real PR links
- **Blog post (~700 words)** — *"Eval-graded AI code review: building evalpr in 6 days"* — dev.to + LinkedIn + Medium

## Open questions / future work (NOT v0.1.0)

- **Score weighting** — initial 0.40/0.25/0.20/0.15 is a guess. Eval harness will tune. v0.2 may make weights configurable.
- **Per-language principle packs** — currently one pack covers all stacks. v0.2 could ship `principles/typescript.md`, `principles/python.md`, etc., and auto-pick from repo contents.
- **Incremental review** — re-run only on touched files when synced. Deferred for cost simplicity.
- **Marketplace listing** — optional Day 6, can be done post-launch.
- **Anthropic SDK direct path** — current OpenRouter wrapper is one indirection. If costs/latency justify, swap to `@anthropic-ai/sdk` later. Trade-off: loses model-agnostic story.

## Definition of done

Day 6 OR all of:
- All Day 1–5.5 tasks shipped
- Eval table in README with real numbers
- Loom recorded + linked
- v0.1.0 tag pushed
- 1+ dogfood PR with retained findings visible

Whichever lands first.
