---
description: Promote a high-confidence instinct to a skill
---

## Purpose
Convert a well-validated instinct into a permanent skill file.

## Steps
1. List promotable instincts (confidence >= 0.7, occurrences >= 3, status: active)
2. User selects which instinct to promote
3. Invoke skill-creator:skill-creator plugin to generate and optimize the skill
4. Save skill file to .claude/skills/[instinct-name].md
5. Optimize description for auto-triggering via skill-creator
6. Mark instinct as promoted in SQLite with promotedTo field

## Output
New skill file path + instinct marked as promoted.