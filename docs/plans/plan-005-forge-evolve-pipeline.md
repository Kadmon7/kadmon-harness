---
number: 5
title: Refactor /instinct to /forge with unified pipeline
date: 2026-04-13
status: completed
completed_at: 2026-04-13
shipped_in: [6eae906, 0f609da, 5599694, dcc87fe, 0273ff3, 71c06a1, 5967ac4, 6a4fe16]
needs_tdd: true
route: A
adr: ADR-005-forge-evolve-pipeline.md
---

# Plan 005: Refactor /instinct to /forge with unified pipeline [konstruct]

## Summary

Rename the `/instinct` command to `/forge` (verb/noun split, data model untouched), collapse six subcommands into a single preview-gated pipeline (Read -> Extract -> Reinforce/Create -> Evaluate -> Cluster -> Gate -> Apply -> Report), add `ClusterReport` handoff contract for future `/evolve` step 6, and keep a deprecation alias until 2026-04-20. No SQL, no state-store, no hook changes. Full /chekpoint tier mandatory.

## Pre-flight checks

Verified during planning investigation — konstruct has already confirmed these, but implementer should re-verify before Step 1 in case of drift:

- [x] `.claude/commands/instinct.md` exists (104 lines) — skill definition lives **inline** in its frontmatter (`skills: [continuous-learning-v2]`), NOT in a separate file. **No skill-creator plugin invocation needed** — rename is a command-file rename only.
- [x] `scripts/lib/instinct-manager.ts:83` — `promoteInstinct` function exists, signature `(id: string, skillName: string) => Instinct | null`. NOT renamed by this plan.
- [x] `scripts/lib/state-store.ts:384-467` — `upsertInstinct`, `getInstinct`, `getActiveInstincts`, `getPromotableInstincts`, `getInstinctCounts` all present. NOT renamed.
- [x] `scripts/lib/types.ts:7-22` — `Instinct` interface at lines 7-22. `ClusterReport` will be appended immediately after (before `SessionSummary` at line 34).
- [x] `scripts/lib/dashboard.ts:382` — `\u2192 promote` hint string. One-word update target.
- [x] `CLAUDE.md:83` — "Evolve (3): /akademy, /instinct, /evolve" and `CLAUDE.md:41` ("instincts" in tree comment — descriptive, leave alone), `CLAUDE.md:134` ("instincts" SQLite tables — data-model noun, leave alone).
- [x] `.claude/rules/common/agents.md:98` — `/instinct        instinct lifecycle` in orchestration patterns table.
- [x] `.claude/rules/common/development-workflow.md:80` — `/instinct` row in command reference table.
- [x] `docs/roadmap/v1.1-learning-system.md:78` — `/instinct archive-old-sessions` reference in Sprint C retention item. Update slash to `/forge`.
- [x] Tests: `tests/lib/instinct-manager.test.ts`, `tests/eval/instinct-lifecycle-e2e.test.ts`, `tests/eval/phase1b-workflows-e2e.test.ts:178-259` all import `instinct-manager` by **module path** only — they do NOT invoke `/instinct` as a slash command. **No test rename required**; these tests are unaffected by the command rename.
- [x] Memory file `~/.claude/projects/C--Command-Center-Kadmon-Harness/memory/project_instinct_assessment.md` exists — update any `/instinct` occurrences.
- [x] No existing `.claude/commands/forge.md` and no existing `scripts/lib/forge-*` files (clean namespace).
- [ ] **To confirm at implementation time**: no in-flight uncommitted work touching `instinct-manager.ts`, `state-store.ts`, `dashboard.ts`, or the command files.

## Implementation steps

Sequential except where noted. Each step is independently revertable (single commit).

### Phase 1: Types and contract (foundation)

#### Step 1.1 — Add failing tests for ClusterReport types and round-trip (S)

- **Files**:
  - `tests/lib/cluster-report.test.ts` (new)
