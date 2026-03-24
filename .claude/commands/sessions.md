---
description: Show recent session history for the current project
---

## Purpose
Display past sessions with dates, branches, tasks, and costs.

## Steps
1. Detect current project hash
2. Query SQLite for last 10 sessions
3. Format as markdown table with: date, branch, tasks, files modified, cost

## Output
Session history table.

## Example
```
| Date       | Branch | Tasks               | Files | Cost   |
|-----------|--------|---------------------|-------|--------|
| 2026-03-24 | main   | implement hooks     | 17    | $2.45  |
| 2026-03-24 | main   | core library        | 7     | $1.82  |
| 2026-03-23 | main   | scaffold            | 117   | $3.10  |
```