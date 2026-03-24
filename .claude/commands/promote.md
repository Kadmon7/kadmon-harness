---
description: Promote a high-confidence instinct to a skill
---

## Purpose
Convert a well-validated instinct into a permanent skill file.

## Steps
1. List promotable instincts (confidence >= 0.7, occurrences >= 3, status: active)
2. User selects which instinct to promote
3. Generate skill markdown from instinct pattern and action
4. Save skill file to .claude/skills/[instinct-name].md
5. Mark instinct as promoted in SQLite with promotedTo field

## Output
New skill file path + instinct marked as promoted.