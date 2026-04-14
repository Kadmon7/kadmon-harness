---
name: skill-stocktake
description: Audit all `.claude/skills/` for quality and drift — produce Keep/Improve/Update/Retire/Merge verdicts with evidence-backed reasons, in Quick Scan (changed skills only) or Full Stocktake (complete review) mode. Use this skill whenever auditing the skill library, checking for stale references, looking for duplication across skills, deciding what to prune or merge, reviewing skill quality before a release, or when the user says "audit skills", "review our skills", "are these skills still good", "skill quality", "skill drift", or "can we consolidate these". Also use when alchemik runs `/evolve` and needs a structured quality report on the skill inventory.
---

# Skill Stocktake

Audit `.claude/skills/` for quality, currency, uniqueness, and actionability. Produce a verdict per skill with evidence-backed reasoning — not numeric scores.

## When to Use
- Periodic audit of the skill library (quarterly or before a release)
- After adding 5+ new skills, to detect overlap and drift
- When a skill has not been invoked in months and you suspect it is stale
- When `/evolve` reports that instinct promotion is creating duplicated skills
- Before approving `/evolve` step 6 Generate PROMOTE proposals — run skill-stocktake first to check whether the proposed skill already exists under a different name (step 6 Generate shipped 2026-04-14 via ADR-008; EXPERIMENTAL through 2026-04-28)
- When the user asks "which skills are we actually using" or "can we consolidate"

## Two Modes

| Mode | Trigger | Duration |
|------|---------|----------|
| **Quick Scan** | Previous audit state exists on disk | 5-10 min (re-evaluate only changed skills) |
| **Full Stocktake** | No previous state, or user asks "full audit" | 20-30 min (every skill re-evaluated) |

## Quick Scan Flow

Re-evaluate only skills whose `mtime` has changed since the last audit. Carry forward unchanged verdicts.

1. Read previous audit state (usually persisted at `docs/reports/skill-audit-<date>.md` or inline in MEMORY.md)
2. Diff current skill file mtimes against previous state
3. If nothing changed: report "no changes since last audit" and stop
4. Re-evaluate only the changed files against the Phase 2 criteria
5. Carry forward unchanged skills verbatim in the final report
6. Output only the delta

## Full Stocktake Flow

### Phase 1 — Inventory
List every `.claude/skills/*.md` with its `mtime`, frontmatter `description`, and line count. Build an inventory table:

| Skill | Lines | Last Changed | Description (first 80 chars) |
|---|---|---|---|

For each skill, also note which agent loads it (grep the frontmatter `skills:` field of every `.claude/agents/*.md`). Flag skills with zero agent owners as candidates for Retire or command-level (like `verification-loop`).

### Phase 2 — Quality Evaluation

Process skills in batches (~20 per batch to keep context manageable). For each skill, read the file and apply this checklist:

- [ ] **Content overlap** — does another skill cover the same ground?
- [ ] **Overlap with CLAUDE.md / rules** — is this knowledge already in rules/ or CLAUDE.md?
- [ ] **Reference currency** — are the tool names, CLI flags, APIs, and library versions still correct? Use WebSearch if any look outdated.
- [ ] **Usage signal** — has the skill been referenced in recent sessions? (check session logs, instincts, or MEMORY.md)

Assign one verdict:

| Verdict | Meaning |
|---|---|
| **Keep** | Useful, current, unique. No action needed. |
| **Improve** | Worth keeping, but specific improvements needed (name the section and the change). |
| **Update** | Referenced technology is outdated. Verify with WebSearch or `/almanak`, then rewrite the affected section. |
| **Retire** | Low quality, stale, or covered entirely elsewhere. Name what replaces it. |
| **Merge into [X]** | Substantial overlap with another skill. Name the merge target and what content to integrate. |

Evaluation is **holistic AI judgment**, not a numeric rubric. Focus on:

