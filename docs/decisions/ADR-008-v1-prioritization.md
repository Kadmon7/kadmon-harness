# ADR-008: v1.0 Roadmap Prioritization Framework

## Status
Accepted

## Context

The Kadmon Harness is at v0.3 (consolidated) with 161 tests, 20 hooks, 14 agents,
20 skills, and 18 commands. The v1.0 gate criterion is:

> **Use the harness on a real ToratNetz feature without anything breaking.**

The roadmap at `docs/roadmap/v1.0-production.md` contains ~35 pending items across
8 categories. Without prioritization, there is a risk of either:

1. Working on low-impact items while blockers remain, delaying the gate.
2. Attempting everything at once, losing focus and accumulating half-finished work.

This ADR establishes a prioritization framework (P0/P1/P2) and a recommended
execution order that targets the gate criterion efficiently.

### Key Constraints
- Single developer (Ych-Kadmon) with Claude Code as implementer.
- Windows + Git Bash environment (some items are Windows-specific).
- Context window budget: 18K always-loaded (9% of 200K) leaves ample room.
- The harness is infrastructure, not product -- quality matters over feature count.

## Options Considered

### Option A: Linear execution (roadmap order)
- **Pros**: Simple, no decision overhead, categories are already logical groupings.
- **Cons**: Categories mix critical and optional items. Session continuity work before
  hook reliability means building features on an unreliable foundation. Multi-project
  foundation items (the actual gate) are category 7 of 8.

### Option B: Priority-tiered execution (P0/P1/P2)
- **Pros**: Critical-path items first. Each tier produces a usable checkpoint. P0 alone
  enables the gate test. P1 de-risks it. P2 is quality-of-life that can wait.
- **Cons**: Requires upfront analysis (this ADR). Items from different categories
  interleave, which could feel scattered.

### Option C: Themed sprints (2-3 items per sprint, grouped by theme)
- **Pros**: Focused work sessions. Natural commit boundaries. Each sprint has a clear
  deliverable. Can combine with priority tiers.
- **Cons**: Sprint boundaries add ceremony. Some sprints may block on others.

## Decision

**Option B (priority tiers) with Option C (themed sprints) as the execution model.**

Prioritize by asking: "If I start a ToratNetz feature session right now, does this
item's absence cause (a) failure, (b) significant risk, or (c) inconvenience?"

- **P0** = failure: the harness breaks, data is lost, or the workflow cannot complete.
- **P1** = significant risk: things work but failures go unnoticed, or recovery is painful.
- **P2** = inconvenience: the session succeeds but with rough edges.

Within each tier, items are grouped into themed sprints of 2-4 items for focused
execution. Each sprint should be completable in one session and end with a commit.

---

## P0 — MUST for v1.0 Gate (12 items)

These items would cause failure or data loss during a real ToratNetz session.

### Sprint 1: Hook Reliability Foundation
**Why P0**: Lifecycle hooks import from `dist/`. If `dist/` is stale after editing
`scripts/lib/`, session-start, session-end-all, pre-compact-save, and evaluate-session
all fail silently (exit 0 with no useful work). This is the single most dangerous
failure mode -- the harness APPEARS to work but is not persisting sessions, evaluating
patterns, or tracking costs.

| Item | Roadmap Category | Justification |
|------|-----------------|---------------|
| Auto-build before lifecycle hooks | Hook reliability | 6 hooks dynamic-import from `dist/`. Silent failure on stale build. |
| Health check of `dist/` at session start | Hook reliability | Catch stale builds before they cause silent data loss. |
| Failed hook detection (hook-errors.log) | Hook reliability | Today hooks fail with exit(0) and nobody knows. |

**Deliverable**: Lifecycle hooks never silently fail. Stale `dist/` is auto-detected
and either auto-fixed or warned about visibly.

### Sprint 2: Critical Test Debt
**Why P0**: 5 lifecycle hooks (session-end-persist, session-end-all/cost-tracker,
evaluate-session, pre-compact-save, session-end-marker) have zero tests. These hooks
handle session persistence, cost tracking, pattern evaluation, and crash recovery.
Modifying them during v1.0 work without tests is reckless.