- **Tests to write** (all RED — imports do not exist yet):
  - `ClusterReport` JSON round-trip: construct a fixture, `JSON.stringify` -> parse -> deep-equal check, guard on `schemaVersion === 1`.
  - `meta` field round-trips without loss (write with arbitrary extra keys, read back intact).
  - `ClusterMemberRef.instinctId` is a string FK (type-level assertion via `expectTypeOf`).
  - Unknown `schemaVersion` rejected by consumer helper (covered in Step 2.3).
- **Verify**: `npx vitest run tests/lib/cluster-report.test.ts` — fails with import errors (expected).
- **Commit**: `test(forge): add failing tests for ClusterReport type and JSON round-trip`
- **Depends on**: none.

#### Step 1.2 — Add ClusterReport types to types.ts (S)

- **Files**:
  - `scripts/lib/types.ts` (append after line 22, before `SessionSummary`)
- **Content**: Copy the full `EvolutionCategory`, `ClusterMemberRef`, `Cluster`, `ClusterReport` interfaces from ADR-005 "Handoff Contract" section verbatim. Keep the JSDoc comments.
- **Verify**:
  - `npx tsc --noEmit` passes.
  - Tests from 1.1 now compile; the type-only assertions pass; the JSON round-trip still fails (no serializer yet).
- **Commit**: `feat(forge): add ClusterReport type contract to types.ts`
- **Depends on**: 1.1.

### Phase 2: Forge pipeline module (pure logic, TDD-driven)

#### Step 2.1 — Add failing tests for forge pipeline (M)

- **Files**:
  - `tests/lib/forge-pipeline.test.ts` (new)
- **Tests to write** (RED — module does not exist yet):
  - **Full pipeline round-trip**: `:memory:` SQLite + fixture observations JSONL -> run pipeline -> assert: active instincts updated, new instincts created at confidence 0.3, promotable rows flagged.
  - **Dry-run guarantees no mutation**: seed DB with instincts, run pipeline with `dryRun: true`, assert DB state is byte-identical before/after (compare `getActiveInstincts` + `getInstinctCounts`).
  - **Preview gate output structure**:
    - New instinct row appears in `would.create[]`.
    - Reinforced instinct (existing + new observation) appears in `would.reinforce[]`.
    - Promotable instinct (confidence >= 0.7, occurrences >= 3) appears in `would.promote[]`.
    - Contradicted instinct (contradictions > occurrences) appears in `would.prune[]`.
  - **Cluster report present in preview**: `result.clusterReport.clusters` non-empty when 2+ similar instincts seeded; `schemaVersion === 1`; `projectHash` and `sessionId` populated.
  - **Singleton instinct -> unclustered**: single active instinct ends up in `report.unclustered[]`, not `clusters[]`.
  - **Empty observations**: pipeline produces empty `would.*` and empty `clusters`, does NOT throw.
- **Verify**: `npx vitest run tests/lib/forge-pipeline.test.ts` fails with import errors (expected).
- **Commit**: `test(forge): add failing tests for unified pipeline and preview gate`
- **Depends on**: 1.2.

#### Step 2.2 — Implement forge pipeline module (greens) (L)

- **Files**:
  - `scripts/lib/forge-pipeline.ts` (new)
- **Public surface** (exported):
  ```typescript
  interface ForgePipelineOptions {
    projectHash: string;
    sessionId: string;
    dryRun?: boolean;
  }
  interface ForgePreview {
    would: {
      create: Instinct[];
      reinforce: Array<{ before: Instinct; after: Instinct }>;
      promote: Instinct[];
      prune: Instinct[];
    };
    clusterReport: ClusterReport;
    totals: { reinforced: number; created: number; promoted: number; pruned: number };
  }
  export function runForgePipeline(opts: ForgePipelineOptions): Promise<ForgePreview>;
  export function applyForgePreview(preview: ForgePreview, opts: ForgePipelineOptions): void;
  ```
