---
description: Export instincts to JSON file for backup or sharing
---

## Purpose
Export all active instincts for the current project to a JSON file.

## Steps
1. Detect current project hash
2. Query SQLite for all instincts (all statuses) in this project
3. Serialize to JSON
4. Write to docs/instincts-export-[YYYY-MM-DD].json
5. Report file path and instinct count

## Output
File path + instinct count by status.