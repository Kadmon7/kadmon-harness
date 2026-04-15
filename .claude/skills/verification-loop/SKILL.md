---
name: verification-loop
description: Run build + typecheck + lint + tests in sequence after any code change or before any git commit/push. Use this skill whenever you finish implementing a feature, fix a bug, refactor code, before running /chekpoint, or before any commit or push. Also use when the user says "verify", "check if it works", "run tests", "does it compile", "commit this", "push it", or "checkpoint". Stop at first failure — fix before proceeding. This is the safety net that catches type errors, lint violations, and regressions before they reach git. A commit without verification is a gamble — this skill eliminates that risk.
---

# Verification Loop

Multi-step verification that catches issues before they reach production or git. Each step targets a different class of defect, and the order matters because later steps depend on earlier ones succeeding.

## When to Use
- After implementing any feature or fix
- Before committing or pushing code
- When /chekpoint is invoked (includes full verification + review)
- After resolving merge conflicts
- Before creating a PR
- After any refactoring, even "safe" renames (they break imports more often than you think)

## How It Works
Run in order. Stop at first failure. Fix, then restart from that step.

1. **Build** — `npm run build`
2. **Typecheck** — `npx tsc --noEmit`
3. **Lint** — `npx eslint .`
4. **Unit tests** — `npx vitest run tests/lib/`
5. **Hook tests** — `npx vitest run tests/hooks/`
6. **Diff review** — `git diff`

## Why This Order Matters
- **Build first** because typecheck and tests import compiled output. Running tests on stale dist/ gives false results.
- **Typecheck before lint** because type errors often cause cascading lint failures (unused variables from broken imports). Fix types first, and many lint issues disappear.
- **Tests after lint** because running a 2-minute test suite only to discover a syntax error wastes time.
- **Diff review last** because you want to confirm the final state of all changes, including any fixes made during the loop.

## Failure Recovery
When a step fails, diagnose systematically before retrying.

| Step | Common Causes | Recovery |
|------|--------------|----------|
| Build | Missing import, deleted file, circular dependency | Check recent renames with `git diff --name-status`. Verify import paths use `.js` extension. |
| Typecheck | Type mismatch, strict mode violation, missing return type | Read the exact error line. Fix the type, do not cast with `as` unless justified. |
| Lint | Unused variable, style violation, console.log in production | Fix lint issues after types are clean. The post-edit-format hook auto-formats on save. |
| Unit tests | Logic error, stale mock, missing test fixture | Read the full test output. Check if the test or the code is wrong — fix the code first. |
| Hook tests | stdin parsing error, exit code mismatch | Run the hook manually: `echo '{}' | node .claude/hooks/scripts/hook-name.js` |

## Partial Verification
During active development, run focused checks to get fast feedback. Save the full loop for pre-commit.

```bash
# Run a single test file during development
npx vitest run tests/lib/instinct-manager.test.ts

# Typecheck only (faster than full build)
npx tsc --noEmit

# Run only hook tests after editing a hook
npx vitest run tests/hooks/
```

Partial verification speeds up the red-green-refactor cycle. But ALWAYS run the full loop before any git operation.

## When to Skip Steps
Almost never. But there are narrow exceptions:
- **Doc-only changes** (*.md files): skip lint and tests, but still review the diff
- **Config changes** (settings.json, tsconfig.json): skip tests but run build + typecheck to verify config is valid
- **NEVER skip tests** for any .ts or .js change, no matter how trivial the edit seems

## Git Commit Gate

A commit is a promise that the code works. The verification sequence above MUST pass before any git operation:

```bash
# All steps pass? -> safe to commit
git add <specific-files>
git commit -m "type(scope): description"
git push
```

Committing broken code and "fixing it in the next commit" creates noise in git history. The `block-no-verify` hook enforces this by blocking `--no-verify` flags on git commands.

The `/chekpoint` command automates this entire flow: verify -> review -> commit -> push. Use it instead of manual git commands when possible.

## Anti-Patterns
- **Committing without verifying** — "It's a small change, it'll be fine." Small changes break builds. The verification loop exists precisely for this overconfidence.
- **Fixing lint before fixing types** — Lint errors caused by type failures disappear when types are fixed. Fix in order.
- **Running tests before building** — Tests import from dist/. Stale dist/ means tests validate old code, not your changes.
- **Skipping diff review** — Accidentally staged files, leftover debug code, and unintended changes only show up in the diff.
- **Re-running the whole loop after fixing one step** — Restart from the failed step, not from the beginning. Build does not need to re-run if you only fixed a type error.

## Integration

This is a **command-level skill** — it has no agent owner on purpose. `/chekpoint` loads it directly in Phase 1 (verify) before handing off to the review agents. Delegating verification to a single agent would add unnecessary indirection: the build/typecheck/lint/test loop is deterministic and belongs to the command, not to any reviewer.

- **/chekpoint** command loads this skill as Phase 1 (verify), then Phase 2 (parallel reviewers), then commits. The skill defines the sequence; the command executes it.
- **mekanik** agent handles failures in the build and typecheck steps — delegated only when a step fails, not as the verification driver
- **post-edit-typecheck** hook runs a quick typecheck after every Edit/Write as early warning — same sequence, smaller scope
- **session-end-all** hook (pattern evaluation phase) tracks this pattern: Bash commands containing `vitest` or `tsc --noEmit` before `git commit` or `git push`

If you are auditing the skill catalog and find `verification-loop` has zero agents in its `skills:` frontmatter fields, that is by design — not a routing bug.

## Rules
- Never skip steps — each catches a different bug class
- Fix failures before moving to the next step
- Run the full loop before every commit
- Use partial verification during development for speed, full loop for commits
- Skipping any step is like removing a link from a chain — the whole thing weakens

## no_context Application
The verification loop ensures no invented or incorrect code reaches the repository. Each step independently validates that the code does what it claims. If you cannot verify it, you cannot commit it.
