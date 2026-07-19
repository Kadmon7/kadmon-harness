# Hooks Cluster

> 9 nodes

## Key Concepts

- **hook-logger.js** (10 connections) — `.claude/hooks/scripts/hook-logger.js`
- **backup-rotate.js** (7 connections) — `.claude/hooks/scripts/backup-rotate.js`
- **rotateBackup()** (6 connections) — `.claude/hooks/scripts/backup-rotate.js`
- **retrySyncOnEbusy()** (2 connections) — `.claude/hooks/scripts/backup-rotate.js`
- **formatTimestamp()** (2 connections) — `.claude/hooks/scripts/backup-rotate.js`
- **EBUSY_DELAYS_MS** (1 connections) — `.claude/hooks/scripts/backup-rotate.js`
- **_rotatingLog** (1 connections) — `.claude/hooks/scripts/hook-logger.js`
- **getHookErrors()** (1 connections) — `.claude/hooks/scripts/hook-logger.js`
- **ADR-0024** (1 connections) — `.claude/hooks/scripts/hook-logger.js`

## Relationships

- [Hook Runtime Bootstrap](Hook_Runtime_Bootstrap.md) (10 shared connections)
- [Git & Commit Guard Hooks](Git_%26_Commit_Guard_Hooks.md) (1 shared connections)

## Source Files

- `.claude/hooks/scripts/backup-rotate.js`
- `.claude/hooks/scripts/hook-logger.js`

## Audit Trail

- EXTRACTED: 31 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*