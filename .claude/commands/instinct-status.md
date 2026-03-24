---
description: Show current instinct dashboard for this project
---

## Purpose
Display all instincts grouped by status with confidence distribution.

## Steps
1. Detect current project hash
2. Query SQLite for all instincts in this project
3. Group by status: active, promoted, contradicted, archived
4. Show confidence distribution for active instincts
5. Highlight promotable instincts (confidence >= 0.7, occurrences >= 3)

## Output
Instinct dashboard table.

## Example
```
## Instincts: project abc123

### Active (5)
| Confidence | Occurrences | Pattern |
|-----------|------------|---------|
| 0.8       | 6          | Read before edit |
| 0.5       | 3          | Run tsc after TS edits |
| 0.3       | 1          | Use Zod for validation |

### Promoted (1)
- "Always run tests" → promoted to tdd-workflow skill

### Contradicted (1)
- "Skip lint on JSON" (2 contradictions vs 1 occurrence)
```