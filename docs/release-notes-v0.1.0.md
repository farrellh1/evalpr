# evalpr v0.1.0 — first eval-graded release

Eval-graded AI code review for GitHub PRs. Two-LLM pipeline: Sonnet 4.6 reviews,
Haiku 4.5 grades each finding 0–100, only high-confidence comments make it onto
the PR.

## Highlights

- **Two-LLM pipeline.** Reviewer (Sonnet 4.6) writes findings; grader (Haiku
  4.5) scores them on confidence, specificity, calibration, and principle
  alignment. Filter at a threshold; the rest are hidden.
- **17 default principles across 7 categories** — correctness, security,
  readability, maintainability, performance, testing, project. Curated from _The
  Pragmatic Programmer_, _A Philosophy of Software Design_, and _Software
  Engineering at Google_.
- **Per-repo configuration** via `.evalpr.yml` — add/remove principles, tune the
  confidence threshold, glob-ignore generated paths.
- **Lightweight RAG context** — pulls in `CONVENTIONS.md`, the project `README`,
  and `CONTRIBUTING.md` so the reviewer respects local idioms.
- **Published eval methodology.** 10 hand-authored fixtures, 6 languages, answer
  keys per fixture. Runner sweeps 5 confidence thresholds and reports precision
  / recall / F1. The README table is auto-generated and re-rendered on every
  eval run.

## Eval results (default threshold = 80)

| Metric    | Value |
| --------- | ----- |
| Precision | 0.78  |
| Recall    | 0.88  |
| F1        | 0.82  |

Recall ceiling is 0.88 because the v0.1 reviewer only sees the diff, not the
full repo file list — fix queued for v0.2.

## Install

```yaml
# .github/workflows/evalpr.yml
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: farrellh1/evalpr@v0.1.0
        with:
          api_key: ${{ secrets.OPENROUTER_API_KEY }}
```

## What's next

See the
[v0.2 roadmap in the README](https://github.com/farrellh1/evalpr#whats-next-v02).

## Live demo

[iron_cache#1](https://github.com/farrellh1/iron_cache/pull/1) — synthetic diff
with intentional issues. Reviewer caught the planted magic numbers plus two real
bugs I hadn't intended to plant.
