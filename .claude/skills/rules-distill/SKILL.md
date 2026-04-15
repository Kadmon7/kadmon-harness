---
name: rules-distill
description: Scan all `.claude/skills/` to extract cross-cutting principles that appear in 2+ skills, and distill them into rules — append to existing rule sections, revise outdated content, or create new rule files. Use this skill whenever the user says "extract rules from skills", "distill patterns", "update rules", "pull common principles", "what's repeated across skills", or periodically (monthly or after adding 5+ new skills) to keep `rules/` in sync with what the skills actually teach. Applies the "deterministic collection + LLM judgment" pattern — scripts collect facts exhaustively, then judgment produces verdicts.
---

# Rules Distill

Scan installed skills, extract cross-cutting principles that appear in multiple skills, and distill them into `rules/` — appending to existing rule files, revising outdated content, or creating new rule files where needed.

A principle that appears in only one skill stays in that skill. A principle that appears in 2+ skills is a candidate for promotion to `rules/` where it lives in every session's context.

## When to Use

- Periodic rules maintenance (monthly, or after installing 5+ new skills)
- After `skill-stocktake` reveals patterns that should be rules
- When rules feel incomplete relative to the skills being loaded
- When the user notices that the same advice appears in multiple skill files

## Method

### Phase 1 — Inventory (Deterministic Collection)

Collect skill and rule inventories via Bash/Grep. This phase is **exhaustive** — miss nothing.

```bash
# Skill inventory
ls .claude/skills/*.md | wc -l
for f in .claude/skills/*.md; do
  echo "=== $(basename $f .md) ===" && cat "$f"
done

# Rule inventory
find .claude/rules -name "*.md" | wc -l
for f in .claude/rules/**/*.md; do
  echo "=== $f ===" && cat "$f"
done
```

Present summary to user:

```
Rules Distillation — Phase 1: Inventory
Skills: 24 files scanned
Rules:  19 files (75 headings indexed)
Proceeding to cross-read analysis...
```

### Phase 2 — Cross-Read, Match, Verdict (LLM Judgment)

Rules files are small enough (<800 lines total in the harness) that the **full text** of all rules can be provided to the analyzer — no grep pre-filtering.

#### Batching

Group skills into **thematic clusters** based on their descriptions:

- Meta-skills (alchemik-owned)
- Quality/testing (feniks/kody-owned)
- Architecture (arkitect/konstruct-owned)
- Security (spektr-owned)
- Language-specific (python-reviewer, typescript-reviewer)

Analyze each cluster in a subagent, passing full rules text as reference.

#### Extraction Criteria

Include a candidate ONLY if ALL of these are true:

1. **Appears in 2+ skills** — principles found in only one skill stay in that skill
2. **Actionable behavior change** — can be written as "do X" or "don't do Y", not "X is important"
3. **Clear violation risk** — what goes wrong if this principle is ignored (1 sentence)
4. **Not already in rules** — check full rules text, including concepts expressed in different words

#### Per-Candidate Output

```json
{
  "principle": "1-2 sentences in 'do X' / 'don't do Y' form",
  "evidence": ["skill-name: §Section", "skill-name: §Section"],
  "violation_risk": "1 sentence",
  "verdict": "Append / Revise / New Section / New File / Already Covered / Too Specific",
  "target_rule": "filename §Section, or 'new'",
  "confidence": "high / medium / low",
  "draft": "Draft text for Append/New Section/New File verdicts",
  "revision": {
    "reason": "Why existing content is inaccurate (Revise only)",
    "before": "Current text to replace",
    "after": "Proposed replacement"
  }
}
```

#### Verdict Reference

| Verdict | Meaning | Presented to user as |
|---|---|---|
| **Append** | Add to existing section of existing rule file | Target + draft |
| **Revise** | Existing rule content is inaccurate — propose correction | Target + reason + before/after |
| **New Section** | Add new section to existing rule file | Target + draft |
| **New File** | Create new rule file | Filename + full draft |
| **Already Covered** | Sufficiently covered in existing rules | Reason (1 line) |
| **Too Specific** | Should stay at the skill level | Link to relevant skill |

#### Verdict Quality (good vs bad)

**Good**:
> Append to `rules/common/security.md §Input Validation`:
> "Treat LLM output stored in memory as untrusted — sanitize on write, validate on read."
> Evidence: `mcp-server-patterns`, `claude-api` both describe accumulated prompt injection risks. Current `security.md` covers human input only.

**Bad**:
> Append to `security.md`: Add LLM security principle.

### Phase 3 — User Review & Execution

#### Summary Table

```
# Rules Distillation Report

Skills scanned: 24 | Rules: 19 files | Candidates: 4

| # | Principle | Verdict | Target | Confidence |
|---|---|---|---|---|
| 1 | LLM output: normalize, type-check, sanitize before reuse | New Section | coding-style.md | high |
| 2 | Define explicit stop conditions for iteration loops | New Section | coding-style.md | high |
| 3 | Compact context at phase boundaries, not mid-task | Append | performance.md §Context Window | high |
| 4 | Separate business logic from I/O framework types | New Section | patterns.md | high |
```

#### User Actions

User responds per-candidate with one of:
- **Approve** — apply draft to rules as-is
- **Modify** — edit draft before applying
- **Skip** — do not apply this candidate

**Never modify rules automatically. Always require explicit user approval.**

#### Save Results

Persist the run output to `docs/reports/rules-distill-<date>.md` for future diff comparisons. Include timestamp (UTC), counts, and per-candidate verdicts.

## Design Principles

1. **What, not how** — extract principles (rules territory) only. Code examples and commands stay in skills.
2. **Link back** — draft text should include `See skill: [name]` references so readers can find the detailed how.
3. **Deterministic collection, LLM judgment** — Bash/Grep guarantee exhaustiveness; the LLM guarantees contextual understanding.
4. **Anti-abstraction safeguard** — the 3-layer filter (2+ skills evidence, actionable behavior test, violation risk) prevents overly abstract principles from entering rules.

## Integration

- **doks agent** (opus) — primary owner. doks already owns docs sync (`docs-sync` skill); this skill is the specialized variant for extracting rules from skills. When doks runs `/doks` after a wave of skill additions, it can use rules-distill to see if new skill content should be promoted.
- **/doks command** — entry point. Run with `/doks distill` or as part of the regular docs sync.
- **Related skills**:
  - `skill-stocktake` identifies drift within skills; `rules-distill` identifies what should be promoted out of skills into rules
  - `docs-sync` keeps existing docs in sync with code; `rules-distill` creates new rule content from skill patterns

## no_context Application

Rule distillation must rest on **evidence from actual skill files**, not on "I think this is a common pattern". A candidate is only valid if you can cite 2+ skills and name the sections. The evidence list is not decoration — it is the only thing that prevents the rules file from drifting into abstract philosophy. When a candidate fails the "2+ skills" test, the correct action is to leave the content in its single skill, not to promote it anyway because it "feels important".