- **Internals** (not exported, private functions):
  - `readObservationsForSession(sessionId)` — reads JSONL from temp dir. REUSE `evaluate-patterns-shared.js` logic if possible; import from `.claude/hooks/scripts/` if the module boundary allows, otherwise duplicate minimal read logic and add a TODO pointing at the shared module.
  - `extractCandidates(observations)` — pattern detection against `pattern-definitions.json` (same 13 definitions that `evaluate-patterns-shared` uses).
  - `reinforceOrCreate(candidates, projectHash, sessionId)` — mirrors `createInstinct` / `reinforceInstinct` in `instinct-manager.ts`. MUST NOT mutate DB during dry-run; compute `ForgePreview.would` from in-memory projection.
  - `evaluateRecommendations(instincts)` — computes promote/keep/prune recommendation per row using current thresholds (`confidence >= 0.7 && occurrences >= 3` for promote; `confidence < 0.2 && occurrences < 2` or `contradictions > occurrences` for prune).
  - `computeClusterReport(instincts, projectHash, sessionId)` — pure function over `Instinct[]` producing `ClusterReport`. Algorithm MVP: group by (normalized action-verb + domain) with Jaccard similarity on pattern-text tokens; singletons -> `unclustered`; `suggestedCategory` defaults to `PROMOTE` for clusters with `meanConfidence >= 0.7`, `CREATE_RULE` when domain is one of `typescript|python|sql`, else `OPTIMIZE`. O(n^2) over active instincts.
- **File size budget**: aim for < 300 lines; refactor if > 400.
- **Safety**:
  - NEVER call `upsertInstinct` or any state-store write from inside `runForgePipeline` — mutation lives exclusively in `applyForgePreview`.
  - `applyForgePreview` is the ONLY function that touches DB.
  - `runForgePipeline` is pure w.r.t. DB state when `dryRun` is either true OR false (dry-run vs apply split happens at the caller).
- **Verify**:
  - `npx vitest run tests/lib/forge-pipeline.test.ts` — all green.
  - `npx tsc --noEmit` passes.
  - `npx vitest run tests/lib/instinct-manager.test.ts tests/eval/instinct-lifecycle-e2e.test.ts` — still green (no regressions).
- **Commit**: `feat(forge): implement unified pipeline with preview gate and clustering`
- **Depends on**: 2.1.
- **Risk**: Medium. Clustering algorithm is MVP — the ADR explicitly says the algorithm is konstruct's call and alchemik may refine it in Sprint B. Keep it simple and well-commented.

### Phase 3: Report writer and export

#### Step 3.1 — Add failing tests for report writer and retention (S)

- **Files**:
  - `tests/lib/forge-report-writer.test.ts` (new)
- **Tests**:
  - Writes `forge-clusters-<sessionId>.json` to `os.tmpdir()`-based fixture path (NEVER the real `~/.kadmon/forge-reports/`).
  - Round-trip: write -> read -> `schemaVersion === 1` guard passes.
  - Reading an unknown `schemaVersion` yields a clear error with migration hint.
  - Retention policy: seed fixture with 25 timestamped reports, run retention, assert exactly 20 remain (newest by `generatedAt`).
  - `forge export` writer produces valid JSON with header `{ project_hash, exported_at, schema_version: 1 }` and a shallow `Instinct[]` payload (scaffolding shape only — NOT the ClusterReport).
- **Verify**: RED, module missing.
- **Commit**: `test(forge): add failing tests for report writer, retention, and export serializer`
- **Depends on**: 2.2.

#### Step 3.2 — Implement report writer, retention, and export serializer (M)

- **Files**:
  - `scripts/lib/forge-report-writer.ts` (new, < 150 lines)
- **Public surface**:
  ```typescript
  export function writeClusterReport(report: ClusterReport, baseDir?: string): string; // returns path
  export function readClusterReport(path: string): ClusterReport; // throws on schemaVersion mismatch
  export function pruneOldReports(baseDir: string, keep: number): number; // returns pruned count
  export function exportInstinctsToJson(projectHash: string, destPath: string): string; // returns path
  ```
- **Defaults**:
  - `baseDir` defaults to `path.join(os.homedir(), '.kadmon', 'forge-reports')`.
  - `keep` defaults to 20.
  - Export file default name: `instincts-export-${projectHash}-${YYYY-MM-DD}.json` in `cwd()`.
