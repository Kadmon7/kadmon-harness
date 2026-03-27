---
name: verify-before-commit
description: Use before any git commit or push — run vitest and tsc to ensure code is correct before persisting
---

# Verify Before Commit

Never commit or push without running verification first. Tests and typecheck must pass before code enters the repository.

Promoted from instinct: confidence 0.9, 11 occurrences across sessions.

## When to Use
- Before every `git commit`
- Before every `git push`
- Before creating a PR
- After resolving merge conflicts

## How It Works
1. **Build**: `npm run build` — compile TypeScript, copy assets
2. **Typecheck**: `npx tsc --noEmit` — verify types without emitting
3. **Test**: `npx vitest run` — run full test suite
4. **Then commit**: only if all 3 pass

```bash
npm run build && npx tsc --noEmit && npx vitest run
# If all pass → safe to commit
git add <files>
git commit -m "type(scope): description"
git push
```

## Rules
- NEVER use `--no-verify` to skip pre-commit hooks (enforced by block-no-verify hook)
- If tests fail, fix the issue BEFORE committing — do not commit broken code
- The /checkpoint command automates this flow: verify → commit → push

## Relationship to Other Skills
- **verification-loop** — covers the full verify pipeline after implementation. This skill is specifically about the commit/push gate
- **tdd-workflow** — ensures tests exist before code. This skill ensures they PASS before code is committed
- **/checkpoint command** — the automated version of this pattern

## Detection
The `evaluate-session.js` hook detects this pattern automatically: Bash commands containing vitest/tsc appearing before git commit/push. Threshold: >= 1 cycle per session.
