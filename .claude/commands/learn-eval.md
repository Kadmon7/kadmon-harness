---
description: Evaluate quality of learned instincts
---

## Purpose
Review active instincts for the current project and assess their quality and validity.

## Steps
1. Query SQLite for all active instincts in current project
2. For each instinct: check confidence, occurrences, contradictions
3. Flag: low confidence (<0.3), high contradictions, stale (no recent sessions)
4. Recommend: promote, keep, or prune each instinct

## Output
Instinct quality report with recommendations.