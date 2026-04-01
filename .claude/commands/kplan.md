---
description: Smart planning for complex tasks — routes to arkitect+konstruct or konstruct-only based on task signals, then suggests TDD. Invoke for multi-file, uncertain, or cross-system changes. Skip for simple single-file edits.
agent: arkitect, konstruct
skills: [architecture-decision-records]
---

## Purpose
Smart planning command that routes to the right agent(s) based on task signals.

## Arguments
- `<task description>` — describe the task to plan (e.g., `/kplan design persistence layer for instinct versioning`)

## Steps

### Step 1: Classify the Task

Scan the user's task description for these signals:

### Arkitecture Signals (ANY match -> arkitect first)
- Keywords: "architecture", "design", "schema", "data model", "migration", "new system", "restructure", "add agent", "add hook", "persistence", "API design", "trade-off", "evaluate options"
- Multi-component impact: task affects 3+ areas (e.g., hooks + agents + skills, or DB + API + UI)
- New subsystem: creating something that doesn't exist yet (new agent, new service, new persistence layer)

### Implementation Signals (NO architecture signals -> konstruct direct)
- Keywords: "fix", "bug", "add function", "implement", "test", "refactor", "update", "wire up"
- Single-feature work within existing patterns
- Bug fixes or known-pattern application

Arkitecture signals take priority when both are present.

### Step 2: Execute the Route

### Route A: Arkitecture First (architecture signals detected)
1. Announce: "Arkitecture signals detected — running arkitect first, then konstruct."
2. Invoke **arkitect agent** (opus) with full task context
3. Arkitect produces ADR in `docs/decisions/ADR-NNN-*.md`
4. THEN invoke **konstruct agent** (opus) with task context + ADR reference
5. Konstruct produces implementation plan in `docs/plans/[date]-[slug].md`
6. Present: ADR path + plan summary

### Route B: Implementation Direct (no architecture signals)
1. Announce: "Implementation task — running konstruct directly."
2. Invoke **konstruct agent** (opus) with full task context
3. Konstruct reads relevant code via Grep/Glob
4. Konstruct produces plan in `docs/plans/[date]-[slug].md`
5. Present: plan summary with complexity estimates

### Step 3: Embed /tdd in Plan Steps

The konstruct MUST prefix any step that writes new code with `/tdd —`.
This ensures TDD is part of the plan execution, not a loose suggestion that gets lost.

Steps that are research, config, or docs-only do NOT get the /tdd prefix.

## Output
Route taken + artifact paths + numbered step summary with complexity estimates (S/M/L).

## Example: Arkitecture Route
```
User: /kplan design persistence layer for instinct versioning

Route: ARCHITECTURE FIRST (signals: "design", "persistence", new subsystem)

Phase 1 — Arkitect:
  ADR: docs/decisions/ADR-006-instinct-versioning.md
  Decision: sql.js with version column + diff tracking

Phase 2 — Konstruct:
  Plan: docs/plans/2026-03-27-instinct-versioning.md
  - [ ] Step 1.1: /tdd — Add version column to instincts table (S)
  - [ ] Step 1.2: /tdd — Write migration script (M)
  - [ ] Step 1.3: /tdd — Update instinct-manager read/write (M)
```

## Example: Implementation Route
```
User: /kplan implement instinct export to JSON

Route: IMPLEMENTATION DIRECT (no architecture signals)

Plan: docs/plans/2026-03-27-instinct-export.md
- [ ] Step 1.1: /tdd — Write exportInstincts() function (S)
- [ ] Step 1.2: /tdd — Implement JSON serialization (S)
- [ ] Step 1.3: /tdd — Add CLI command wiring (S)
```
