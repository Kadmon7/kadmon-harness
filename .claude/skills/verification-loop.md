---
name: verification-loop
description: Run build + typecheck + lint + tests in sequence after any code change. Use this skill whenever you finish implementing a feature, fix a bug, refactor code, or before running /checkpoint. Also use when the user says "verify", "check if it works", "run tests", or "does it compile". Stop at first failure — fix before proceeding. This is the safety net that catches type errors, lint violations, and regressions before they reach git.
---

# Verification Loop

Multi-step verification that catches issues before they reach production.

## When to Use
- After implementing any feature
- Before committing code
- When /verify command is invoked

## How It Works
Run in order. Stop at first failure.

1. **Build** — `npm run build`
2. **Typecheck** — `npx tsc --noEmit`
3. **Lint** — `npx eslint .`
4. **Unit tests** — `npx vitest run tests/lib/`
5. **Hook tests** — `npx vitest run tests/hooks/`
6. **Diff review** — `git diff`

## Rules
- Never skip steps — each catches different bug classes
- Fix failures before moving to the next step
- Run full loop before every commit

## no_context Application
The verification loop ensures no invented or incorrect code reaches the repository.