- **Actionability** — does the skill contain steps/commands/examples that let Claude act immediately, or just prose?
- **Scope fit** — name, trigger, and content aligned; not too broad, not too narrow
- **Uniqueness** — value not replaceable by CLAUDE.md, rules, or another skill
- **Currency** — technical references work in the current environment

### Reason quality requirements

The `reason` for each verdict must be **self-contained** and decision-enabling. A future reader should be able to act on the verdict without re-reading the original skill.

- **Retire** — state (1) what specific defect was found, (2) what covers the same need instead
  - Bad: `"Superseded"`
  - Good: `"continuous-learning-v1 has disable-model-invocation: true already set; continuous-learning-v2 covers all the same patterns plus confidence scoring. No unique content remains."`
- **Merge** — name the target and describe what content to integrate
  - Bad: `"Overlaps with X"`
  - Good: `"42-line thin content; Step 4 of chatlog-to-article already covers the same workflow. Integrate the 'article angle' tip as a note in that skill and retire this one."`
- **Improve** — describe the specific change needed (what section, what action, target size if relevant)
  - Bad: `"Too long"`
  - Good: `"276 lines; Section 'Framework Comparison' (lines 80-140) duplicates architecture-decision-records; delete it to reach ~150 lines."`
- **Keep** (Quick Scan, content unchanged) — restate the original verdict rationale, don't write "unchanged"
  - Bad: `"Unchanged"`
  - Good: `"mtime updated but content unchanged. Unique Python reference explicitly imported by rules/python/; no overlap found."`

### Phase 3 — Summary Table

| Skill | Lines | Agent owner | Verdict | Reason |
|---|---|---|---|---|

### Phase 4 — Consolidation

For each non-Keep verdict, present the user with detailed justification before acting:

1. **Retire / Merge** — show:
   - The specific defect (overlap, staleness, broken refs)
   - The alternative that covers the same need (named file)
   - Impact of removal (dependent skills, MEMORY.md references, agent `skills:` fields)
2. **Improve** — show:
   - Exact section to change and target state
   - Rationale for the change (why this matters for quality)
3. **Update** — show:
   - The outdated reference + the current correct form (verified via `/almanak` or WebSearch)

The user confirms before anything is deleted or merged. Never archive without explicit approval.

## Audit Checklist (what "good" looks like)

Before calling a skill "Keep", verify:

- [ ] `description:` is trigger-rich (lists words/phrases users would actually say)
- [ ] `description:` is pushy enough to combat undertriggering
- [ ] Body has `## Integration` section naming the loading agent (unless it's a command-level skill like `verification-loop`)
- [ ] Body has `## no_context Application` explaining how the skill enforces the principle
- [ ] Examples are concrete and current
- [ ] No references to files or tools that don't exist in the current harness

## Integration

- **alchemik agent** (opus) — primary runner. Invoked via `/evolve`, alchemik can load this skill to produce a quality report on the skill inventory as part of the harness health check. Alchemik's job is to measure harness effectiveness; skill-stocktake is the instrument.
- **doks agent** (opus) — secondary. When `/doks` runs a docs sync, doks can use this skill to flag skills whose descriptions drifted from the code they document. doks already owns docs-sync — stocktake is the skill-specific variant.
- **/evolve command** — natural entry point. `alchemik` loads this skill and reports verdicts as part of the evolve output.
- **/doks command** — secondary entry point for ad-hoc audits triggered after bulk skill changes.

## no_context Application

Skill verdicts must be evidence-backed, never impressionistic. "Too long" is not a reason — "lines 80-140 duplicate ADR skill content" is. The `no_context` principle demands that every verdict rest on observable facts: content overlap verified by reading both files, staleness verified by running the referenced command, usage signal verified by checking actual session logs. When a verdict cites a defect, the defect must be reproducible by the next reader. If no evidence exists, the verdict is not "Retire" — it is "Keep pending further evidence".
