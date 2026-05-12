# Contributing to evalpr

Thanks for taking the time to contribute. This is a small project; issues and
PRs are both welcome.

## Getting started

Requires Node `>=24` (see `.node-version`).

```bash
npm ci
npm test            # jest
npm run lint        # eslint
npm run format:check # prettier
```

Run everything the way CI does:

```bash
npm run all         # format, lint, test, coverage, package
```

## The `dist/` rule

This is a GitHub Action, so the bundled output in `dist/` is committed to the
repo and must stay in sync with `src/`. **Any PR that changes `src/` (or a
runtime dependency) must rebuild and commit `dist/`:**

```bash
npm run package
git add dist
```

CI fails if `dist/` is out of date — this is by design.

## Running the eval

The reviewer/grader quality is measured against fixtures in `fixtures/`:

```bash
npm run eval          # sweep thresholds, write scripts/eval-results.json
npm run eval:render   # regenerate the results table in README.md
```

If you change a prompt or the matcher, re-run both and include the updated
README table in your PR.

## Pull requests

- Keep the diff focused; one concern per PR.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit
  messages (`feat:`, `fix:`, `chore:`, `docs:` …).
- Make sure `npm run all` is clean before opening the PR.
- New behavior should come with tests and, where it affects review quality, a
  fixture.

## Reporting issues

Open an issue with a minimal repro — for review-quality problems, the smallest
diff that triggers the bad (or missing) comment is ideal.
