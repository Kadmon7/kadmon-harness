---
description: Evaluate agent or skill quality with structured test cases and scoring
skills: [eval-harness]
---

## Purpose
Invoke eval-harness skill to measure agent/skill effectiveness against defined criteria.

## Arguments
- `<agent-name>` — evaluate a specific agent (e.g., `/eval code-reviewer`)
- `<skill-name>` — evaluate a specific skill (e.g., `/eval search-first`)

## Steps
1. Define evaluation criteria for the target agent/skill
2. Create test cases with expected outcomes
3. Run agent/skill against each test case
4. Score: pass/fail per criterion
5. Report summary with pass rate

## Output
Evaluation report with scores and recommendations.

## Example
```
Eval: code-reviewer agent

| Criterion           | Result | Notes |
|---------------------|--------|-------|
| Detects SQL injection | PASS | Caught string concat in query |
| Flags missing types  | PASS | Found 2 untyped exports |
| No false positives   | PASS | All findings verified |

Score: 3/3 (100%) — PASS
```