- **Safety**:
  - Use `fileURLToPath` where applicable — NEVER `new URL().pathname` on Windows (CLAUDE.md pitfall).
  - Ensure `baseDir` is created with `fs.mkdirSync(baseDir, { recursive: true })` before first write.
- **Verify**: `npx vitest run tests/lib/forge-report-writer.test.ts` green; full suite still green.
- **Commit**: `feat(forge): add cluster report writer, retention policy, and export serializer`
- **Depends on**: 3.1.

### Phase 4: Command files

#### Step 4.1 — Create /forge command file (S)

- **Files**:
  - `.claude/commands/forge.md` (new, frontmatter + workflow body)
- **Frontmatter**:
  ```yaml
  ---
  description: Forge session observations into tempered instincts via unified pipeline with preview gate
  skills: [continuous-learning-v2]
  ---
  ```
- **Body sections**:
  - Purpose — verb/noun explanation.
  - Arguments — `/forge` (default pipeline), `/forge --dry-run`, `/forge export`. Explicitly no other flags.
  - Steps — 8-step pipeline from ADR D2 (Read, Extract, Reinforce/Create, Evaluate, Cluster, Gate, Apply, Report).
  - Preview gate format — show the table layout (columns: type, pattern, confidence, occurrences, recommendation).
  - Example — mirror the style of the old `/instinct` example, one full pipeline run.
- **Verify**:
  - `cat .claude/commands/forge.md` readable, frontmatter parses.
  - Manual smoke test (skipped until Step 6): invoking `/forge` in Claude resolves the command.
- **Commit**: `feat(forge): add /forge command file with unified pipeline workflow`
- **Depends on**: 3.2 (command should describe code that exists).

#### Step 4.2 — Add failing tests for deprecation alias behavior (S)

- **Files**:
  - `tests/lib/forge-alias.test.ts` (new)
- **Note**: Slash commands are markdown workflow definitions, not JS/TS — there is no automated way to "invoke" them in Vitest. The test instead exercises a small helper module extracted in Step 4.3.
- **Tests** (RED until Step 4.3):
  - `resolveAliasCommand('/instinct')` returns `{ target: '/forge --dry-run', warn: '[deprecated] /instinct -> /forge...' }`.
  - `'/instinct status'` and `'/instinct eval'` -> `/forge --dry-run`.
  - `'/instinct learn'`, `'/instinct promote'`, `'/instinct prune'` -> `/forge`.
  - `'/instinct export'` -> `/forge export`.
  - Warning message includes the removal date `2026-04-20`.
- **Verify**: RED.
- **Commit**: `test(forge): add failing tests for /instinct deprecation alias resolver`
- **Depends on**: 4.1.

#### Step 4.3 — Implement alias resolver + rewrite instinct.md as deprecation stub (S)

- **Files**:
  - `scripts/lib/forge-alias.ts` (new, < 60 lines) — pure function `resolveAliasCommand(input: string): { target: string; warn: string }`.
  - `.claude/commands/instinct.md` (REWRITE in place) — thin stub:
    - Frontmatter `description: "[DEPRECATED] Use /forge. This alias is removed after 2026-04-20."`
    - Body: prints the deprecation warning and maps the old subcommand to the `/forge` equivalent (mapping table from ADR D6).
    - References `forge-alias.ts` conceptually; Claude executes the mapping inline.
- **Verify**:
  - `npx vitest run tests/lib/forge-alias.test.ts` green.
  - Full suite green.
- **Commit**: `chore(forge): deprecate /instinct as alias with warning and closest-behavior mapping`
- **Depends on**: 4.2.
- **Risk**: Low — alias is a presentation-layer stub.

### Phase 5: Cross-reference sync

#### Step 5.1 — Update dashboard promote-hint text (S)

- **Files**:
  - `scripts/lib/dashboard.ts:382`
