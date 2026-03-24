---
description: Create implementation plan for a feature or task
---

## Purpose
Invoke the planner agent to break a task into ordered, verifiable steps with dependencies and risk identification.

## Steps
1. Receive task description from user
2. Invoke planner agent (opus) with full task context
3. Planner reads relevant code via Grep/Glob to understand current state
4. Produce numbered plan with verification per step
5. Save plan to docs/plans/[date]-[slug].md
6. Present summary to user for approval

## Output
Plan file path + numbered step summary with complexity estimates (S/M/L).

## Example
```
User: /plan implement instinct export to JSON

Output:
## Plan: Instinct Export
### Phase 0: Research
- [ ] Read instinct-manager.ts to understand current export (S)
### Phase 1: Implementation
- [ ] Step 1.1: Write test for exportInstincts() (S)
- [ ] Step 1.2: Implement JSON serialization (S)
- [ ] Step 1.3: Add CLI command wiring (S)
Saved to: docs/plans/2026-03-24-instinct-export.md
```