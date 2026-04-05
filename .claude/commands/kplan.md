---
description: Smart planning for complex tasks — arkitect -> konstruct -> kody chain with user approval gate. Invoke for multi-file, uncertain, or cross-system changes.
agent: arkitect, konstruct, kody
skills: [architecture-decision-records, tdd-workflow]
---

## Purpose
Sequential planning chain with shared memory bus in `docs/`. Produces an ADR (if architectural) and an implementation plan, then gates on user approval before any code is written.

## Arguments
- `<task description>` — describe the task to plan (e.g., `/kplan design persistence layer for instinct versioning`)

## Steps

### Step 1: Classify the Task

Scan the user's task description for these signals:

**Architecture Signals (ANY match -> arkitect first)**
- Keywords: "architecture", "design", "schema", "data model", "migration", "new system", "restructure", "add agent", "add hook", "persistence", "API design", "trade-off", "evaluate options"
- Multi-component impact: task affects 3+ areas (e.g., hooks + agents + skills, or DB + API + UI)
- New subsystem: creating something that doesn't exist yet

**Implementation Signals (NO architecture signals -> konstruct direct)**
- Keywords: "fix", "bug", "add function", "implement", "test", "refactor", "update", "wire up"
- Single-feature work within existing patterns
- Bug fixes or known-pattern application

Architecture signals take priority when both are present.

### Step 2: Execute the Route

**Route A: Architecture First (architecture signals detected)**
1. Announce: "Architecture signals detected — running arkitect first, then konstruct."
2. Invoke **arkitect agent** (opus) with full task context
3. Arkitect writes ADR to `docs/decisions/ADR-NNN-[slug].md`
4. THEN invoke **konstruct agent** (opus) with task context + ADR reference
5. Konstruct reads the ADR, produces plan in `docs/plans/plan-NNN-[slug].md`
6. Konstruct sets `needs_tdd: true` or `needs_tdd: false` in plan frontmatter based on whether new code will be written

**Route B: Implementation Direct (no architecture signals)**
1. Announce: "Implementation task — running konstruct directly."
2. Invoke **konstruct agent** (opus) with full task context
3. Konstruct reads relevant code via Grep/Glob
4. Konstruct produces plan in `docs/plans/plan-NNN-[slug].md` with `needs_tdd: true/false`

### Step 3: STOP — User Approval Gate

**MANDATORY STOP.** Do not proceed to implementation without explicit user approval.

Present to the user:
- Route taken (A or B)
- ADR path (if Route A)
- Plan summary from `docs/plan.md`
- Whether TDD mode is flagged (`needs_tdd` value)

Ask: **"Plan complete in docs/plan.md. Continue to implementation?"**

Wait for explicit approval. If the user requests changes, update the plan and re-present.

### Step 4: Implement (after user approval)

Claude Code implements the plan from `docs/plan.md`.

**If `needs_tdd: true`**: Invoke **feniks agent** (sonnet) to GUIDE implementation in TDD mode.
- feniks enforces red-green-refactor during implementation
- feniks does NOT write a separate document — it operates inline
- Each code-writing step follows: write failing test -> implement -> verify pass -> refactor

**If `needs_tdd: false`**: Implement directly without TDD guidance (config changes, docs, trivial edits).

### Step 5: Code Review (after code exists)

Invoke **kody agent** (sonnet) ONLY after implementation is complete.
- Review all changes made during Step 4
- Aggregate findings by severity: BLOCK / WARN / NOTE
- BLOCK items must be fixed before proceeding

## Shared Memory Bus
- `docs/decisions/ADR-NNN-[slug].md` — arkitect's architecture decision record (Route A only)
- `docs/plans/plan-NNN-[slug].md` — konstruct's implementation plan (always)
- Agents read/write these files as their handoff mechanism
- Each plan run creates new files — previous plans/ADRs are preserved as history

## Output
Route taken + artifact paths + numbered step summary with complexity estimates (S/M/L).

## Example: Architecture Route
```
Route: ARCHITECTURE FIRST (signals: "design", "persistence", new subsystem)

Phase 1 — Arkitect:
  ADR: docs/adr.md
  Decision: sql.js with version column + diff tracking

Phase 2 — Konstruct:
  Plan: docs/plan.md (needs_tdd: true)
  - Step 1: Add version column to instincts table (S)
  - Step 2: Write migration script (M)
  - Step 3: Update instinct-manager read/write (M)

STOP: "Plan complete in docs/plan.md. Continue to implementation?"
```

## Example: Implementation Route
```
Route: IMPLEMENTATION DIRECT (no architecture signals)

Plan: docs/plan.md (needs_tdd: true)
- Step 1: Write exportInstincts() function (S)
- Step 2: Implement JSON serialization (S)
- Step 3: Add CLI command wiring (S)

STOP: "Plan complete in docs/plan.md. Continue to implementation?"
```
