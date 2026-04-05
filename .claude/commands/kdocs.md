---
description: Sync ALL project documentation with recent code changes — docs, rules, commands, skills
agent: doktor
---

## Purpose
Keep all 4 layers of documentation in sync with code after implementation changes. Not just counts — behavioral descriptions must match what the code actually does. Absorbs the former /update-docs with K-naming convention.

## Steps
1. Invoke **doktor agent** (opus)
2. Scan recent git commits for behavioral AND structural changes
3. **Layer 1 — Public docs**: Update CLAUDE.md, README.md
4. **Layer 2 — Rules**: Update .claude/rules/common/hooks.md, agents.md, development-workflow.md if affected
5. **Layer 3 — Commands**: Update command .md files if their workflows changed
6. **Layer 4 — Skills**: Check skills that reference changed hooks/features
7. Self-verify: grep for feature keywords, check for stale references, validate counts
8. Commit documentation updates separately from code

## Output
List of docs updated across all layers + verification results + commit hash.
