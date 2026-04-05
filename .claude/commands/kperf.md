---
description: Analyze and optimize code performance — O(n^2) loops, slow queries, memory patterns, hook latency
agent: arkonte
skills: [context-budget]
---

## Purpose
Invoke arkonte agent to analyze code for performance issues and suggest optimizations. Covers Node.js, TypeScript, React, database queries, and hook latency.

## Arguments
- (none) — analyze recently modified files
- `<file-path>` — analyze a specific file
- `hooks` — analyze hook latency against budgets (observe: 50ms, no-context-guard: 100ms, others: 500ms)

## Steps
1. Invoke **arkonte agent** (sonnet) on specified target
2. Agent profiles and scans for:
   - O(n^2) or worse algorithmic complexity
   - Slow or unindexed database queries
   - Memory-intensive patterns (large allocations, leaks)
   - Unnecessary allocations or copies
   - Blocking operations in async paths
3. For `hooks` argument: benchmark each hook against latency budget
4. Propose optimizations with expected impact
5. If changes approved by user: apply and benchmark before/after

## Output
Performance report with findings, severity, and proposed optimizations.

## Example
```
## Performance Analysis: scripts/lib/state-store.ts

### HIGH
- Line 45: O(n^2) loop scanning all instincts on every query
  Suggested: Add index on confidence column, use WHERE clause

### MEDIUM
- Line 120: Synchronous file read in async function
  Suggested: Use fs.promises.readFile

### Hook Latency (if hooks mode)
| Hook | Budget | Actual | Status |
|------|--------|--------|--------|
| observe-pre | 50ms | 12ms | OK |
| no-context-guard | 100ms | 45ms | OK |
| post-edit-typecheck | 500ms | 620ms | OVER |
```
