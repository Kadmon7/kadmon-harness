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
- 35 test files, 328 tests, all passing
- ~55-65 new tests identified across 27 gaps in 5 tiers

## Phase 1: Security (S, ~15 tests)

| # | Gap | File | New Tests |
|---|-----|------|-----------|
| 1 | parseStdin/wasTruncated/isDisabled unit tests | parse-stdin.js | ~8 (new file: parse-stdin.test.ts) |
| 2 | config-protection truncation blocking | config-protection.js | 1 (add to existing) |
| 3 | no-context-guard truncation blocking | no-context-guard.js | 1 (add to existing) |
| 4 | commit-quality SECRET_PATTERNS (ghp_, sk-live, xox) | commit-quality.js | 3 (add to existing) |
| 5 | observe-post secret scrubbing ([REDACTED]) | observe-post.js | 4 (add to existing) |

## Phase 2: Lifecycle Critical (M-L, ~15 tests)

| # | Gap | File | New Tests |
|---|-----|------|-----------|
| 6 | session-start orphan recovery | session-start.js | 3-4 (L — needs seeded DB + observations) |
| 9 | estimateTokensFromTranscript | session-end-all.js | 3 (M — needs temp transcript file) |
| 12 | evaluateAndApplyPatterns direct tests | evaluate-patterns-shared.js | 5 (L — new file, needs mocked DB) |
| 13 | getOrphanedSessions | state-store.ts | 4 (S — add to existing) |

## Phase 3: Lifecycle Remaining (S-M, ~10 tests)

| # | Gap | File | New Tests |
|---|-----|------|-----------|
| 7 | session-start post-compact context reinjection | session-start.js | 2-3 (L) |
| 8 | session-start tmp directory cleanup | session-start.js | 2 (M) |
| 10 | transcript cost fallback path | session-end-all.js | 2 (M) |
| 11 | pre-compact-save daily log writing | pre-compact-save.js | 1 (S) |

## Phase 4: Core Lib (S, ~10 tests)

| # | Gap | File | New Tests |
|---|-----|------|-----------|
| 14 | getCostSummaryByModel direct | state-store.ts | 2 (S) |
| 15 | loadSessionContext edge cases | session-manager.ts | 3 (S) |
| 16 | createInstinct with domain | instinct-manager.ts | 1 (S) |
| 17 | createInstinct global scope | instinct-manager.ts | 1 (S) |
| 18 | loadObservations | dashboard.ts | 2 (S) |

## Phase 5: Utility (S-M, ~15 tests)

| # | Gap | File | New Tests |
|---|-----|------|-----------|
| 19 | observe-pre TaskCreate/TaskUpdate metadata | observe-pre.js | 2 (S) |
| 20 | observe-pre Skill metadata | observe-pre.js | 1 (S) |
| 21 | generate-session-summary TaskCreate lifecycle | generate-session-summary.js | 3 (M) |
| 22 | pending task count in summary | generate-session-summary.js | 1 (S) |
| 23 | hook-logger truncation at MAX_LOG_SIZE | hook-logger.js | 2 (M) |
| 24 | hook-logger getHookErrors corrupted lines | hook-logger.js | 1 (S) |
| 25 | backup-rotate error return path | backup-rotate.js | 1 (S) |
| 26 | migrate-v0.3.ts script | migrate-v0.3.ts | 3 (M) |
| 27 | cleanup-test-sessions.ts CLI | cleanup-test-sessions.ts | 1 (S) |

## Priority Rationale

- **Phase 1 first**: Security gaps are real attack vectors (stdin overflow could bypass config-protection; secret leakage in observe-post)
- **Phase 2 second**: Data loss prevention (orphan sessions lose data; cost estimation affects billing tracking)
- **Phase 3-5**: Improve confidence but lower risk of actual failures

## Implementation Notes

- New test files needed: parse-stdin.test.ts, evaluate-patterns-shared.test.ts
- All other tests add cases to existing test files
- All hook tests use execFileSync pattern (already established)
- Core lib tests use :memory: SQLite (already established)
- Target: 328 + ~60 = ~388 tests
