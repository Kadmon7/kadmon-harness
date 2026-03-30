---
description: Show instinct dashboard with status and quality evaluation
---

## Purpose
Display all instincts grouped by status with confidence distribution and quality assessment. Combines the former `/instinct-status` and `/learn-eval` into one view.

## Arguments
- (none) — show instinct dashboard grouped by status
- `eval` — also evaluate quality and recommend promote/keep/prune for each

## Steps
1. Detect current project hash
2. Query SQLite for all instincts in this project
3. Group by status: active, promoted, contradicted, archived
4. Show confidence distribution for active instincts
5. Highlight promotable instincts (confidence >= 0.7, occurrences >= 3)
6. **[eval only]** For each instinct: check confidence, occurrences, contradictions
7. **[eval only]** Flag: low confidence (<0.3), high contradictions, stale (no recent sessions)
8. **[eval only]** Recommend: promote, keep, or prune each instinct

## Output
Instinct dashboard table with optional quality recommendations.

## Example
```
## Instincts: project abc123

### Active (5)
| Confidence | Occurrences | Pattern | Recommendation |
|-----------|------------|---------|---------------|
| 0.9       | 12         | Read before edit | PROMOTE |
| 0.8       | 6          | Run tsc after TS edits | PROMOTE |
| 0.3       | 1          | Use Zod for validation | KEEP |

### Promoted (1)
- "Always run tests" -> promoted to tdd-workflow skill

### Contradicted (1)
- "Skip lint on JSON" (2 contradictions vs 1 occurrence) -> PRUNE
```
