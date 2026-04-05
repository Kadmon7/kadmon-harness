---
description: Intelligent language-aware code review — detects language, routes to specialist reviewer, consolidates findings
agent: kody, typescript-reviewer, python-reviewer
skills: [coding-standards, receiving-code-review]
---

## Purpose
Smart code review that detects the language of changed files and routes to the appropriate specialist. Lighter than /checkpoint — skips verification (build, typecheck, tests, lint) and security/database reviewers. Use /checkpoint for the full quality gate, /kreview for a quick review-only pass.

## Arguments
- (none) — review staged changes (`git diff --staged`) or last commit (`git diff HEAD~1`)
- `<file-path>` — review a specific file

## Steps
1. Get diff: `git diff --staged` or `git diff HEAD~1`
2. Detect language of changed files:
   - TypeScript (.ts/.tsx/.js/.jsx) present -> invoke **typescript-reviewer** (sonnet)
   - Python (.py) present -> invoke **python-reviewer** (sonnet)
   - Both present -> both in parallel
   - Neither -> skip specialist, go directly to step 3
3. **kody** (sonnet) consolidates all findings with BLOCK / WARN / NOTE severity

## Output
Review report with severity-tagged items grouped by reviewer.

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
