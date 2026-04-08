---
name: scripts/lib full audit 2026-03-26
description: Type safety, async, and pattern audit of all 8 source files in scripts/lib/ — findings and severity ratings
type: project
---

Full audit performed 2026-03-26 covering state-store.ts, types.ts, utils.ts, session-manager.ts, instinct-manager.ts, cost-calculator.ts, dashboard.ts, project-detect.ts.

Key findings (all WARNs, no BLOCKs):

1. state-store.ts:9 — `log` imported from utils but never called in the file (unused import). STILL PRESENT as of 2026-04-07 (line 16).
2. state-store.ts:54,67 — `getAsObject() as Record<string,unknown>` casts are safe (sql.js.d.ts already declares the return type as `Record<string,unknown>`) but redundant.
3. state-store.ts:258-259,372 — union literal casts (`as Instinct['status']`, `as SyncQueueEntry['operation']`) are correct pattern for sql.js untyped output but lack validation guards — a DB corruption could produce invalid string values silently.
4. state-store.ts:168 — `JSON.parse(String(val)) as T` generic cast is acceptable inside a private helper with a fallback, but T is unconstrained.
5. instinct-manager.ts:84 — unused `now` variable (`const now = new Date()` then only `sevenDaysAgo` uses it; `nowISO()` is called separately on line 90).
6. utils.ts — `log` `meta` parameter typed as `object`, which prevents spreading non-plain objects. Should be `Record<string, unknown>`.
7. dashboard.ts — ANSI constants are module-level `const` strings that are exported-nothing but also unused outside render functions — fine, but could be `as const`.
8. cost-calculator.ts:13 — `DEFAULT_PRICING` assigned as `MODEL_PRICING['sonnet']` with no null-assertion or fallback — if key were removed, this would be `undefined`. Low risk but not typed as non-nullable.

**Why:** Full project type audit requested by architect.
**How to apply:** Use these findings as baseline when reviewing future edits to these files. Any new issue in the same files should check whether it was already noted here.

## v0.4 additions (2026-04-07): hook_events + agent_invocations tables
New findings from the v0.4 schema addition review — see project_v04_schema_review_2026-04-07.md.
