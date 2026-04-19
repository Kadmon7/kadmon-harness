---
number: 18
title: Port 4 ECC Features (decay, user-correction, rubric, cross-project promotion)
date: 2026-04-19
status: pending
needs_tdd: true
route: B
adr: none
---

# Plan 018: Port 4 ECC Features [konstruct]

## Overview

Port 4 features from ECC's `continuous-learning-v2` Python skill into the Kadmon Harness TypeScript pipeline: (1) confidence decay at `-0.02/week` for silent instincts, (2) a new `user_correction` pattern detector, (3) a 1-paragraph rubric insertion in `alchemik.md`, and (4) cross-project auto-promotion of instincts observed in 2+ projects with avg confidence >= 0.8. Features 1, 2, and 4 require TDD; feature 3 is a pure prose edit. Each phase is independently mergeable — schema migration ships first so existing `~/.kadmon/kadmon.db` installs keep working from commit #1 onward.

## Assumptions

- ADR-002 "no Python in the harness" stands — all 4 features must be implemented in TypeScript. Validated verbally in the input; no rewrite of the ADR needed.
- The existing `instincts` table migration pattern (`scripts/migrate-v0.3.ts`) is the blueprint for Phase 1 — `try/catch` around `ALTER TABLE ADD COLUMN`, tolerate "duplicate column" / "already exists" errors, idempotent on re-run. Validated by reading `scripts/migrate-v0.3.ts` + `scripts/migrate-v0.4.ts`.
- `schema.sql` is applied on every `openDb()` (the big transaction-wrapped loop at `state-store.ts:181-185`), but statements use `CREATE TABLE IF NOT EXISTS` — they do NOT reapply `ALTER TABLE`. Therefore: **both** places must be updated — `schema.sql` (fresh installs) **and** `migrate-v0.5.ts` (existing installs). This is exactly the v0.3 playbook.
- `last_observed_at` semantics: set to `nowISO()` whenever an instinct is reinforced (i.e. matched by a triggered pattern in `/forge`). Created instincts start with `last_observed_at = createdAt`. Decay applies only to `status = 'active'` rows — promoted/archived/contradicted are frozen.
- Decay is triggered from inside `/forge` (before the preview gate) so the user sees the post-decay state. Alternative — a standalone hook — rejected because decay must be deterministic relative to the observation event loop, not wall-clock scheduler time.
- Cross-project promotion identity: two instincts "match" when `normalizedPattern(a) === normalizedPattern(b)` where `normalizedPattern` lowercases + trims + collapses whitespace. NOT semantic similarity — that's v2 territory and would require embeddings. Simple string match is sufficient for the harness's current instinct catalog (10 active per CLAUDE.md).
- The `scope: 'global'` column already exists (schema.sql line 37) with a CHECK constraint — no schema change needed for Feature 4. The promotion writes `scope = 'global'` via `upsertInstinct`.
- `pattern-definitions.json` currently has 12 definitions — adding a 13th `user_correction` definition does not break the loader; `PatternDefinition` union in `types.ts` covers 5 types; we add a 6th (`user_correction`) or reuse `tool_arg_presence` with a new metadata key. **Decision**: reuse `tool_arg_presence` against `UserMessage` observations, because ECC's approach is a stateful sequence (user says X then Claude changes approach) and our pattern-engine's existing detectors can express this with minor extension.
- Windows Git Bash constraints: `npx tsx -e` produces no output on Windows (CLAUDE.md pitfall #9) — tests must use `execFileSync` with temp script files if CLI verification is needed. Unit tests via `npx vitest run` work normally.
- Baseline before Phase 1: 609 tests passing, 59 test files (CLAUDE.md Status line). Capture exact count in the first commit body.

## Phase 0: Research

- [x] Read `scripts/lib/instinct-manager.ts` — current lifecycle (createInstinct / reinforceInstinct / contradictInstinct / promoteInstinct / pruneInstincts / getInstinctSummary). Promotion guard: `confidence >= 0.7 AND occurrences >= 3`.
- [x] Read `scripts/lib/state-store.ts` — WrappedDb + openDb schema loop + upsertInstinct + mapInstinctRow. camelCase <-> snake_case conversion lives here exclusively.
- [x] Read `scripts/lib/pattern-engine.ts` — 5 existing detectors: sequence / command_sequence / cluster / file_sequence / tool_arg_presence. Orchestrator: `evaluatePatterns(definitions, toolSeq, lines)`.
- [x] Read `scripts/lib/forge-pipeline.ts` — 5-step pipeline (read -> extract -> project -> evaluate -> cluster). `applyForgePreview` is the ONLY DB mutator. Thresholds mirror instinct-manager constants.
- [x] Read `scripts/lib/types.ts` — `Instinct`, `PatternDefinition` union (5 variants), `PatternResult`, `ClusterReport`.
- [x] Read `.claude/hooks/pattern-definitions.json` — 12 definitions. 10 file_sequence + 1 tool_arg_presence + 1 cluster.
- [x] Read `.claude/agents/alchemik.md` — insertion point for Feature 3 rubric: section "## Evolution Categories" (after line 123) is the natural home for the workflow->command / behavior->skill / process->agent heuristic.
- [x] Read `scripts/lib/schema.sql` + `scripts/migrate-v0.3.ts` + `scripts/migrate-v0.4.ts` — confirm ALTER TABLE pattern with idempotent try/catch.
- [x] Read `tests/lib/instinct-manager.test.ts` — structure for extending (beforeEach openDb :memory:, afterEach closeDb).
- [x] Read ECC reference `C:\Users\kadmo\AppData\Local\Temp\ecc\skills\continuous-learning-v2\scripts\instinct-cli.py` lines 1-380 — PROMOTE_CONFIDENCE_THRESHOLD = 0.8, PROMOTE_MIN_PROJECTS = 2 (their values — we'll adopt). Their decay logic is elsewhere in the file; they reference `confidence -= DECAY_PER_WEEK`.
- [ ] Run `npm run build && npx vitest run && npx tsc --noEmit` to capture green baseline. Record in commit #1 body.

## Phase 1: Confidence Decay (MVP, independently mergeable)

Ships the `last_observed_at` column (schema + migration) and the decay function. At the end of Phase 1, the harness can decay stale instincts — but nothing triggers it automatically yet. Still mergeable: the column + decay function are additive, tested, and no existing behavior changes.

### Step 1.1 - Capture baseline + read remaining files (S)

- File: none (command only)
- Action: Run `npm run build && npx vitest run && npx tsc --noEmit`. Record `<N> tests passing, <M> test files`.
- Verify: Output shows green. Copy counts into the Phase 1 commit body.
- Depends on: none
- Risk: Low

### Step 1.2 - Extend schema.sql with last_observed_at (S)

- File: `scripts/lib/schema.sql`
- Action: Add one line inside `CREATE TABLE IF NOT EXISTS instincts (...)` after `updated_at`: `  last_observed_at TEXT`. No DEFAULT clause — NULL means "never observed post-migration" and decay treats NULL as `COALESCE(last_observed_at, updated_at)`.
- Verify: `npx tsx --eval "import('./dist/scripts/lib/state-store.js').then(m => m.openDb(':memory:').then(() => console.log('ok')))"` runs without error. On Windows, wrap in a temp `.mjs` file and `node` it instead (CLAUDE.md pitfall #9).
- Depends on: 1.1
- Risk: Low — fresh installs only. Existing installs still need 1.3.

### Step 1.3 - Write migration script migrate-v0.5.ts (S)

- File: `scripts/migrate-v0.5.ts` (new)
- Action: Copy the shape of `scripts/migrate-v0.3.ts` exactly. One migration entry: `{ name: "instincts.last_observed_at", sql: "ALTER TABLE instincts ADD COLUMN last_observed_at TEXT" }`. Same try/catch around "duplicate column" / "already exists". Same CLI: `process.argv[2]` optional dbPath.
- Verify: `npx tsx scripts/migrate-v0.5.ts /tmp/test.db` on a fresh empty db succeeds; re-run shows "Skipped (already exists)". On Windows use `node` + compiled output if tsx is flaky: `npm run build && node dist/scripts/migrate-v0.5.js`.
- Depends on: 1.2
- Risk: Medium — if the ALTER fails on an existing production DB, no prod data is lost (column is additive), but the decay feature would silently no-op. Mitigation: test against a copy of `~/.kadmon/kadmon.db` before the real migration.

### Step 1.4 - Add decay constants + types (S)

- File: `scripts/lib/types.ts`
- Action: Add `lastObservedAt?: string` to the `Instinct` interface (optional, ISO 8601, between `updatedAt` and `promotedTo`). Add a JSDoc comment: `/** ISO 8601 of most recent observation that matched this instinct. Seeds decay. Undefined for pre-v0.5 rows. */`.
- Verify: `npx tsc --noEmit` green.
- Depends on: 1.3
- Risk: Low — optional field, no breaking change to producers.

### Step 1.5 - Update mapInstinctRow + upsertInstinct in state-store (S)

- File: `scripts/lib/state-store.ts`
- Action:
  - In `mapInstinctRow` (line 366): add `lastObservedAt: row.last_observed_at ? String(row.last_observed_at) : undefined,`
  - In `upsertInstinct` (line 385-423): add `last_observed_at` to the INSERT column list, VALUES list, ON CONFLICT update clause, and the `.run({...})` params object: `last_observed_at: instinct.lastObservedAt ?? null`.
- Verify: `npx tsc --noEmit` green + `npx vitest run tests/lib/instinct-manager.test.ts` all 609+ pass unchanged (the field is optional, legacy tests don't set it).
- Depends on: 1.4
- Risk: Low — defensive coding; `?? null` handles the undefined case.

### Step 1.6 - TDD: decayInstincts RED test (S)

- File: `tests/lib/instinct-manager.test.ts`
- Action: Append a new `describe("decayInstincts", () => {...})` block (after the existing suite). Add 3 initial failing tests:
  1. `"decays a stale instinct by 0.02 per week since last_observed_at"` — create instinct, manually set `lastObservedAt` to 14 days ago via direct upsert, call `decayInstincts(projectHash)`, assert confidence dropped by exactly 0.04.
  2. `"does not decay below 0.0 (clamped)"` — instinct at 0.05 with 100 weeks stale, after decay is exactly 0.0.
  3. `"skips promoted/archived/contradicted instincts"` — 3 non-active instincts, all untouched after decay.
- Verify: `npx vitest run tests/lib/instinct-manager.test.ts` — 3 NEW failures, all existing pass. Record the red.
- Depends on: 1.5
- Risk: Low — pure test definition.

### Step 1.7 - TDD: implement decayInstincts (GREEN) (M)

- File: `scripts/lib/instinct-manager.ts`
- Action: Add exported function `decayInstincts(projectHash: string, now: Date = new Date()): { decayed: number; totalLoss: number }`. Algorithm:
  1. Select all rows `WHERE project_hash = ? AND status = 'active'` via `getDb().prepare(...)`.
  2. For each row, compute `baseline = row.last_observed_at ?? row.updated_at`. Parse to Date. Skip if invalid.
  3. `weeksSince = (now.getTime() - baseline.getTime()) / (7 * 24 * 60 * 60 * 1000)`. If `weeksSince < 1`, skip (only full weeks decay — prevents thrashing on active instincts).
  4. `decayAmount = Math.floor(weeksSince) * 0.02`. `newConfidence = Math.max(0, Math.round((row.confidence - decayAmount) * 100) / 100)`.
  5. If `newConfidence !== row.confidence`, `UPDATE instincts SET confidence = @new, updated_at = @now WHERE id = @id`. `last_observed_at` is NOT touched (it's the baseline, not a write timestamp).
  6. Return `{ decayed, totalLoss }`.
- Constants: top of file, `const DECAY_PER_WEEK = 0.02;` (matches ECC exactly per context).
- Verify: `npx vitest run tests/lib/instinct-manager.test.ts` — all green. `npx tsc --noEmit` green.
- Depends on: 1.6
- Risk: Medium — off-by-one on the week boundary is easy. Mitigation: the `< 1 week skip` explicitly + 3 test cases cover 0, 2, 100 weeks. Add one more edge case test if drift seen in CI.

### Step 1.8 - Wire last_observed_at writes in forge-pipeline (S)

- File: `scripts/lib/forge-pipeline.ts`
- Action:
  - In `projectInMemory` (line 209): on `reinforce` branch, the `after: Instinct` object gets `lastObservedAt: now` in addition to `updatedAt: now`.
  - On `create` branch: `fresh` gets `lastObservedAt: now` in addition to `createdAt: now`.
- Verify: Add one test in `tests/lib/forge-pipeline.test.ts` (if it exists; otherwise `tests/lib/instinct-manager.test.ts`) asserting a reinforced instinct has `lastObservedAt === updatedAt` after pipeline run. `npx vitest run` green.
- Depends on: 1.7
- Risk: Low — single-line additions in pure projection.

### Step 1.9 - Commit Phase 1 (full tier)

- Scope: production TypeScript + DB migration + tests.
- /chekpoint tier: **full** (production code in scripts/lib/, DB schema change -> orakle MANDATORY, ts-reviewer on .ts).
- Commit message: `feat(instincts): add last_observed_at column + confidence decay (ECC port 1/4)`
- Body includes: `Reviewed: full`, baseline test count (609->612 expected), migration path documented.

## Phase 2: User-Correction Pattern Detector

Adds a 13th pattern definition and extends `pattern-engine.ts` with a new detector type. Independently mergeable — does nothing until observations contain user message events (which they will, because Claude Code already emits them; we just need to detect them).

### Step 2.1 - Read observe-pre.js to confirm user-message capture (S)

- File: `.claude/hooks/scripts/observe-pre.js` (read only)
- Action: Grep for `eventType` emission — confirm there's a `UserMessage` or equivalent event kind in the JSONL. If not, the detector must match on Claude's "change of approach" signal instead (tool pattern change after a specific tool call).
- Verify: Identified the actual shape of the user-message event in observations.jsonl. Document it in the step 2.2 spec.
- Depends on: Phase 1 merged
- Risk: Medium — if Claude Code doesn't emit user messages in observations, the detector design needs a fallback. Mitigation: grep actual observations.jsonl from a recent session at `$TEMP/kadmon/<sessionId>/observations.jsonl` to ground-truth.

### Step 2.2 - Add user_correction to PatternDefinition union (S)

- File: `scripts/lib/types.ts` (line 316-364)
- Action: Add a 6th variant to `PatternDefinition` union:
  ```typescript
  | {
      type: "user_correction";
      name: string;
      action: string;
      correctionMarkers: string[]; // ["no asi", "stop", "don't", "undo", "esto esta mal", ...]
      threshold: number;
      domain?: string;
    }
  ```
- Verify: `npx tsc --noEmit` green. `evaluatePatterns` switch in pattern-engine.ts has a non-exhaustive-check -> expect a TS error forcing us to handle the new variant in 2.4 (treat this as RED).
- Depends on: 2.1
- Risk: Low — union extension is additive.

### Step 2.3 - TDD: detectUserCorrectionPattern RED test (S)

- File: `tests/lib/pattern-engine.test.ts`
- Action: Append new `describe("detectUserCorrectionPattern", () => {...})`. Tests:
  1. Counts 1 correction when lines contain a user message with "no asi" followed within 5 tool calls by a different tool sequence than before.
  2. Returns 0 when correction markers are present but no tool-sequence change follows.
  3. Returns 0 when no correction markers match.
  4. Handles multiple corrections in one session (counts each).
- Shape of input `lines`: JSONL events with `eventType: "user_message", text: "..."` (or whatever 2.1 revealed), followed by `tool_pre` events.
- Verify: Tests fail because the detector function doesn't exist yet.
- Depends on: 2.2
- Risk: Low — test scaffolding.

### Step 2.4 - TDD: implement detectUserCorrectionPattern (GREEN) (M)

- File: `scripts/lib/pattern-engine.ts`
- Action:
  1. Add exported function `detectUserCorrectionPattern(lines: string[], def: { correctionMarkers: string[] }): number`. Algorithm:
     - Walk events chronologically.
     - When a user-message event matches a marker (case-insensitive substring), record the next tool call's name. If within 5 tool calls the tool sequence differs meaningfully from the 5 tool calls immediately before the message, count = +1.
     - "Differs meaningfully": at least one new tool name in the after-window that wasn't in the before-window. Keep it simple — this is v1 heuristic, not semantic analysis.
  2. Extend `evaluatePatterns` switch with `case "user_correction": count = detectUserCorrectionPattern(lines, { correctionMarkers: def.correctionMarkers }); break;`
- Verify: `npx vitest run tests/lib/pattern-engine.test.ts` all green. `npx tsc --noEmit` green.
- Depends on: 2.3
- Risk: Medium — the "meaningful change" heuristic is the soft part. Keep the v1 simple; tune with real observations in Phase 2 follow-up.

### Step 2.5 - Add user_correction definition to pattern-definitions.json (S)

- File: `.claude/hooks/pattern-definitions.json`
- Action: Append a 13th entry:
  ```json
  {
    "type": "user_correction",
    "name": "User correction followed by approach change",
    "action": "When the user corrects you, read memory/feedback_*.md before the next tool call and adjust. Don't batch corrections to commit time.",
    "correctionMarkers": ["no asi", "stop", "don't", "undo", "esto esta mal", "no así", "esto está mal", "wrong", "incorrect"],
    "threshold": 1,
    "domain": "learning-meta"
  }
  ```
- Verify: `node -e "JSON.parse(require('fs').readFileSync('.claude/hooks/pattern-definitions.json', 'utf8'))"` succeeds (valid JSON). `npx vitest run` — no regressions in pattern-engine tests.
- Depends on: 2.4
- Risk: Low — JSON append.

### Step 2.6 - Commit Phase 2 (full tier)

- Scope: production TS + new pattern type + JSON config.
- /chekpoint tier: **full** (production TS in scripts/lib/, pattern engine is core learning infrastructure).
- Commit message: `feat(pattern-engine): add user_correction detector (ECC port 2/4)`
- Body: `Reviewed: full`, test count delta.

## Phase 3: Evolve Artifact Rubric (trivial, skip tier)

### Step 3.1 - Insert rubric in alchemik.md (S)

- File: `.claude/agents/alchemik.md`
- Action: Insert a new subsection "### Rubric: which artifact to propose?" between the "## Evolution Categories" table (line 123-132) and the "## Output Format" section (line 134). Content:

  ```markdown
  ### Rubric: which artifact to propose?

  Before emitting a proposal, apply this heuristic to choose the artifact type:

  | Cluster shape | Propose |
  |---|---|
  | **Workflow sequence** — same ordered series of tools/commands repeated across sessions | `CREATE_COMMAND` (wrap the sequence in a single invocation) |
  | **Auto-triggered behavior** — pattern that should fire on a file edit, tool call, or observation | `CREATE_RULE` (if enforceable by hook) or `PROMOTE` (if it's reference knowledge) |
  | **Multi-step process requiring reasoning** — decisions that depend on context, not deterministic sequences | `CREATE_AGENT` (model = sonnet unless arch/security/planning -> opus) |
  | **Single reusable pattern** — one technique to apply in a specific situation | `PROMOTE` to skill |
  | **Measurable performance/cost gap** | `OPTIMIZE` (existing component tweak) |

  When two categories fit, prefer the smaller surface: `PROMOTE` < `CREATE_RULE` < `CREATE_COMMAND` < `CREATE_AGENT`.
  ```

- Verify: Read back the file and confirm the table renders correctly in markdown. No code change -> `npm run build` not required.
- Depends on: none (pure prose, parallel-safe with Phase 1/2)
- Risk: Low.

### Step 3.2 - Commit Phase 3 (skip tier)

- Scope: 1 file, agent prompt, ~10 lines of prose.
- /chekpoint tier: **skip** (docs-only / agent frontmatter metadata adjacent — per development-workflow.md table, this is "agent frontmatter metadata (`model:`, `tools:`)" adjacent and falls under the agent prompt edit docs-only conventions; body change only, no code, no tests).
- Commit message: `docs(alchemik): add artifact-choice rubric to evolution categories (ECC port 3/4)`
- Body: `Reviewed: skip (verified mechanically)`, rationale = prose-only in agent prompt.

## Phase 4: Cross-Project Promotion

### Step 4.1 - Design: where does promotion run? (S, decision step)

- File: none (decision captured in this step's Verify)
- Options:
  - **A.** New pipeline step inside `/forge` preview (step 5.5 — between cluster and preview gate).
  - **B.** Standalone script `scripts/cross-project-promote.ts` that runs ad-hoc.
  - **C.** Invoked from `/evolve` step 6 (Generate) before proposal emission.
- **Recommendation: Option A** — `/forge` is where promotion already happens (intra-project). Cross-project is the natural extension. The preview gate already shows create/reinforce/promote/prune rows; add a "Would promote (scope change)" section. Rejected B because it creates a new command surface for the user to remember. Rejected C because `/evolve` is experimental (through 2026-04-28) and the promotion is independently useful.
- Verify: Decision recorded in commit body. No code yet.
- Depends on: Phase 1 + Phase 2 merged (cleaner diff against stable base).
- Risk: Low.

### Step 4.2 - Add getCrossProjectPromotionCandidates to state-store (M)

- File: `scripts/lib/state-store.ts`
- Action: Add exported function:
  ```typescript
  export function getCrossProjectPromotionCandidates(
    minProjects: number = 2,
    minAvgConfidence: number = 0.8,
  ): Array<{
    normalizedPattern: string;
    projectCount: number;
    avgConfidence: number;
    totalOccurrences: number;
    instinctIds: string[];
  }>
  ```
- SQL strategy: SELECT all `status = 'active' AND scope = 'project'` instincts, GROUP BY the normalized pattern (compute in app layer since SQLite LOWER is ASCII-only and we want Unicode-safe). Return groups where `COUNT(DISTINCT project_hash) >= minProjects AND AVG(confidence) >= minAvgConfidence`.
- normalizedPattern: `pattern.trim().toLowerCase().replace(/\s+/g, ' ')`.
- Verify: Unit test in `tests/lib/state-store.test.ts` (or new `tests/lib/cross-project-promotion.test.ts`) covering:
  1. Single-project pattern -> NOT a candidate.
  2. Two projects, both conf >= 0.8 -> IS a candidate, returns avg correctly.
  3. Two projects, avg < 0.8 -> NOT a candidate.
  4. Already global -> excluded from pool.
  5. Pattern differing only by whitespace/case -> matched as same.
- Depends on: 4.1
- Risk: Medium — SQL with GROUP BY on a computed column requires app-side grouping. Make sure the test covers the normalization.

### Step 4.3 - TDD: promoteToGlobal function (RED + GREEN) (M)

- File: `scripts/lib/instinct-manager.ts`
- Action: Add exported function `promoteToGlobal(instinctIds: string[]): number`. Calls `upsertInstinct` with `scope: 'global'` for each id. Returns count promoted. Guard: skip if already global.
- Tests in `tests/lib/instinct-manager.test.ts`:
  1. Promotes project-scope instinct to global.
  2. Skips already-global (idempotent).
  3. Skips non-existent id (returns 0, no throw).
- Verify: RED first (function doesn't exist), then GREEN. `npx vitest run` all pass.
- Depends on: 4.2
- Risk: Low.

### Step 4.4 - Extend ForgePreview + pipeline (M)

- File: `scripts/lib/forge-pipeline.ts`
- Action:
  1. Add `scopePromote: Array<{ instinctId: string; fromScope: 'project'; toScope: 'global'; rationale: string }>` to `ForgePreview.would`.
  2. Add `scopePromoted: number` to `ForgePreview.totals`.
  3. In `runForgePipeline`, after step 4 (evaluateRecommendations), call `getCrossProjectPromotionCandidates()` and build the scopePromote array. Filter out any instincts already slated for regular `promote` to avoid double-counting.
  4. In `applyForgePreview`, after the promote loop, iterate `scopePromote` and call `upsertInstinct({ ...inst, scope: 'global' })`.
- Verify: Integration test in `tests/lib/forge-pipeline.test.ts`:
  - Seed 2 projects (projA, projB) each with an instinct `pattern = "commit before push"` at confidence 0.8.
  - Run pipeline for projA.
  - Assert `preview.would.scopePromote.length >= 1`.
  - Call `applyForgePreview`. Assert both instincts now have `scope: 'global'`.
- Depends on: 4.3
- Risk: Medium — the filter against regular `promote` needs care; an instinct can be both "promotable to skill" and "cross-project promotable to global scope". These are orthogonal — a scope change is not the same as a status change. Double-check: they should be emitted as separate sections, but both can apply to the same id.

### Step 4.5 - Extend /forge preview gate rendering (S)

- File: `.claude/commands/forge.md` (prose only) + wherever the preview gate is rendered in code (search via `Would reinforce`).
- Action: After the "Would promote" table in the preview, add:
  ```
  ### Would promote (scope change) (N)
  | instinct | current scope | would become | reason |
  |---|---|---|---|
  | Pattern X | project | global | Matches in 2 projects, avg confidence 0.85 |
  ```
- Verify: Manual /forge --dry-run after Phase 4 merges — if there are real cross-project candidates in the dev DB, they appear. Otherwise the section renders empty `(none)`.
- Depends on: 4.4
- Risk: Low — rendering layer only.

### Step 4.6 - Commit Phase 4 (full tier)

- Scope: production TS in state-store, instinct-manager, forge-pipeline + tests + forge.md.
- /chekpoint tier: **full** (production code, new pipeline step, SQL query -> orakle MANDATORY).
- Commit message: `feat(forge): cross-project instinct promotion via scope change (ECC port 4/4)`
- Body: `Reviewed: full`, test count delta.

## Testing Strategy

### Unit
- `tests/lib/instinct-manager.test.ts` — new `describe("decayInstincts", ...)` block (3+ tests), new `describe("promoteToGlobal", ...)` block (3 tests).
- `tests/lib/pattern-engine.test.ts` — new `describe("detectUserCorrectionPattern", ...)` block (4 tests).
- `tests/lib/state-store.test.ts` or new `tests/lib/cross-project-promotion.test.ts` — 5 tests for the candidate query.

### Integration
- `tests/lib/forge-pipeline.test.ts` — end-to-end: 2-project seed -> runForgePipeline -> assert scopePromote populated -> applyForgePreview -> assert DB state. Plus: a decayed instinct surfaces in `would.prune` if decay dropped it under 0.2.

### Migration
- Manual: copy current `~/.kadmon/kadmon.db` to `/tmp/kadmon-test.db`, run `npx tsx scripts/migrate-v0.5.ts /tmp/kadmon-test.db`, verify column exists via `PRAGMA table_info(instincts)`. Re-run shows idempotent "Skipped".

### Regression
- `npx vitest run` full suite — baseline 609 passing should grow to ~620-625 (plan adds ~12-15 tests).
- `npx tsc --noEmit` must stay green at every commit.

## Risks & Mitigations

- **Risk**: `ALTER TABLE ADD COLUMN` on `~/.kadmon/kadmon.db` fails mid-migration on a user's machine, leaving a partially-migrated DB.
  **Mitigation**: Migration is single-column-additive — worst case the column isn't added, decay no-ops, no data loss. `backup-rotate.js` already maintains 3 timestamped backups per session-start. Document in commit body: "If migration fails, restore from `~/.kadmon/kadmon.db.bak.*`."

- **Risk**: Cross-project promotion fires too aggressively and globalizes project-specific noise.
  **Mitigation**: Start with ECC's conservative thresholds (`2 projects AND avg conf >= 0.8`). These values live as constants at the top of state-store.ts and can be bumped without a schema change. Flag in preview gate includes the rationale ("Matches in 2 projects, avg 0.85") so the user sees the evidence before approving.

- **Risk**: `detectUserCorrectionPattern` produces false positives from codebase-mentioned strings ("don't use any", "stop running tests"). Markers match too loosely.
  **Mitigation**: Only check `user_message` event types, not tool commands. The detector does not scan Bash commands or file contents. Plus the "approach change" requirement filters out cases where the user quoted a correction but Claude kept the same path.

- **Risk**: Decay + reinforcement race — an instinct reinforced mid-week gets decayed back by the Phase 1 / Phase 4 boundary.
  **Mitigation**: Decay uses `Math.floor(weeksSince)` — fractional weeks don't decay. Reinforcement updates `last_observed_at`, resetting the clock. This matches ECC semantics exactly.

- **Risk**: Pattern-engine regression from adding a 6th variant to the union — a missing `case` branch in `evaluatePatterns` silently returns count=0.
  **Mitigation**: TypeScript strict mode catches unhandled union variants at compile time because the switch has no `default` (it falls through and `count` keeps its initial 0). The `npx tsc --noEmit` green check is the gate.

- **Risk**: Schema change in `schema.sql` applied to a DB that also ran migrate-v0.5.ts duplicates the ALTER — but since schema.sql uses `CREATE TABLE IF NOT EXISTS`, the new column inside the CREATE is only applied on fresh install. No conflict.
  **Mitigation**: Already handled by SQLite semantics; documented explicitly in Assumptions.

## Success Criteria

- [ ] `instincts` table has `last_observed_at TEXT` column on both fresh installs (via schema.sql) and existing installs (via migrate-v0.5.ts).
- [ ] `decayInstincts(projectHash)` reduces active-instinct confidence by 0.02 per full week since `last_observed_at`, clamped to `[0, originalConfidence]`.
- [ ] `/forge` reinforcement writes `last_observed_at = nowISO()` to both created and reinforced instincts.
- [ ] `.claude/hooks/pattern-definitions.json` has 13 entries; the 13th is `user_correction` type.
- [ ] `evaluatePatterns` handles `user_correction` and returns accurate counts on seeded test fixtures.
- [ ] `alchemik.md` contains the "Rubric: which artifact to propose?" table between Evolution Categories and Output Format.
- [ ] `/forge` preview gate includes a "Would promote (scope change)" section when 2+ projects share an instinct at avg conf >= 0.8.
- [ ] `applyForgePreview` changes `scope: 'project' -> 'global'` for approved cross-project promotions.
- [ ] `npx vitest run` passes (target: 620+ tests, delta +11 to +15 from 609 baseline).
- [ ] `npx tsc --noEmit` passes at every commit.
- [ ] All 4 commits follow conventional-commit format + `Reviewed: <tier>` footer.

## Commit Strategy

| # | Phase | Commit message | Files touched | Tier |
|---|-------|---------------|---------------|------|
| 1 | Phase 1 | `feat(instincts): add last_observed_at column + confidence decay (ECC port 1/4)` | schema.sql, migrate-v0.5.ts (new), types.ts, state-store.ts, instinct-manager.ts, forge-pipeline.ts, tests/lib/instinct-manager.test.ts | full |
| 2 | Phase 2 | `feat(pattern-engine): add user_correction detector (ECC port 2/4)` | types.ts, pattern-engine.ts, .claude/hooks/pattern-definitions.json, tests/lib/pattern-engine.test.ts | full |
| 3 | Phase 3 | `docs(alchemik): add artifact-choice rubric to evolution categories (ECC port 3/4)` | .claude/agents/alchemik.md | skip |
| 4 | Phase 4 | `feat(forge): cross-project instinct promotion via scope change (ECC port 4/4)` | state-store.ts, instinct-manager.ts, forge-pipeline.ts, .claude/commands/forge.md, tests/lib/{instinct-manager,forge-pipeline,cross-project-promotion}.test.ts | full |

Each commit is independently mergeable. Phase 1 ships schema + decay. Phase 2 ships detection. Phase 3 ships the rubric. Phase 4 ships cross-project promotion. Reverting any phase does not block the others (Phase 4 depends on Phase 1's `last_observed_at` column only implicitly — it queries `confidence` and `scope`, both of which pre-existed).
