---
description: "Deep system assessment — performance profiling + E2E workflow tests in parallel. Optional agent evaluation."
agent: arkonte, kartograf
skills: [context-budget, e2e-testing]
---

## Purpose
Deep system assessment that goes beyond code review (chekpoint). Runs performance profiling and E2E workflow tests in parallel to verify the system works correctly and efficiently. Use after multiple commits or at end of sprint for full confidence.

## Arguments

**Profile arguments** (force project profile, skips marker detection — per ADR-031):
- `harness` — force harness profile (5 lifecycle scenarios + hook latency budget)
- `web` — force web profile (auth/search/CRUD/realtime scenarios + Web Vitals)
- `cli` — force cli profile (CLI invocation/config/IO contract/subprocess scenarios)

**Mode arguments** (combine with profile or run alone):
- (none) — auto-detect profile, run performance + E2E in parallel
- `perf` — only Phase 1a (arkonte performance profiling)
- `e2e` — only Phase 1b (kartograf E2E tests)
- `hooks` — only arkonte hook latency benchmarking (harness profile only)
- `<agent-name>` — run Phase 1 + Phase 2 ad-hoc eval of specific agent (e.g., `/skanner kody`)

Profile + mode can combine: `/skanner web e2e` = web profile, e2e-only mode. Precedence: profile args (`harness|web|cli`) reserved; mode args (`perf|e2e|hooks`) reserved; any other string falls through to agent-eval. Override env: `KADMON_SKANNER_PROFILE` overrides marker detection but is itself overridden by an explicit profile arg.

## Steps

### Phase 1: System Assessment (parallel)

Launch both agents simultaneously:

**1a. Performance Profiling (arkonte — sonnet)**
- Detect profile: emit `Detected: <profile> (source: ...)` as first line (per ADR-031)
- Profile recently changed files or full codebase
- Detect: O(n^2) loops, slow queries, memory-intensive patterns
- In **harness** profile only: benchmark hook latency against budgets (observe: 50ms, no-context-guard: 100ms, others: 500ms)
- In **web** profile: include Web Vitals targets (LCP < 2.5s, FID < 100ms, CLS < 0.1, bundle < 200KB)
- In **cli** profile: focus on startup latency, IO throughput, memory footprint
- Report with before/after complexity analysis

**1b. E2E Workflow Tests (kartograf — sonnet)**
- Detect profile: emit `Detected: <profile> (source: ...)` as first line (per ADR-031)
- Run profile-matched scenarios from `kartograf.md`:
  - **harness**: session/instinct/hook lifecycle + no-context-guard + cost tracking (5 scenarios)
  - **web**: auth/search/CRUD/realtime (4 scenarios)
  - **cli**: CLI invocation/config load/IO contract/subprocess wrapper (4 scenarios)
- Report pass/fail per scenario with timing

### GATE: Present Results

**MANDATORY STOP.** Present combined results:
- Performance findings by severity (HIGH/MEDIUM/LOW)
- E2E test results (PASS/FAIL per scenario)
- Overall system health score

Ask: **"Assessment complete. N performance issues, M/T E2E tests passing. Fix performance issues?"**

### Phase 2: Agent Evaluation (optional)

Only runs if an agent name is passed as argument.

1. Define test cases for the specified agent
2. Run agent against each test case
3. Score: pass/fail per criterion
4. Report with recommendations

Note: structured agent quality evaluation is the responsibility of `/evolve` (via the `agent-eval` skill loaded by alchemik). `/skanner` only keeps a lightweight ad-hoc mode here for quick single-agent checks.

## Output
Performance report + E2E results + optional agent eval + system health score.

## Example
```
Detected: harness (source: markers — state-store.ts, observe-pre.ts found)

Phase 1 — System Assessment (parallel):

  arkonte (performance):
    HIGH: O(n^2) in loadSessions() — Map lookup recommended
    MEDIUM: Sync file read in async context (hook-logger.js)
    Hook latency: 19/20 within budget, 1 OVER (post-edit-typecheck: 620ms)

  kartograf (E2E):
    | # | Scenario              | Status | Time  |
    |---|-----------------------|--------|-------|
    | 1 | Session lifecycle     | PASS   | 450ms |
    | 2 | Instinct lifecycle    | PASS   | 320ms |
    | 3 | Hook chain            | PASS   | 180ms |
    | 4 | no-context-guard      | PASS   | 95ms  |
    | 5 | Cost tracking         | PASS   | 210ms |

GATE: "1 HIGH, 1 MEDIUM performance issue. 5/5 E2E passing. Fix?"

Phase 2 — Agent Eval (if requested):
  Eval: kody
  | Criterion            | Result | Notes |
  |----------------------|--------|-------|
  | Detects SQL injection | PASS   | Caught string concat |
  | Flags missing types   | PASS   | Found 2 untyped exports |
  | No false positives    | PASS   | All verified |
  Score: 3/3 (100%) — PASS
```
