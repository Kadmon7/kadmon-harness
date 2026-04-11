---
description: "Full harness diagnostic — 7 health checks + deep agent analysis + repair. Alias: /MediK"
agent: mekanik, kurator
skills: [systematic-debugging, coding-standards]
---

## Purpose
Full harness health diagnostic. Runs 7 mechanical checks, invokes mekanik and kurator for deep analysis, presents all findings in conversation, and repairs what the user approves. No file artifacts — results are displayed directly.

Always runs the full pipeline. If you're running /medik, you want the complete picture.

## Steps

### Phase 1: Health Checks (direct — no agent)

Run all 7 checks directly (mechanical commands, no agent needed):

| # | Check | Command / Method | What to look for |
|---|-------|-----------------|------------------|
| 1 | Build | `npm run build` | Compilation errors, EBUSY locks, missing files |
| 2 | Typecheck | `npx tsc --noEmit` | Type errors (TS2xxx codes) |
| 3 | Tests | `npx vitest run` | Test failures, timeout errors |
| 4 | Hook errors | Read `~/.kadmon/hook-errors.log` | Recent errors, crash patterns |
| 5 | DB health | Read `~/.kadmon/kadmon.db` | File exists, 6 tables present (sessions, instincts, cost_events, hook_events, agent_invocations, sync_queue), no corruption |
| 6 | dist/ sync | Compare `dist/` timestamps vs `scripts/lib/` | Stale compiled output, missing files |
| 7 | Dependencies | `npm audit` | Vulnerable packages, outdated deps |

### Phase 2: Deep Analysis (agents — always runs)

Invoke both agents in parallel, regardless of Phase 1 results:

1. **mekanik** (sonnet) — Diagnoses any FAIL or WARN from Phase 1. Analyzes root cause, not just symptoms. If all checks pass, analyzes hook-errors.log patterns and build edge cases.
2. **kurator** (sonnet) — Full code health scan of the codebase area relevant to the /medik scope (hooks, scripts, core lib). Looks for: dead code, duplication, unused imports, security pattern gaps, style inconsistencies, structural issues.

Both agents report findings but do NOT modify any files yet.

### GATE: User Approval

**MANDATORY STOP.** Present all findings directly in conversation:
- Phase 1 results table
- mekanik findings with severity
- kurator findings with severity
- Prioritized fix list with owner (mekanik/kurator)

Ask: **"Found N problems. Fix them?"**

Wait for explicit approval. User may approve all, some, or none.

**Escalation rule:** If any finding requires architectural changes (new subsystems, schema changes, multi-component redesign), flag it as "too big for /medik — recommend /abra-kdabra" and exclude from the fix list.

### Phase 3: Repair (agents fix what was approved)

Each agent fixes its own findings:
- **mekanik** fixes: build errors, race conditions, compilation issues, FAIL-level problems
- **kurator** fixes: dead code, duplication, unused imports, style, pattern gaps

Workflow:
1. mekanik repairs first (build must work before cleanup)
2. kurator repairs second (cleanup assumes green build)
3. After each agent's batch: run `npx vitest run` to verify no regressions

### Phase 4: Verify

Re-run all 7 health checks to confirm everything is green. Report final status in conversation.

## Output
Health check table + agent findings + fix results + verification — all in conversation, no file artifacts.

## Example
```
Phase 1 — Health Checks:
  1. Build:        PASS
  2. Typecheck:    PASS
  3. Tests:        PASS (411 passing)
  4. Hook errors:  WARN (54 ensure-dist EBUSY errors)
  5. DB health:    PASS
  6. dist/ sync:   PASS
  7. Dependencies: WARN (7 vulnerabilities, all dev/transitive)

Phase 2 — Deep Analysis:
  mekanik: 1 finding (EBUSY race condition — root cause: concurrent cpSync)
  kurator: 12 findings (2 security gaps, 1 portability, 5 duplication, 2 dead code, 2 style)

GATE: "Found 13 problems. Fix them?"

Phase 3 — Repair:
  mekanik: Fixed EBUSY — atomic rename in build script
  kurator: Fixed 11 items — security guards, dedup, dead code, style

Phase 4 — Verify:
  All 7 checks: PASS
```
