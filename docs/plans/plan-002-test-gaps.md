---
number: 2
title: Test Gap Analysis — Missing Tests for Kadmon Harness
date: 2026-04-07
status: in_progress
needs_tdd: true
route: B
adr: none
---

# Plan 002: Test Gaps

## Current State
- 37 test files, 344 tests, all passing
- ~55 new tests identified across 23 gaps in 5 tiers

## Phase 1: Security (S, ~17 tests)

| # | Gap | File | New Tests |
|---|-----|------|-----------|
| 1 | parseStdin/wasTruncated/isDisabled unit tests | parse-stdin.js | ~8 (new file: parse-stdin.test.ts) |
| 2 | config-protection truncation blocking | config-protection.js | 1 (add to existing) |
| 3 | no-context-guard truncation blocking | no-context-guard.js | 1 (add to existing) |
| 4 | commit-quality SECRET_PATTERNS (ghp_, sk-live, xox) | commit-quality.js | 3 (add to existing) |
| 5 | observe-post secret scrubbing ([REDACTED]) | observe-post.js | 4 (add to existing) |

## Phase 2: Lifecycle Critical (M-L, ~11 tests)

| # | Gap | File | New Tests |
|---|-----|------|-----------|
| 6 | session-start orphan recovery | session-start.js | 3-4 (L — needs seeded DB + observations) |
| 7 | estimateTokensFromTranscript | session-end-all.js | 3 (M — needs temp transcript file) |
| 8 | evaluateAndApplyPatterns direct tests | evaluate-patterns-shared.js | 5 (L — new file, needs mocked DB) |

## Phase 3: Lifecycle Remaining (S-M, ~8 tests)

| # | Gap | File | New Tests |
|---|-----|------|-----------|
| 9 | session-start post-compact context reinjection | session-start.js | 2-3 (L) |
| 10 | session-start tmp directory cleanup | session-start.js | 2 (M) |
| 11 | transcript cost fallback path | session-end-all.js | 2 (M) |
| 12 | pre-compact-save daily log writing | pre-compact-save.js | 1 (S) |

## Phase 4: New DB Features (S-M, ~13 tests)

| # | Gap | File | New Tests |
|---|-----|------|-----------|
| 13 | log-hook-event.js path validation + JSONL append + empty sessionId | log-hook-event.js | ~4 (new file: log-hook-event.test.ts) |
| 14 | session-end-all Phase 1c hook event extraction | session-end-all.js | ~2 (add to existing) |
| 15 | session-end-all Phase 1c agent invocation extraction | session-end-all.js | ~2 (add to existing) |
| 16 | migrate-v0.4.ts idempotent migration | migrate-v0.4.ts | ~2 (add to migrate-v0.3 tests or new file) |
| 17 | dashboard hook stats, agent stats, DB status sections | dashboard.ts | ~3 (add to existing) |

## Phase 5: Core Lib + Utility (S, ~6 tests)

| # | Gap | File | New Tests |
|---|-----|------|-----------|
| 18 | createInstinct with domain | instinct-manager.ts | 1 (S) |
| 19 | createInstinct global scope | instinct-manager.ts | 1 (S) |
| 20 | hook-logger truncation at MAX_LOG_SIZE | hook-logger.js | 2 (M) |
| 21 | hook-logger getHookErrors corrupted lines | hook-logger.js | 1 (S) |
| 22 | backup-rotate error return path | backup-rotate.js | 1 (S) |

## Removed from Original Plan (already covered)

| # | Gap | Covered By |
|---|-----|------------|
| ~~13~~ | getOrphanedSessions | state-store.test.ts (getOrphanedSessions tests) |
| ~~14~~ | getCostSummaryByModel | dashboard.test.ts (getModelCostRows tests) |
| ~~15~~ | loadSessionContext | session-manager.test.ts (2 tests) |
| ~~18~~ | loadObservations | dashboard.test.ts (findActiveSessionDir tests) |

## Also Removed (low value)

| # | Gap | Reason |
|---|-----|--------|
| ~~19-20~~ | observe-pre TaskCreate/Skill metadata | Infrastructure hooks, always exit 0, low risk |
| ~~21-22~~ | generate-session-summary TaskCreate | Already has 19 tests, diminishing returns |
| ~~26~~ | migrate-v0.3.ts | Superseded by migrate-v0.4.ts (test that instead) |
| ~~27~~ | cleanup-test-sessions.ts CLI | Simple script wrapper, tested via state-store |

## Priority Rationale

- **Phase 1 first**: Security gaps are real attack vectors (stdin overflow could bypass config-protection; secret leakage in observe-post)
- **Phase 2 second**: Data loss prevention (orphan sessions lose data; cost estimation affects billing tracking)
- **Phase 3 third**: Improve lifecycle confidence
- **Phase 4 fourth**: Cover the new DB v0.4 features (hook_events, agent_invocations, dashboard)
- **Phase 5 last**: Low risk utility gaps

## Implementation Notes

- New test files needed: parse-stdin.test.ts, evaluate-patterns-shared.test.ts, log-hook-event.test.ts
- All other tests add cases to existing test files
- All hook tests use execFileSync pattern (already established)
- Core lib tests use :memory: SQLite (already established)
- Target: 344 + ~55 = ~399 tests