| Item | Roadmap Category | Justification |
|------|-----------------|---------------|
| Tests for `pre-compact-save.js` | Testing (critical debt) | Handles session state during compaction -- untested. |
| Tests for `cost-tracker.js` | Testing (critical debt) | Cost estimation logic -- untested. |
| Tests for `evaluate-session.js` | Testing (critical debt) | Pattern evaluation and instinct creation -- untested. |
| Tests for `session-end-persist.js` | Testing (critical debt) | Session cleanup and persistence -- untested. |
| Tests for `session-end-marker.js` | Testing (critical debt) | Clean-exit marker -- untested. |

**Deliverable**: All lifecycle hooks have at least basic test coverage (happy path +
error path). Enables safe modification going forward.

### Sprint 3: Multi-Project Foundation (Minimum Viable)
**Why P0**: This IS the gate. Cannot validate "use harness on ToratNetz" without these.

| Item | Roadmap Category | Justification |
|------|-----------------|---------------|
| Verify hooks work in other directories | Multi-project | Hooks use relative paths to `dist/`. Must work from ToratNetz dir. |
| Skeleton `.claude/` for ToratNetz | Multi-project | Minimum agents/rules/skills for Hebrew RAG + Supabase work. |
| Investigate SessionStart:compact error | Session continuity | Blocks reliable session continuity in any project. |
| Resolve sharing agents between projects | Multi-project | Without this, agent duplication across projects is mandatory. |

**Deliverable**: Can `cd` into a ToratNetz project directory and run a full
session (start, plan, implement, test, commit) using the harness.

---

## P1 — SHOULD for v1.0 (11 items)

These reduce risk significantly. The gate can technically pass without them,
but failures will be harder to diagnose or recover from.

### Sprint 4: Observability & Data Integrity
| Item | Roadmap Category | Justification |
|------|-----------------|---------------|
| Hook timeout monitoring | Hook reliability | Detect hooks exceeding latency budget before they degrade UX. |
| Full paths in session summary | Data quality | Critical for monorepo/multi-project: "index.ts" is ambiguous. |
| Clean test sessions from DB | Data quality | 25+ zero-message sessions pollute dashboard and queries. |
| Clean test-isolation dirs in `/tmp/kadmon/` | Data quality | ~60 dirs accumulating. Not a blocker but wastes disk. |

### Sprint 5: Tests for New Features
| Item | Roadmap Category | Justification |
|------|-----------------|---------------|
| Tests for git context in session-start | Testing (new features) | Validates the git context banner feature works. |
| Tests for `/tmp` cleanup logic | Testing (new features) | Validates UUID filtering and age-based cleanup. |
| Tests for pruneInstincts in session-start | Testing (new features) | Validates instinct pruning on startup. |
| Tests for observations cleanup in session-end | Testing (new features) | Validates observation file cleanup. |
| Tests for endSession in pre-compact-save | Testing (new features) | Validates session ending during compaction. |

### Sprint 6: Instinct Pipeline Validation
| Item | Roadmap Category | Justification |
|------|-----------------|---------------|
| E2E promotion pipeline test | Instincts & patterns | 10 instincts at 0.9 confidence, never promoted. Untested path. |
| Dashboard shows correct instincts post-prune | Instincts & patterns | Ensures dashboard reflects reality. |

---

## P2 — NICE for v1.0, Can Wait for v1.1 (12 items)

Quality-of-life improvements. The harness works without them.

### Documentation Sprint (v1.1)
| Item | Roadmap Category |
|------|-----------------|
| REFERENCE.md stale counts | Documentation debt |
| Audit directory update | Documentation debt |
| MCP count inconsistency | Documentation debt |
| Document Windows gotchas | Windows & environment |
| Troubleshooting guide | Windows & environment |
| Performance guide | Windows & environment |
| First-day guide | Windows & environment |

### Enhancement Sprint (v1.1)
| Item | Roadmap Category |
|------|-----------------|
| Persistent current task | Session continuity |
| Instinct warnings on pattern violation | Session continuity |
| Memory highlights in session banner | Session continuity |
| Expand pattern-definitions.json | Instincts & patterns |
| Instinct decay (time-based confidence loss) | Instincts & patterns |