- **Change**: The hint string `\u2192 promote` stays visually identical; only its implied target changes from `/instinct promote` to `/forge`. If the hint is documented anywhere (grep for `-> promote` in comments), update that comment to point at `/forge`.
  - Concrete action: add/update a comment above line 381 noting `// hint target is /forge (was /instinct promote pre-2026-04-13)`.
- **Verify**:
  - `npx vitest run tests/lib/dashboard.test.ts` green.
  - `npx tsx scripts/dashboard.ts` renders without error.
- **Commit**: `refactor(dashboard): document promote hint target as /forge`
- **Depends on**: 4.3.

#### Step 5.2 — Sync docs and rules (M)

- **Files**:
  - `CLAUDE.md:83` — change `/instinct` to `/forge` in "Evolve (3)" row. LEAVE `CLAUDE.md:41` (tree comment "instincts, etc") and `CLAUDE.md:134` (SQLite tables) alone.
  - `.claude/rules/common/agents.md:98` — update `/instinct` to `/forge` in Direct orchestration block.
  - `.claude/rules/common/development-workflow.md:80` — update `/instinct` row in command reference table. New description: "Forge observations into instincts via preview-gated pipeline (always deep). Flags: `--dry-run`, `export`."
  - `docs/roadmap/v1.1-learning-system.md:78` — update `/instinct archive-old-sessions` to `/forge archive-old-sessions` (still pending item; rename only).
- **Verify**:
  - `grep -rn "/instinct" CLAUDE.md .claude/rules docs/roadmap` returns no matches except ADR-005 itself and this plan.
  - `grep -rn "/forge" CLAUDE.md .claude/rules docs/roadmap` confirms the updates landed.
- **Commit**: `docs(forge): sync CLAUDE.md, rules, and roadmap for /instinct -> /forge rename`
- **Depends on**: 5.1.
- **Risk**: Low. Pure text edits.

#### Step 5.3 — Update memory pointer (S)

- **Files**:
  - `~/.claude/projects/C--Command-Center-Kadmon-Harness/memory/project_instinct_assessment.md`
  - `~/.claude/projects/C--Command-Center-Kadmon-Harness/memory/MEMORY.md` (only if the entry hook spells `/instinct`; the noun "Instinct assessment" stays).
- **Action**: Replace any `/instinct` slash-command references with `/forge` (leave the data-model noun "instinct" intact). DO NOT delete the entry — only refresh the pointer. Note that auto-memory is gitignored; this is a manual one-time sync.
- **Verify**: `grep "/instinct" ~/.claude/projects/C--Command-Center-Kadmon-Harness/memory/*.md` returns nothing.
- **Commit**: N/A (memory dir is gitignored). Log in the PR body that the memory entry was refreshed.
- **Depends on**: 5.2.

### Phase 6: Verification and handoff

#### Step 6.1 — Full /chekpoint full-tier run (M)

- **Action**: Invoke `/chekpoint` (full tier — non-negotiable per ADR).
- **Reviewers**: ts-reviewer + spektr + orakle (orakle should no-op since no SQL changed) + kody consolidate.
- **Verify**:
  - `npm run build` clean.
  - `npx tsc --noEmit` clean.
  - `npx vitest run` all 422+ new tests green.
  - All reviewer outputs no BLOCK/CRITICAL.
- **Commit**: N/A (this is the gate before merging the feature branch / before the `/doks` step).
- **Depends on**: 5.3.

#### Step 6.2 — /doks sync pass (S)

- **Action**: Run `/doks` to catch any drift in command/skill/rule counts induced by the rename. Expected touch points:
  - Command count stays at 11 (one rename + one deprecated stub that still counts).
  - Agent/skill/rule/hook counts unchanged.
  - The `/doks` 4-layer sync may propose updates to CLAUDE.md tables — verify they match 5.2.
- **Verify**: `/doks` reports `no_context` gaps as zero for this refactor.
- **Commit**: `docs(forge): /doks sync pass for plan-005 completion` (only if /doks finds drift).
- **Depends on**: 6.1.

### Phase 7: Scheduled removal (separate session, after 2026-04-20)

#### Step 7.1 — Remove /instinct deprecation alias (S)

