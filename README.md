# evalpr

> Eval-graded AI code review for your PRs.

![status](https://img.shields.io/badge/status-🚧%20in%20development-yellow)
![license](https://img.shields.io/github/license/farrellh1/evalpr)

Two-LLM pipeline: Sonnet 4.6 reviews, Haiku 4.5 grades, low-confidence comments
are hidden. Configurable principle set per repo via `.evalpr.yml`.

## Status

🚧 In active development. v0.1.0 target: 2026-05-04.

## Why

Most AI code reviewers post too much noise. evalpr grades its own output and
only posts comments above a confidence threshold — and you can tell it which
engineering principles to grade against.

## Install (preview — not yet released)

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

## Eval results

<!-- EVAL:START -->

_Eval results across 10 fixtures, anthropic/claude-sonnet-4.6 →
anthropic/claude-haiku-4.5, generated 2026-04-28._

| threshold | precision | recall |   F1 | findings/PR |
| --------: | --------: | -----: | ---: | ----------: |
|        50 |      0.58 |   0.88 | 0.70 |         1.2 |
|        60 |      0.58 |   0.88 | 0.70 |         1.2 |
|        70 |      0.58 |   0.88 | 0.70 |         1.2 |
|        80 |      0.78 |   0.88 | 0.82 |         0.9 |
|        90 |      1.00 |   0.50 | 0.67 |         0.4 |

<!-- EVAL:END -->

## Known limitations (v0.1.0)

- The `confidence_threshold` is a single number across all categories. Per-
  category thresholds (e.g. higher bar for `readability`, lower for `security`)
  are planned for v0.2.

## Development

Built with [Claude Code](https://claude.com/claude-code). Architectural
decisions and eval methodology come from me; Claude pairs on implementation.
Commits carry a `Co-Authored-By: Claude` trailer.

## License

MIT
