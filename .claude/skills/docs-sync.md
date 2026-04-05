---
name: docs-sync
description: Documentation synchronization principles — 4-layer model (public docs, rules, commands, skills), behavior-over-counts philosophy, staleness detection, and verification checklists. Use when updating documentation after code changes.
---

# Documentation Synchronization

Principles for keeping all documentation layers accurate and in sync with code behavior. This skill teaches the methodology; doktor agent executes the workflow.

## When to Use

- After commits that add features, change behavior, or modify structure
- When any agent needs to update documentation
- During /kdocs or /checkpoint workflows
- When reviewing documentation accuracy

## The 4-Layer Documentation Model

Every behavioral change must be reflected across all relevant layers:

| Layer | Files | What to Check |
|-------|-------|---------------|
| **1. Public Docs** | CLAUDE.md, README.md | Component counts, feature descriptions, status line |
| **2. Rules** | .claude/rules/**/*.md | Hook catalog descriptions, agent triggers, enforcement rules |
| **3. Commands** | .claude/commands/*.md | Workflow steps, agent chains, skill references |
| **4. Skills** | .claude/skills/*.md | Integration sections, hook references, API descriptions |

## Core Principle: Behavior Over Counts

**Counts are easy. Descriptions are hard. Prioritize descriptions.**

A hook that changed behavior but kept the same name needs a description update, not just a count check. Examples:

- Hook went from "logs tool results" to "logs tool results AND captures error messages" -- the description must change even though the hook count didn't
- Agent gained a new skill -- the catalog table needs the skill name, not just "+1"
- Command workflow added a new step -- the step must be documented, not just the step count

## Ground Truth Extraction

Never trust memory or cached counts. Always verify from the filesystem:

```bash
ls .claude/agents/*.md | wc -l       # agent count
ls .claude/skills/*.md | wc -l       # skill count
ls .claude/commands/*.md | wc -l     # command count
ls .claude/hooks/scripts/*.js | wc -l # hook script count
ls .claude/rules/**/*.md | wc -l     # rule count
npx vitest run 2>&1 | tail -5        # test count
```

## Staleness Detection

### Finding What Changed

```bash
git log --oneline -10          # recent commits
git diff HEAD~N --stat         # changed files
git diff HEAD~N -- .claude/    # harness changes
```

For each changed file, answer:
1. What did it do BEFORE?
2. What does it do NOW?
3. Is this behavioral change documented anywhere?

### Cross-Reference Check

```bash
# Find stale references
grep -rn "hook_name" .claude/rules/ .claude/skills/
# Compare with actual hook code
cat .claude/hooks/scripts/hook_name.js
```

## Verification Checklist

After making documentation updates, verify ALL of these:

- [ ] **Feature coverage** -- each behavioral change documented in at least 2 layers
- [ ] **Stale references** -- no documentation references deleted/renamed components
- [ ] **Rules sync** -- hook descriptions in rules match actual hook behavior
- [ ] **Skills sync** -- skills referencing hooks/APIs describe current behavior
- [ ] **Counts match** -- documented counts equal filesystem counts
- [ ] **Status line** -- version number reflects the nature of the change

## Anti-Patterns

| Anti-Pattern | Why It's Wrong |
|---|---|
| Updating counts but not descriptions | Counts tell you how many; descriptions tell you what they do |
| Only updating CLAUDE.md | Rules and skills are loaded every session too |
| Trusting memory for current state | Files may have changed since you last read them |
| Stopping after Layer 1 | Layers 2-4 are where Claude actually reads the documentation |
| Documenting "planned" features as if they exist | Misleads future sessions into assuming capabilities |

## Language Preservation

- English files stay English (CLAUDE.md, README.md, rules, skills, commands)
- Spanish files stay Spanish (if any)
- Never mix languages within a single file

## Integration

- **Agent**: doktor (primary executor of this methodology)
- **Command**: /kdocs (triggers doktor with this skill)
- **Also useful for**: any agent that needs to update documentation as a side effect

## no_context Application

Generate documentation from code, not from assumptions. Read the actual source before writing descriptions. If a component is referenced but cannot be found on disk, flag it and remove the reference rather than guessing what it might do.