- **Target date**: 2026-04-20 or later (ADR D6).
- **Files**:
  - Delete `.claude/commands/instinct.md`.
  - Delete `scripts/lib/forge-alias.ts` AND `tests/lib/forge-alias.test.ts`.
- **Verify**:
  - `grep -rn "instinct.md" .claude/commands` returns nothing.
  - Full suite green.
- **Commit**: `chore(forge): remove deprecated /instinct alias (end of deprecation window)`
- **Depends on**: user confirmation that muscle memory has shifted OR calendar >= 2026-04-20.
- **Note**: This step is a SEPARATE commit in a SEPARATE session. Not part of the initial merge.

## Test plan

Explicit test cases (all must be RED before their implementation step, GREEN after):

| # | Test case | File | Step |
|---|-----------|------|------|
| T1 | ClusterReport JSON round-trip with `schemaVersion === 1` guard | `tests/lib/cluster-report.test.ts` | 1.1 |
| T2 | ClusterReport `meta` field round-trips without loss (non-breaking extension escape hatch) | `tests/lib/cluster-report.test.ts` | 1.1 |
| T3 | `/forge` full pipeline round trip (`:memory:` SQLite + fixture observations -> DB updates match expectations) | `tests/lib/forge-pipeline.test.ts` | 2.1 |
| T4 | `/forge --dry-run` does NOT mutate the DB (byte-identical DB state before/after) | `tests/lib/forge-pipeline.test.ts` | 2.1 |
| T5 | Preview gate — new instinct in `would.create[]` | `tests/lib/forge-pipeline.test.ts` | 2.1 |
| T6 | Preview gate — reinforced instinct in `would.reinforce[]` | `tests/lib/forge-pipeline.test.ts` | 2.1 |
| T7 | Preview gate — promotable (confidence >= 0.8) in `would.promote[]` | `tests/lib/forge-pipeline.test.ts` | 2.1 |
| T8 | Preview gate — contradicted instinct in `would.prune[]` | `tests/lib/forge-pipeline.test.ts` | 2.1 |
| T9 | Clustering — 2+ similar instincts grouped into a cluster | `tests/lib/forge-pipeline.test.ts` | 2.1 |
| T10 | Clustering — singleton instinct lands in `unclustered[]` | `tests/lib/forge-pipeline.test.ts` | 2.1 |
| T11 | Cluster report writer writes valid JSON to expected path | `tests/lib/forge-report-writer.test.ts` | 3.1 |
| T12 | Cluster report reader errors clearly on unknown `schemaVersion` | `tests/lib/forge-report-writer.test.ts` | 3.1 |
| T13 | Retention policy keeps last 20 reports | `tests/lib/forge-report-writer.test.ts` | 3.1 |
| T14 | `/forge export` writes valid JSON to expected location with `schema_version: 1` header | `tests/lib/forge-report-writer.test.ts` | 3.1 |
| T15 | Deprecation alias `/instinct` -> closest `/forge` behavior with warning mentioning 2026-04-20 | `tests/lib/forge-alias.test.ts` | 4.2 |
| T16 | Existing `instinct-manager` tests still pass (regression guard) | `tests/lib/instinct-manager.test.ts`, `tests/eval/instinct-lifecycle-e2e.test.ts` | 2.2, 6.1 |
| T17 | Dashboard rendering unchanged (regression guard on promote hint) | `tests/lib/dashboard.test.ts` | 5.1 |

**TDD discipline**: Every test file above MUST be committed in its own RED commit BEFORE the implementation commit that makes it green. feniks will enforce red-green-refactor after user approves this plan.

## Verification

Post-implementation checks (run at Step 6.1):

