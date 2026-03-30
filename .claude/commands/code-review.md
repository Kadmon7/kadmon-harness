---
description: Run code review on staged or recent changes
---

## Purpose
Invoke review agents to check code quality, TypeScript patterns, and security.

## Steps
1. Get diff: `git diff --staged` or `git diff HEAD~1`
2. Invoke code-reviewer agent on the diff (includes TypeScript specialist checks for .ts/.tsx files)
3. For auth/crypto/input code: also invoke security-reviewer agent
4. Aggregate results by severity: BLOCK / WARN / NOTE
5. Report findings

## Output
Review report with severity-tagged items. BLOCK items must be fixed before merge.

## Example
```
## Code Review: 3 files changed

### BLOCK
- state-store.ts:85 — SQL string concatenation (injection risk). Use parameterized query.

### WARN
- utils.ts:12 — Missing return type annotation on exported function.

### NOTE
- session-manager.ts:30 — Consider extracting duration calculation to utility.

Summary: 1 BLOCK, 1 WARN, 1 NOTE — CHANGES REQUESTED
```