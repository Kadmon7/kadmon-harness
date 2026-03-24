---
name: verification-loop
description: Use after implementing any change to verify it works correctly end-to-end
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