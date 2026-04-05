---
description: Save progress — full verification + intelligent review + commit and push
agent: code-reviewer, typescript-reviewer, python-reviewer, security-reviewer, database-reviewer
skills: [verification-loop, coding-standards, receiving-code-review, safety-guard]
---

## Purpose
All-in-one quality gate and commit. Runs mechanical checks, invokes language-aware reviewers in parallel, consolidates findings, and only commits if everything passes. Absorbs the former /kcheck pipeline.

## Steps

### Phase 1: Verification
1. Build: `npm run build`
2. Typecheck: `npx tsc --noEmit`
3. Run tests: `npx vitest run`
4. Lint: `npx eslint . --ext .ts,.js` (if configured)
5. Stop at first failure — report which step failed. Do NOT proceed.

### Phase 2: Intelligent Review (parallel)
1. Get diff: `git diff --staged` or `git diff HEAD~1`
2. Detect file types in diff
3. Launch reviewers **in parallel**:
   - TypeScript (.ts/.tsx/.js/.jsx) present -> invoke **typescript-reviewer** (sonnet)
   - Python (.py) present -> invoke **python-reviewer** (sonnet)
   - Both present -> both in parallel
   - **Always**: invoke **security-reviewer** (opus) in parallel
   - **Always**: invoke **database-reviewer** (opus) in parallel
4. **code-reviewer** (sonnet) consolidates all findings with BLOCK / WARN / NOTE severity

### Phase 3: Gate Decision
- **Any BLOCK findings** -> STOP. Report issues. Do NOT commit.
- **WARN only** -> report warnings, proceed to commit
- **NOTE only or clean** -> proceed to commit

### Phase 4: Commit and Push
1. `git add -A`
2. Ask user for commit description
3. Format as conventional commit: `feat|fix|docs|chore|refactor|test: description`
4. `git commit -m "type(scope): description"`
5. `git push`

## Output
Verification results + review summary + commit hash + push confirmation.

## Example
```
## Phase 1: Verification
Build:     PASS
Typecheck: PASS
Tests:     180 passing, 0 failing
Lint:      PASS

## Phase 2: Review (3 reviewers)
typescript-reviewer: 1 NOTE
security-reviewer:   0 issues
database-reviewer:   0 issues

## Phase 3: Gate
0 BLOCK, 0 WARN, 1 NOTE — APPROVED

## Phase 4: Commit
Commit: feat(instincts): add export functionality
Hash:   abc1234
Pushed: origin/main
```