### Deferred Data Quality (v1.1)
| Item | Roadmap Category |
|------|-----------------|
| Cost estimation validation | Data quality |
| Session archival policy (>90 days) | Data quality |
| Backup rotation (3-5 backups) | Data quality |

### Deferred Multi-Project (v1.1)
| Item | Roadmap Category |
|------|-----------------|
| KAIRON skeleton | Multi-project |

### Deferred Validation (v1.1)
| Item | Roadmap Category |
|------|-----------------|
| Run `/eval` on key agents | Agent validation |
| Measure orchestration chain effectiveness | Agent validation |

---

## Test-Isolation Cleanup: Analysis and Recommendation

**Priority: P1** (Sprint 4, data quality)

### Problem
Tests in `tests/hooks/session-start.test.ts` create directories under
`/tmp/kadmon/test-isolation-{timestamp}/`. The `session-start.js` cleanup logic
(line 341) explicitly SKIPS directories matching `test-isolation-*` prefix to avoid
deleting dirs that belong to a currently-running test. This means test-isolation
dirs accumulate indefinitely.

Other hook tests (`observe-pre`, `no-context-guard`, `ts-review-reminder`) use
timestamped session IDs (`test-obs-*`, `test-ncg-*`, `test-tsr-*`) and clean them
in `afterEach`. Those are not the problem.

### Root Cause
The `test-isolation-*` prefix was chosen specifically so session-start's cleanup
logic would not interfere with running tests. But no separate cleanup mechanism
exists for these directories after tests complete.

### Recommended Approach (Two-Prong)

1. **Vitest globalTeardown** (primary): Add a global teardown script in
   `vitest.config.ts` that removes all `/tmp/kadmon/test-isolation-*` directories
   after the full test suite finishes. This is authoritative -- the test runner
   knows when all tests are done.

   ```typescript
   // vitest.config.ts
   export default defineConfig({
     test: {
       globalTeardown: ['tests/global-teardown.ts'],
       // ... existing config
     }
   });
   ```

   ```typescript
   // tests/global-teardown.ts
   import fs from 'node:fs';
   import os from 'node:os';
   import path from 'node:path';

   export default function globalTeardown(): void {
     const kadmonTmp = path.join(os.tmpdir(), 'kadmon');
     if (!fs.existsSync(kadmonTmp)) return;
     for (const entry of fs.readdirSync(kadmonTmp)) {
       if (entry.startsWith('test-')) {
         fs.rmSync(path.join(kadmonTmp, entry), { recursive: true, force: true });
       }
     }
   }
   ```

2. **Session-start age-based cleanup** (secondary safety net): Modify the
   `session-start.js` cleanup to also remove `test-isolation-*` directories
   that are older than 24 hours. This catches leftovers from interrupted test
   runs where globalTeardown never executed.

   ```javascript
   // In session-start.js cleanup section:
   if (entry.startsWith("test-")) {
     const stat = fs.statSync(dirPath);
     if (stat.isDirectory() && now - stat.mtimeMs > 24 * 60 * 60 * 1000) {
       fs.rmSync(dirPath, { recursive: true, force: true });
     }
     continue;
   }
   ```

### Why Not Just afterEach?
The `afterEach` in `session-start.test.ts` already cleans up `OBS_DIR`
(`/tmp/kadmon/test-session-start-*`). The `test-isolation-*` dir is created inside
a specific test case (the DB isolation test) and is cleaned up within that test.
The issue is that if the test is interrupted or Vitest is killed, `afterEach` never
runs. GlobalTeardown is more resilient to this.

---

## MEMORY.md Capacity: Recommendation

The Feedback section is at 10/10. Three approaches:

1. **Consolidate overlapping entries**: Several feedback items overlap:
   - "Use project agents" + "Proactive agent/skill usage" could merge into one
     entry about always using the defined agent/skill system.
   - "Rich agent structure" + "K-naming convention" could merge into one entry
     about agent design standards.
   - This frees 2 slots without losing information.

