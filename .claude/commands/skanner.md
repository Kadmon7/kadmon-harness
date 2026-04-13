---
description: "Deep system assessment — performance profiling + E2E workflow tests in parallel. Optional agent evaluation."
agent: arkonte, kartograf
skills: [context-budget, e2e-testing]
---

## Purpose
Deep system assessment that goes beyond code review (chekpoint). Runs performance profiling and E2E workflow tests in parallel to verify the system works correctly and efficiently. Use after multiple commits or at end of sprint for full confidence.

## Arguments
- (none) — run performance + E2E in parallel
- `perf` — only Phase 1a (arkonte performance profiling)
- `e2e` — only Phase 1b (kartograf E2E tests)
- `hooks` — only arkonte hook latency benchmarking
- `<agent-name>` — run Phase 1 + Phase 2 ad-hoc eval of specific agent (e.g., `/skanner kody`)

## Steps

### Phase 1: System Assessment (parallel)

Launch both agents simultaneously:

**1a. Performance Profiling (arkonte — sonnet)**
- Profile recently changed files or full codebase
- Detect: O(n^2) loops, slow queries, memory-intensive patterns
- Benchmark hook latency against budgets (observe: 50ms, no-context-guard: 100ms, others: 500ms)
- Report with before/after complexity analysis

**1b. E2E Workflow Tests (kartograf — sonnet)**
- Run critical harness workflows:
  1. Session lifecycle: start → observe → compact → end
  2. Instinct lifecycle: create → reinforce → promote
  3. Hook chain: observe-pre → edit → observe-post
  4. no-context-guard: Write without Read → blocked
  5. Cost tracking: session with known tokens → verify calculation
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

Note: agent quality evaluation is the responsibility of `/akademy` (to be redesigned). `/skanner` only keeps a lightweight ad-hoc mode here for quick single-agent checks.

## Output
Performance report + E2E results + optional agent eval + system health score.

## Example
```
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
