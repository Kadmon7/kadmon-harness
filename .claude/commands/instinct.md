---
description: Manage instinct lifecycle — status, eval, learn, promote, prune, or export
skills: [continuous-learning-v2]
---

## Purpose
Unified instinct lifecycle management. View status, evaluate quality, learn patterns, promote to skills, prune weak instincts, and export backups — all from one command.

## Arguments
- (none) or `status` — show instinct dashboard grouped by status (default)
- `eval` — show dashboard with quality recommendations (promote/keep/prune per instinct)
- `learn` — extract patterns from current session and create/reinforce instincts
- `promote` — promote a high-confidence instinct to a skill (requires skill-creator plugin)
- `prune` — archive weak or contradicted instincts
- `export` — export all instincts to a JSON file for backup

## Steps per Subcommand

### status (default)
1. Detect current project hash
2. Query SQLite for all instincts in this project
3. Group by status: active, promoted, contradicted, archived
4. Show confidence distribution for active instincts
5. Highlight promotable instincts (confidence >= 0.7, occurrences >= 3)

### eval
1. Run all status steps above
2. For each instinct: check confidence, occurrences, contradictions
3. Flag: low confidence (<0.3), high contradictions, stale (no recent sessions)
4. Recommend: promote, keep, or prune each instinct

### learn
1. Read observations JSONL for current session from temp directory
2. Identify recurring patterns (e.g., "always reads before editing")
3. For each pattern found:
   - Check if similar instinct already exists
   - If exists: reinforce (increase confidence)
   - If new: create instinct (confidence: 0.3)
4. Show instincts created/updated with confidence scores

### promote
1. Query SQLite for promotable instincts (confidence >= 0.7, occurrences >= 3)
2. Show candidates and let user select which to promote
3. Use skill-creator:skill-creator plugin to create the skill from the instinct
4. Mark instinct as promoted in SQLite

### prune
1. Query SQLite for prunable instincts:
   - Contradicted instincts older than 7 days
   - Low confidence (<0.2) with fewer than 2 occurrences
2. Archive matching instincts
3. Report count archived and reasons

### export
1. Query SQLite for all instincts in current project
2. Serialize to JSON with metadata (project hash, date, counts)
3. Write to file (default: `instincts-export-{date}.json`)
4. Report count and file path

## Example
```
> /instinct
## Instincts: project 9444ca5b

### Active (5)
| Confidence | Occurrences | Pattern |
|-----------|------------|---------|
| 0.9       | 12         | Read before edit |
| 0.9       | 14         | Build after editing TypeScript |
| 0.3       | 1          | Use Zod for validation |

### Promoted (1)
- "Always run tests" -> promoted to tdd-workflow skill

> /instinct eval
### Active (5) — with recommendations
| Confidence | Occurrences | Pattern | Recommendation |
|-----------|------------|---------|---------------|
| 0.9       | 12         | Read before edit | PROMOTE |
| 0.9       | 14         | Build after editing TypeScript | PROMOTE |
| 0.3       | 1          | Use Zod for validation | KEEP |

> /instinct learn
Instincts updated:
- [0.5] "Read files before editing" -> reinforced (+0.1)
- [0.3] "Run tsc after TypeScript edits" -> NEW
Total: 1 reinforced, 1 created

> /instinct promote
Promotable instincts:
1. [0.9] "Read files before editing" (27 occurrences)
2. [0.9] "Build after editing TypeScript" (23 occurrences)
Select instinct to promote: 1
-> Invoking skill-creator...

> /instinct prune
Archived 2 instincts:
- "Skip lint on JSON" (contradicted, 2 contradictions)
- "Use semicolons" (low confidence 0.1, 1 occurrence)

> /instinct export
Exported 10 instincts to instincts-export-2026-03-30.json
```
