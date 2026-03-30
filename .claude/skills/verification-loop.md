---
name: verification-loop
description: Run build + typecheck + lint + tests in sequence after any code change or before any git commit/push. Use this skill whenever you finish implementing a feature, fix a bug, refactor code, before running /checkpoint, or before any commit or push. Also use when the user says "verify", "check if it works", "run tests", "does it compile", "commit this", "push it", or "checkpoint". Stop at first failure — fix before proceeding. This is the safety net that catches type errors, lint violations, and regressions before they reach git. A commit without verification is a gamble — this skill eliminates that risk.
---

# Verification Loop

Multi-step verification that catches issues before they reach production or git.

## When to Use
- After implementing any feature or fix
- Before committing or pushing code
- When /verify or /checkpoint is invoked
- After resolving merge conflicts
- Before creating a PR

## How It Works
Run in order. Stop at first failure.

1. **Build** — `npm run build`
2. **Typecheck** — `npx tsc --noEmit`
3. **Lint** — `npx eslint .`
4. **Unit tests** — `npx vitest run tests/lib/`
5. **Hook tests** — `npx vitest run tests/hooks/`
6. **Diff review** — `git diff`

## Git Commit Gate

A commit is a promise that the code works. The verification sequence above MUST pass before any git operation:

```bash
# All steps pass? -> safe to commit
git add <specific-files>
git commit -m "type(scope): description"
git push
```

Committing broken code and "fixing it in the next commit" creates noise in git history. The `block-no-verify` hook enforces this by blocking `--no-verify` flags on git commands.

The `/checkpoint` command automates this entire flow: verify -> review -> commit -> push. Use it instead of manual git commands when possible.

## Why Each Step Matters
- **Build** catches compilation errors and missing files
- **Typecheck** catches strict mode violations and type errors the build might miss
- **Lint** catches style violations and potential bugs
- **Tests** catch logic errors, regressions, and broken contracts
- **Diff review** confirms only intended changes are staged

## Automatic Detection
The `evaluate-session.js` hook tracks this pattern: Bash commands containing `vitest` or `tsc --noEmit` appearing before `git commit` or `git push`. When this cycle appears in a session, the pattern instinct is reinforced.

## Rules
- Never skip steps — each catches different bug classes
- Fix failures before moving to the next step
- Run full loop before every commit
- Skipping any step is like removing a link from a chain — the whole thing weakens

## no_context Application
The verification loop ensures no invented or incorrect code reaches the repository.