1. **Build**: `npm run build` exits 0.
2. **Typecheck**: `npx tsc --noEmit` exits 0.
3. **Tests**: `npx vitest run` — all green (422 existing + new tests from T1-T17).
4. **Smoke test /forge**: run `/forge --dry-run` in a session with fixture observations, verify preview gate renders and NO DB writes occur.
5. **Smoke test /forge apply**: run `/forge` in a session, approve gate, verify `~/.kadmon/forge-reports/forge-clusters-<sessionId>.json` exists and parses.
6. **Smoke test /instinct alias**: run `/instinct learn` in a session, verify deprecation warning is emitted AND pipeline runs as `/forge`.
7. **Smoke test /forge export**: run `/forge export`, verify JSON file written to cwd with correct header.
8. **Dashboard**: `npx tsx scripts/dashboard.ts` — INSTINCTS section still renders.
9. **/doks**: runs clean with no drift.
10. **/chekpoint full**: all reviewers no BLOCK.

## Rollback plan

Each commit is individually revertable. Recommended rollback order (reverse dependency):

- **Total rollback** (worst case): `git revert` all 11 commits in reverse order. Since no SQL/state-store/hooks changed, rollback leaves data intact. The `instincts` table is untouched at every step.
- **Partial rollback — keep types, drop pipeline**: revert Steps 2.1, 2.2, 3.1, 3.2, 4.1-4.3, 5.1-5.3. `ClusterReport` types remain for Sprint B consumption.
- **Partial rollback — keep everything, reinstate /instinct**: revert Step 5.3 (memory), 5.2 (docs), 4.3 (alias stub), 4.2, 4.1 (forge command). Pipeline module stays as library code; command surface reverts. Deprecation stub converts back to the full original command.
- **Alias-only rollback**: if the alias resolver is buggy, revert 4.3 and 4.2 only — `/instinct` stub becomes a hard-delete candidate, users use `/forge` directly with a visible but brief gap.

**Data safety**: There is no data migration at any step. `instincts` table, `instinct-manager.ts` functions, state-store functions, and hook outputs are untouched. A revert cannot corrupt data.

## Out of scope (reminder from ADR)

Per ADR-005 "Out of Scope" section, the following MUST NOT be touched by this plan:

- `/evolve` step 6 "Generate" implementation (this plan only defines its input contract).
- Cross-project auto-promotion (`confidence >= 0.8` across 2+ projects -> `scope=global`) — Sprint E.
- Instinct decay (confidence erosion over calendar time) — Sprint E.
- Real cross-project import/export with conflict resolution — Sprint E. `/forge export` is scaffolding only.
- Dashboard rewrites beyond the promote-hint comment update.
- Changes to the `Instinct` lifecycle state machine.
- Alchemik model/tool changes for step 6 — Sprint B.
- SQL table, column, or type renames. Data model stays untouched.
- `observe-pre` / `observe-post` / `session-end-all` hooks. Observation production is unchanged.
- `scripts/lib/instinct-manager.ts` internals (`createInstinct`, `reinforceInstinct`, `contradictInstinct`, `promoteInstinct`, `pruneInstincts`, `getInstinctSummary`). The forge pipeline consumes these semantics via its own reinforcement logic but does NOT rewrite the module. A later refactor (not this plan) could unify them.

## Open questions

None block the plan. Items flagged for the implementer to watch:

1. **Clustering algorithm specifics**: ADR explicitly leaves algorithm to konstruct. This plan picks MVP (Jaccard on pattern tokens + action-verb/domain buckets). feniks or the implementer may swap in a simpler algorithm (pure action-verb grouping) if MVP proves over-engineered for n=~10.
2. **Observation reader reuse**: Step 2.2 notes that `evaluate-patterns-shared.js` already knows how to read observations. The implementer should prefer importing from that module over duplicating JSONL read logic, but module boundaries (.js in `.claude/hooks/scripts/` vs .ts in `scripts/lib/`) may force duplication. If duplicated, leave a TODO linking to the shared module for future consolidation.
3. **Preview gate UX**: the plan specifies the `ForgePreview` data shape but not the exact terminal rendering. Implementer should mirror the table style already used by `/kadmon-harness` dashboard INSTINCTS section for visual consistency.
4. **Retention policy scope**: 20 reports kept by default. If the user runs `/forge` heavily, this caps ~20 sessions of handoff history. Revisit if user signals it is too aggressive.

No `no_context` gaps — all ADR decisions are concrete enough to execute.
