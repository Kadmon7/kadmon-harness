# Harness Config

> 10 nodes

## Key Concepts

- **typescript-reviewer Agent** (10 connections) — `.claude/agents/typescript-reviewer.md`
- **TypeScript Review Priorities (CRITICAL/HIGH/MEDIUM taxonomy)** (3 connections) — `.claude/agents/typescript-reviewer.md`
- **typescript-reviewer Approval Criteria** (2 connections) — `.claude/agents/typescript-reviewer.md`
- **ts-review-reminder Hook** (2 connections) — `.claude/hooks/CATALOG.md`
- **agent-metadata-sync Hook** (2 connections) — `.claude/hooks/CATALOG.md`
- **Model Routing by Task Complexity (Opus/Sonnet tiers)** (2 connections) — `.claude/rules/common/performance.md`
- **typescript-reviewer no_context Rule** (1 connections) — `.claude/agents/typescript-reviewer.md`
- **TypeScript Diagnostic Commands** (1 connections) — `.claude/agents/typescript-reviewer.md`
- **typescript-reviewer Agent Memory File** (1 connections) — `.claude/agents/typescript-reviewer.md`
- **Review Scope Establishment (never hard-code main)** (1 connections) — `.claude/agents/typescript-reviewer.md`

## Relationships

- [Hook Catalog Registry](Hook_Catalog_Registry.md) (3 shared connections)
- [Harness Config](Harness_Config.md) (2 shared connections)

## Source Files

- `.claude/agents/typescript-reviewer.md`
- `.claude/hooks/CATALOG.md`
- `.claude/rules/common/performance.md`

## Audit Trail

- EXTRACTED: 18 (72%)
- INFERRED: 7 (28%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*