2. **Graduate stable feedback to rules**: Feedback that has been consistently
   followed for 3+ sessions and is unlikely to change can be "graduated" -- the
   behavior is already encoded in `.claude/rules/` files (where it is enforced
   automatically) and the memory entry becomes redundant. Candidates:
   - "Use Unix pipes freely" -- already in `settings.local.json` permissions.
   - "Auto ADRs" -- already established pattern (this is ADR-008).
   - "ECC comparison approach" -- one-time adoption, already applied.

3. **Increase budget**: Change max from 10 to 12. But this risks MEMORY.md
   exceeding the 200-line total budget.

**Recommended**: Option 2 (graduate 2-3 entries) + Option 1 (consolidate 1-2
entries). This frees 3-5 slots without increasing the budget or losing signal.

---

## Recommended Execution Order

```
Sprint 1: Hook Reliability Foundation    [P0, ~1 session]
  -> Auto-build, dist/ health check, hook-errors.log

Sprint 2: Critical Test Debt             [P0, ~2 sessions]
  -> Tests for all 5 untested lifecycle hooks

Sprint 3: Multi-Project Foundation       [P0, ~2 sessions]
  -> Verify hooks cross-dir, ToratNetz skeleton, agent sharing

--- v1.0 GATE TEST ---
  -> Use harness on real ToratNetz feature

Sprint 4: Observability & Data Integrity [P1, ~1 session]
  -> Hook timeouts, full paths, clean test sessions/dirs

Sprint 5: New Feature Tests              [P1, ~1 session]
  -> Tests for git context, /tmp cleanup, pruneInstincts, etc.

Sprint 6: Instinct Pipeline              [P1, ~1 session]
  -> E2E promotion test, dashboard verification

--- v1.0 RELEASE ---

Sprints 7+: P2 items                     [v1.1 backlog]
```

The gate test happens AFTER Sprint 3, not after all P1 items. This is intentional:
the gate test itself will reveal which P1 items actually matter versus which are
theoretical. Real usage is a better prioritizer than speculation.

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Auto-build adds latency to session-start | Medium | Low | Only trigger if `dist/` mtime < `scripts/lib/` mtime. Cache check result. |
| ToratNetz skeleton delays because agent-sharing is hard | Medium | High | Fallback: copy agents (ugly but works). Investigate symlinks first. |
| Lifecycle hook tests are complex (sql.js + file IO + child process) | High | Medium | Use existing test patterns from `session-start.test.ts`. Use `:memory:` DB. |
| SessionStart:compact error is hard to reproduce | Medium | Medium | Add defensive try/catch and structured logging first, then chase root cause. |
| Gate test reveals unexpected blockers | Low | High | The whole point of the gate test. Budget 1 extra session for fixes. |

## Consequences

- **What changes**: Roadmap items get explicit priority labels. Work proceeds in
  themed sprints rather than category order. Multi-project foundation moves from
  category 7 to Sprint 3 (P0).
- **Migration**: Update `docs/roadmap/v1.0-production.md` with P0/P1/P2 labels
  after this ADR is accepted. No code changes from this ADR alone.
- **Risks**: If Sprint 1 (hook reliability) reveals deeper problems than expected,
  it could delay the entire timeline. Mitigation: time-box Sprint 1 to 1 session;
  if auto-build proves complex, start with the health-check warning (simpler) and
  defer full auto-build.
- **Review date**: After the v1.0 gate test. Re-evaluate P1 items based on what
  the gate test actually revealed.

## Checklist Verification

### Functional
- [x] Requirements documented: v1.0 gate criterion is clear and measurable.
- [x] User workflows mapped: session start -> plan -> implement -> test -> commit.
- [ ] API contracts: N/A (this is a prioritization decision, not a feature design).

### Technical
- [x] Component responsibilities clear: hooks, tests, multi-project each have owners.
- [x] Data flow documented: lifecycle hooks -> dist/ imports -> SQLite.
- [x] Error handling: hook-errors.log addresses the silent failure gap.
- [x] Testing strategy: Sprint 2 covers all untested lifecycle hooks.
- [x] Migration path: sprints are incremental, each produces a working checkpoint.

### Non-Functional
- [x] Performance: auto-build latency risk identified with mitigation.
- [x] Windows compatibility: hooks already use PATH prefix; cross-dir test will verify.
- [x] Observability: hook-errors.log and timeout monitoring in P0/P1.
