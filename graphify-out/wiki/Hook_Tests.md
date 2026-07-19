# Hook Tests

> 5 nodes

## Key Concepts

- **obsDir()** (5 connections) — `tests/eval/phase1b-workflows-e2e.test.ts`
- **obsPath()** (2 connections) — `tests/eval/phase1b-workflows-e2e.test.ts`
- **writeObservations()** (2 connections) — `tests/hooks/evaluate-patterns-shared.test.ts`
- **writeObservations()** (2 connections) — `tests/hooks/pre-compact-save.test.ts`
- **writeObservations()** (2 connections) — `tests/hooks/session-end-all.test.ts`

## Relationships

- [Eval Tests: Phase1b Workflows E2e](Eval_Tests-_Phase1b_Workflows_E2e.md) (2 shared connections)
- [Pattern Evaluation Tests](Pattern_Evaluation_Tests.md) (1 shared connections)
- [Hook Tests: Pre Compact Save](Hook_Tests-_Pre_Compact_Save.md) (1 shared connections)
- [Hook Tests: Session End All](Hook_Tests-_Session_End_All.md) (1 shared connections)

## Source Files

- `tests/eval/phase1b-workflows-e2e.test.ts`
- `tests/hooks/evaluate-patterns-shared.test.ts`
- `tests/hooks/pre-compact-save.test.ts`
- `tests/hooks/session-end-all.test.ts`

## Audit Trail

- EXTRACTED: 7 (54%)
- INFERRED: 6 (46%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*