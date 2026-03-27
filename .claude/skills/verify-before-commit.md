---
name: verify-before-commit
description: Run build + typecheck + tests before any git commit or push. Use this skill whenever you're about to commit code, push to remote, create a PR, or resolve merge conflicts. Also applies when the user says "commit this", "push it", "checkpoint", or any variation of saving work to git. A commit without verification is a gamble — this skill eliminates that risk. Complements verification-loop (post-implementation checks) with the specific git commit/push gate.
---

# Verify Before Commit

A commit is a promise that the code works. Breaking that promise wastes everyone's time — yours debugging, the CI pipeline running, and your teammates reviewing broken code. This skill ensures every commit is backed by evidence: the build succeeded, types check out, and tests pass.

## The Verification Sequence

```bash
npm run build          # 1. Compile TypeScript, copy assets
npx tsc --noEmit       # 2. Verify types without emitting files
npx vitest run         # 3. Run full test suite
# All 3 pass? → safe to commit
git add <specific-files>
git commit -m "type(scope): description"
git push
```

Stop at the first failure. Fix the issue before retrying — committing broken code and "fixing it in the next commit" creates noise in git history and can break other people's work.

## Why Each Step Matters

- **Build** catches compilation errors and missing files before they reach the repo
- **Typecheck** catches type errors that the build might miss (strict mode violations, unused variables)
- **Tests** catch logic errors, regressions, and broken contracts between modules

Skipping any step is like removing a link from a chain — the whole thing weakens. The `block-no-verify` hook enforces this by blocking `--no-verify` flags on git commands, because bypassing pre-commit hooks silently disables the safety net.

## Shortcut

The `/checkpoint` command automates this entire flow: verify → review → commit → push. Use it instead of manual git commands when possible.

## Automatic Detection

The `evaluate-session.js` hook tracks this pattern: Bash commands containing `vitest` or `tsc --noEmit` appearing before `git commit` or `git push`. When this cycle appears at least once in a session, the pattern instinct is reinforced.
