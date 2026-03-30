---
description: Run end-to-end tests for full workflow verification (expensive, on-demand)
---

## Purpose
Invoke e2e-runner agent to test complete workflows across multiple components.

## Arguments
- (none) — run all 3 core scenarios
- `session` — session lifecycle only
- `instinct` — instinct lifecycle only
- `hooks` — hook chain only

## Steps
1. Invoke e2e-runner agent (sonnet)
2. Run session lifecycle test: start → observe → end → verify SQLite
3. Run instinct lifecycle test: create → reinforce → promote
4. Run hook chain test: observe-pre → edit → observe-post → verify JSONL
5. Report results per scenario with timing

## Output
E2E test results with pass/fail per scenario and execution time.

## Example
```
E2E Results:
  Session lifecycle:  PASS (1.2s)
  Instinct lifecycle: PASS (0.8s)
  Hook chain:         PASS (0.5s)

3/3 scenarios passed (2.5s total)
```