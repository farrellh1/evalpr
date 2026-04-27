import type { Principle } from './types.js'

export const defaultPrinciples: Principle[] = [
  // correctness (3)
  {
    id: 'null-undefined-handling',
    severity: 'warning',
    category: 'correctness',
    description:
      'Guard against null/undefined before accessing properties or invoking methods on values that can be absent.'
  },
  {
    id: 'error-propagation',
    severity: 'warning',
    category: 'correctness',
    description:
      'Errors should propagate to a clear handler. Silent catches that swallow errors hide bugs and complicate debugging.'
  },
  {
    id: 'off-by-one',
    severity: 'warning',
    category: 'correctness',
    description:
      'Loop and slice bounds should be checked for off-by-one and inclusive/exclusive mismatches, especially around array and date arithmetic.'
  },

  // security (3)
  {
    id: 'input-validation',
    severity: 'error',
    category: 'security',
    description:
      'Validate untrusted input at trust boundaries. Reject or coerce explicitly; never assume shape from upstream.'
  },
  {
    id: 'injection-risk',
    severity: 'error',
    category: 'security',
    description:
      'Avoid string-concatenated SQL, shell, HTML, or template input. Use parameterized APIs or escape at the boundary.'
  },
  {
    id: 'secrets-exposure',
    severity: 'error',
    category: 'security',
    description:
      'Do not log, commit, or transmit secrets, tokens, or PII. Read from env/secret stores; redact in logs.'
  },

  // readability (3)
  {
    id: 'naming-clarity',
    severity: 'suggestion',
    category: 'readability',
    description:
      'Names reveal intent. Single-letter names are acceptable only in tight, conventional scopes (loop indices, math).'
  },
  {
    id: 'intent-over-cleverness',
    severity: 'suggestion',
    category: 'readability',
    description:
      'Prefer the obvious form over a clever one. Optimize for the next reader, not for compactness.'
  },
  {
    id: 'function-purpose-obvious',
    severity: 'suggestion',
    category: 'readability',
    description:
      "A function's name plus its first few lines should make its purpose obvious. If a comment is needed to explain what the function does at a high level, the name or shape is wrong."
  },

  // maintainability (3)
  {
    id: 'dry-with-sense',
    severity: 'suggestion',
    category: 'maintainability',
    description:
      'Eliminate true duplication of logic — but only when the duplicates would change together. Coincidental similarity is not duplication.'
  },
  {
    id: 'orthogonality',
    severity: 'warning',
    category: 'maintainability',
    description:
      'Modules should change for one reason. Coupling unrelated concerns into one unit makes change risky.'
  },
  {
    id: 'deep-modules',
    severity: 'suggestion',
    category: 'maintainability',
    description:
      'Prefer modules with simple interfaces and powerful implementations over many small shallow modules whose interfaces are nearly as large as their bodies.'
  },

  // performance (2)
  {
    id: 'obvious-quadratic',
    severity: 'warning',
    category: 'performance',
    description:
      'Flag nested loops over the same large input that could be reduced with a hash, set, or single pass. Only when the input size is plausibly large.'
  },
  {
    id: 'blocking-io-in-async',
    severity: 'warning',
    category: 'performance',
    description:
      'Sync filesystem, network, or CPU-heavy work in an async path blocks the event loop. Use async APIs or move work off-thread.'
  },

  // testing (2)
  {
    id: 'testability',
    severity: 'suggestion',
    category: 'testing',
    description:
      'Code that is hard to test usually has hidden coupling. Pure functions and injected dependencies are easier to test and easier to change.'
  },
  {
    id: 'untested-critical-path',
    severity: 'warning',
    category: 'testing',
    description:
      'Branches handling money, auth, security, or data integrity should have explicit test coverage.'
  },

  // project (1)
  {
    id: 'match-existing-conventions',
    severity: 'suggestion',
    category: 'project',
    description:
      'Where the project already establishes a pattern (naming, error handling, module layout), follow it. Inconsistency is its own cost.'
  }
]
