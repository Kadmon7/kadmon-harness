---
description: Sync CLAUDE.md, README, and docs with recent code changes
---

## Purpose
Keep documentation in sync with code after implementation changes.

## Steps
1. Invoke doc-updater agent (sonnet)
2. Scan recent git commits for structural changes
3. Update CLAUDE.md: agent table, command table, status, component counts
4. Update README.md: architecture section, component counts
5. Commit documentation updates separately from code

## Output
List of docs updated + commit hash.