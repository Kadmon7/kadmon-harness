---
description: Manage instinct lifecycle — learn, promote, prune, or export
---

## Purpose
Unified instinct lifecycle management. Replaces the former `/learn`, `/promote`, `/prune`, and `/instinct-export` commands with a single entry point.

## Subcommands
- `/instinct learn` — Extract patterns from current session and create/reinforce instincts
- `/instinct promote` — Promote a high-confidence instinct to a skill (requires skill-creator plugin)
- `/instinct prune` — Archive weak or contradicted instincts
- `/instinct export` — Export all instincts to a JSON file for backup

## Steps per Subcommand

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
