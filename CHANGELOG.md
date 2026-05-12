# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Rebuilt the committed `dist/` bundle so it matches the current lockfile and
  toolchain (it had drifted behind several dependency bumps).

### Removed

- `__fixtures__/wait.ts` and the `script/` directory — unused leftovers from the
  `actions/typescript-action` template.

## [0.1.0] — 2026-04-28

First eval-graded release. Two-LLM pipeline: a reviewer (Sonnet 4.6) writes
findings, a grader (Haiku 4.5) scores each one 0–100, and only comments above a
confidence threshold are posted.

### Added

- **Two-LLM review pipeline** — reviewer writes findings; grader scores them on
  confidence, specificity, calibration, and principle alignment; results are
  filtered at a configurable threshold (default **80**, best F1 on the eval
  set).
- **17 default principles across 7 categories** — correctness, security,
  readability, maintainability, performance, testing, project — curated from
  _The Pragmatic Programmer_, _A Philosophy of Software Design_, and _Software
  Engineering at Google_.
- **Per-repo configuration** via `.evalpr.yml` — add/remove principles, tune the
  confidence threshold, glob-ignore generated paths.
- **Lightweight RAG context** — pulls in `CONVENTIONS.md`, the project `README`,
  and `CONTRIBUTING.md` so the reviewer respects local conventions.
- **Published eval methodology** — 10 hand-authored fixtures across 6 languages
  with per-fixture answer keys; the runner sweeps 5 confidence thresholds and
  reports precision / recall / F1, and the README results table is regenerated
  on every eval run.
- PR-skip handling for drafts, bots, `[skip-review]` titles, and oversized PRs.

### Known limitations

- The reviewer sees only the PR diff, not the full repo file list, which caps
  recall at ~0.88 on the eval set.
- `confidence_threshold` is a single value across all categories.
- Fixtures are author-written rather than drawn from real merged PRs.

[Unreleased]: https://github.com/farrellh1/evalpr/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/farrellh1/evalpr/releases/tag/v0.1.0
