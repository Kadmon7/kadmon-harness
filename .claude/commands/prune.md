---
description: Archive weak or contradicted instincts
---

## Purpose
Clean up instincts that are no longer valid or have been contradicted.

## Steps
1. Invoke pruneInstincts() from instinct-manager
2. Archives: contradicted instincts older than 7 days
3. Archives: active instincts with confidence < 0.2 and occurrences < 2
4. Show what was archived and why

## Output
Count of archived instincts with reasons.

## Example
```
Pruned 3 instincts:
- "Skip type annotations" — contradicted (3 contradictions vs 1 occurrence)
- "Use var for loops" — low confidence (0.1, 1 occurrence)
- "Ignore lint warnings" — contradicted (5 contradictions vs 2 occurrences)
```