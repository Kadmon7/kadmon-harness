---
description: Run end-to-end tests that verify full system workflows
---

## Purpose
Invoke e2e-runner agent to test complete workflows across multiple components.

## Steps
1. Invoke e2e-runner agent (sonnet)
2. Run session lifecycle test: start → observe → end → verify SQLite
3. Run instinct lifecycle test: create → reinforce → promote
4. Run hook chain test: observe-pre → edit → observe-post → verify JSONL
5. Report results per scenario with timing

## Output
E2E test results with pass/fail per scenario and execution time.