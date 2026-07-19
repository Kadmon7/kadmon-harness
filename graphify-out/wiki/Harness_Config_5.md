# Harness Config

> 12 nodes

## Key Concepts

- **/medik Command** (7 connections) — `.claude/commands/medik.md`
- **/medik Phase 1 — 16 Mechanical Health Checks** (7 connections) — `.claude/commands/medik.md`
- **ensure-dist Shared Module** (4 connections) — `.claude/hooks/CATALOG.md`
- **session-start Hook** (3 connections) — `.claude/hooks/CATALOG.md`
- **Plugin-Mode Runtime Resolution (KADMON_RUNTIME_ROOT)** (3 connections) — `.claude/rules/common/hooks.md`
- **RUNTIME_ROOT vs CONSUMER_CWD Portability Rule (AUD-04)** (2 connections) — `.claude/commands/medik.md`
- **/medik Phase 3 — Ordered Repair (mekanik then kurator)** (2 connections) — `.claude/commands/medik.md`
- **/medik Language + Test-Command Resolution** (2 connections) — `.claude/commands/medik.md`
- **install-diagnostic Shared Module (ADR-024)** (2 connections) — `.claude/hooks/CATALOG.md`
- **/medik Phase 2 — Deep Analysis (mekanik + kurator, always runs)** (1 connections) — `.claude/commands/medik.md`
- **medik-checks-cli Runner (checks 10-16, real projectHash)** (1 connections) — `.claude/commands/medik.md`
- **--ALV Attach-Log-Verify Redacted Diagnostic Report** (1 connections) — `.claude/commands/medik.md`

## Relationships

- [Harness Config](Harness_Config.md) (4 shared connections)
- [Hook Catalog Registry](Hook_Catalog_Registry.md) (2 shared connections)
- [Command Docs](Command_Docs.md) (1 shared connections)

## Source Files

- `.claude/commands/medik.md`
- `.claude/hooks/CATALOG.md`
- `.claude/rules/common/hooks.md`

## Audit Trail

- EXTRACTED: 29 (83%)
- INFERRED: 6 (17%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*