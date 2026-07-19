# Hook Runtime Bootstrap

> 25 nodes

## Key Concepts

- **session-start.js** (25 connections) — `.claude/hooks/scripts/session-start.js`
- **session-end-all.js** (20 connections) — `.claude/hooks/scripts/session-end-all.js`
- **pre-compact-save.js** (18 connections) — `.claude/hooks/scripts/pre-compact-save.js`
- **safeSessionDir()** (16 connections) — `.claude/hooks/scripts/safe-session-dir.js`
- **main()** (14 connections) — `.claude/hooks/scripts/session-start.js`
- **evaluate-patterns-shared.js** (12 connections) — `.claude/hooks/scripts/evaluate-patterns-shared.js`
- **main()** (12 connections) — `.claude/hooks/scripts/session-end-all.js`
- **resolveRootDir()** (11 connections) — `.claude/hooks/scripts/ensure-dist.js`
- **logHookError()** (11 connections) — `.claude/hooks/scripts/hook-logger.js`
- **main()** (11 connections) — `.claude/hooks/scripts/pre-compact-save.js`
- **safe-session-dir.js** (11 connections) — `.claude/hooks/scripts/safe-session-dir.js`
- **evaluateAndApplyPatterns()** (10 connections) — `.claude/hooks/scripts/evaluate-patterns-shared.js`
- **ensure-dist.js** (8 connections) — `.claude/hooks/scripts/ensure-dist.js`
- **ensureDist()** (8 connections) — `.claude/hooks/scripts/ensure-dist.js`
- **gitExec()** (8 connections) — `.claude/hooks/scripts/evaluate-patterns-shared.js`
- **generateSummary()** (8 connections) — `.claude/hooks/scripts/generate-session-summary.js`
- **resolveMemoryDir()** (7 connections) — `.claude/hooks/scripts/daily-log.js`
- **generate-session-summary.js** (5 connections) — `.claude/hooks/scripts/generate-session-summary.js`
- **isDistStale()** (4 connections) — `.claude/hooks/scripts/ensure-dist.js`
- **estimateTokensFromTranscript()** (3 connections) — `.claude/hooks/scripts/session-end-all.js`
- **extractBashFiles()** (2 connections) — `.claude/hooks/scripts/generate-session-summary.js`
- **ADR-0015** (1 connections) — `.claude/hooks/scripts/evaluate-patterns-shared.js`
- **NOTE: this is NOT the only read of the live file — Phase 5 below does** (1 connections) — `.claude/hooks/scripts/session-end-all.js`
- **ADR-0022** (1 connections) — `.claude/hooks/scripts/session-start.js`
- **ADR-0024** (1 connections) — `.claude/hooks/scripts/session-start.js`

## Relationships

- [Git & Commit Guard Hooks](Git_%26_Commit_Guard_Hooks.md) (23 shared connections)
- [Hooks: Daily Log](Hooks-_Daily_Log.md) (10 shared connections)
- [Hooks Cluster](Hooks_Cluster.md) (10 shared connections)
- [Hooks: Install Diagnostic](Hooks-_Install_Diagnostic.md) (3 shared connections)
- [Hooks: Ts Review](Hooks-_Ts_Review.md) (2 shared connections)

## Source Files

- `.claude/hooks/scripts/daily-log.js`
- `.claude/hooks/scripts/ensure-dist.js`
- `.claude/hooks/scripts/evaluate-patterns-shared.js`
- `.claude/hooks/scripts/generate-session-summary.js`
- `.claude/hooks/scripts/hook-logger.js`
- `.claude/hooks/scripts/pre-compact-save.js`
- `.claude/hooks/scripts/safe-session-dir.js`
- `.claude/hooks/scripts/session-end-all.js`
- `.claude/hooks/scripts/session-start.js`

## Audit Trail

- EXTRACTED: 228 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*