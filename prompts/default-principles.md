# evalpr default principle pack

Curated from durable engineering literature. **The runtime source of truth is
`src/default-principles.ts`.** This file exists for human curation and
explanation only.

## Sources drawn from

- _The Pragmatic Programmer_ — Hunt & Thomas (DRY, orthogonality, broken
  windows)
- _A Philosophy of Software Design_ — Ousterhout (deep modules, complexity
  isolation)
- _Software Engineering at Google_ — Winters/Manshreck/Wright (real tradeoffs,
  scale realities)
- _Effective TypeScript_ — Vanderkam (stack-specific, evidence-based)
- _Clean Code_ — Martin (selectively, naming + clarity philosophy only)

## Avoid baking in

- Strict line-count / function-length rules (creates noise, dated)
- "No comments ever" dogma
- Dogmatic OOP fragmentation
- Citing "Clean Code Ch. X" verbatim — smug + dated

## Categories (17 principles total)

| Category        | Count | Concerns                                         |
| --------------- | ----- | ------------------------------------------------ |
| correctness     | 3     | null/undefined, error propagation, off-by-one    |
| security        | 3     | input validation, injection, secrets             |
| readability     | 3     | naming, intent over cleverness, function purpose |
| maintainability | 3     | DRY, orthogonality, deep modules                 |
| performance     | 2     | quadratic hotspots, blocking IO in async         |
| testing         | 2     | testability, critical-path coverage              |
| project         | 1     | match existing conventions                       |

See `src/default-principles.ts` for the typed list.
