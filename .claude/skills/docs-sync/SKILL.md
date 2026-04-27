---
name: docs-sync
description: Documentation synchronization principles — 3-layer model (public docs, commands, skills+agents), behavior-over-counts philosophy, staleness detection, and verification checklists. Rules are out of scope per ADR-032 Amendment 2026-04-26 (hand-curated via ADR, surfaced as read-only NOTEs). Use this skill whenever updating documentation after a commit that adds features, changes behavior, or modifies structure; whenever running /doks or /chekpoint with docs in the diff; when the user says "update docs", "sync docs", "docs are stale", "drift", "counts don't match", or "descriptions are outdated"; and after adding/removing agents, skills, commands, or hooks. The skill enforces description-over-count discipline: matching counts is the easy part, but descriptions drift silently and mislead future sessions — that's what this skill catches.
---

# Documentation Synchronization

Principles for keeping all documentation layers accurate and in sync with code behavior. This skill teaches the methodology; doks agent executes the workflow.

## When to Use

- After commits that add features, change behavior, or modify structure
- When any agent needs to update documentation
- During /doks or /chekpoint workflows
- When reviewing documentation accuracy

## The 3-Layer Documentation Model

Every behavioral change must be reflected across all relevant layers. Rules (`.claude/rules/`) are explicitly out of scope — they are hand-curated operational logic updated via deliberate ADR, not via diff-driven sync (Amendment 2026-04-26 to ADR-032; rationale in `docs/research/research-008-auto-loaded-rules-vs-on-demand-skills.md`).

| Layer | Files | What to Check |
|-------|-------|---------------|
| **1. Public Docs** | CLAUDE.md, README.md | Component counts, feature descriptions, status line |
| **2. Commands** | .claude/commands/*.md | Workflow steps, agent chains, skill references |
| **3. Skills + Agents** | .claude/skills/*/SKILL.md, .claude/agents/*.md | Integration sections, hook references, API descriptions |
| _Rules (read-only)_ | .claude/rules/**/*.md | NEVER edited by /doks. If a behavioral change implies a rule update, surface as a NOTE in output and stop. |

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
# Find stale references in writable layers
grep -rn "hook_name" .claude/skills/ .claude/agents/ .claude/commands/
# Read-only check: surface a NOTE if rules mention the changed component
grep -rn "hook_name" .claude/rules/
# Compare with actual hook code
cat .claude/hooks/scripts/hook_name.js
```

## Verification Checklist

After making documentation updates, verify ALL of these:

- [ ] **Feature coverage** -- each behavioral change documented in at least 2 layers
- [ ] **Stale references** -- no documentation references deleted/renamed components
- [ ] **Rules surface check (read-only)** -- if a rule mentions a changed component, append a NOTE to output for manual ADR follow-up. Never edit rule files.
- [ ] **Skills sync** -- skills referencing hooks/APIs describe current behavior
- [ ] **Counts match** -- documented counts equal filesystem counts
- [ ] **Status line** -- version number reflects the nature of the change

## Anti-Patterns

| Anti-Pattern | Why It's Wrong |
|---|---|
| Updating counts but not descriptions | Counts tell you how many; descriptions tell you what they do |
| Only updating CLAUDE.md | Rules and skills are loaded every session too |
| Trusting memory for current state | Files may have changed since you last read them |
| Stopping after Layer 1 | Layers 2-3 are where Claude actually reads the documentation |
| Editing `.claude/rules/` from /doks | Rules are out of scope (Amendment 2026-04-26). Auto-edit causes silent drift; updates happen only via deliberate ADR. |
| Documenting "planned" features as if they exist | Misleads future sessions into assuming capabilities |

## Language Preservation

- English files stay English (CLAUDE.md, README.md, rules, skills, commands)
- Spanish files stay Spanish (if any)
- Never mix languages within a single file

## Integration

- **Agent**: doks (primary executor of this methodology)
- **Command**: /doks (triggers doks with this skill)
- **Also useful for**: any agent that needs to update documentation as a side effect

## no_context Application

Generate documentation from code, not from assumptions. Read the actual source before writing descriptions. If a component is referenced but cannot be found on disk, flag it and remove the reference rather than guessing what it might do.
