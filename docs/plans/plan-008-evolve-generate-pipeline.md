---
number: 8
title: Sprint B — /evolve Generate step 6 cross-project pipeline
date: 2026-04-14
status: shipped
needs_tdd: true
route: A
adr: ADR-008-evolve-generate-pipeline.md
---

# Plan 008: Sprint B — /evolve Generate step 6 cross-project pipeline [konstruct]

> **Shipped 2026-04-14** via commit `ecc1a14` ("feat(v1.1): Sprint B — /evolve Generate step 6 cross-project pipeline"). `/evolve` Generate step 6 is in an EXPERIMENTAL observation window through 2026-04-28 per CLAUDE.md — to be re-evaluated against real cross-project ClusterReports before the window closes.

## Goal

Ship the consumer half of the forge -> evolve loop (ADR-008) as a CWD-aware, `projectHash`-scoped pipeline: `runEvolveGenerate` (pure) reads `ClusterReport` JSON files from `~/.kadmon/forge-reports/` within a 7-day window, filters by current project, and emits `GenerateProposal[]`; `applyEvolveGenerate` (single mutator) writes skill/command/agent/rule markdown artifacts into `{cwd}/.claude/{type}/` with transactional collision detection. Closes the loop so plan-003 can distribute a complete learning system to Kadmon-Sports, ToratNetz, and KAIRON.

## Scope

File list is exactly what ADR-008 section 5 specifies. No expansion.

### New files (Kadmon-Harness)
- `scripts/lib/evolve-generate.ts` — pure pipeline + single mutator (ADR-008:294-356)
- `scripts/lib/evolve-report-reader.ts` — window read + merge (ADR-008:364-375)
- `scripts/lib/evolve-generate-templates/skill.template.md`
- `scripts/lib/evolve-generate-templates/command.template.md`
- `scripts/lib/evolve-generate-templates/agent.template.md`
- `scripts/lib/evolve-generate-templates/rule.template.md`
- `.claude/hooks/scripts/agent-metadata-sync.js` — Q8 PostToolUse hook
- `tests/lib/evolve-report-reader.test.ts`
- `tests/lib/evolve-generate.test.ts`
- `tests/hooks/agent-metadata-sync.test.ts`
- `tests/fixtures/make-cluster-report.ts`

### Modified files (Kadmon-Harness)
- `scripts/lib/types.ts` — add `SkillSpec | CommandSpec | AgentSpec | RuleSpec` discriminated union + `GenerateProposal` + `EvolveGeneratePreview` + `ApplyResult` (ADR-008:386)
- `.claude/agents/alchemik.md` — new Step 6 section marked EXPERIMENTAL; no `tools:` change (ADR-008:199-203, Q9)
- `.claude/commands/evolve.md` — orchestration flow: parse alchemik fence -> gate -> approval -> runEvolveGenerate -> applyEvolveGenerate -> skill-creator plugin for PROMOTE
- `.claude/settings.json` — register `agent-metadata-sync` under `hooks.PostToolUse`
- `.claude/rules/common/hooks.md` — append hook row, bump catalog count 20 -> 21
- `CLAUDE.md` — add `KADMON_EVOLVE_WINDOW_DAYS` env var, experimental marker under /evolve, bump hook count, Sprint B completion note

### NOT touched (explicit)
- `scripts/lib/state-store.ts` — no schema or function changes (ADR-008:395)
- `scripts/lib/forge-pipeline.ts` — producer unchanged (ADR-008:396)
- `scripts/lib/forge-report-writer.ts` — reader is a separate module (ADR-008:397, 376)
- `~/.kadmon/kadmon.db` schema — no migration (ADR-008:225)
- Existing 22 Kadmon-Harness instincts — read by fixture helper only, never mutated (ADR-008:398)

## Phases

Sequential. Steps within a phase may run in parallel unless a dependency is noted.

### Phase 0: Types + test fixtures (foundation)

- [ ] **0.1** Add `SkillSpec | CommandSpec | AgentSpec | RuleSpec` discriminated union, `GenerateProposal`, `EvolveGeneratePreview`, `ApplyApprovals`, `ApplyResult` to `scripts/lib/types.ts`. Copy shapes verbatim from ADR-008:311-355. (S)
  - File: `scripts/lib/types.ts`
  - Verify: `npx tsc --noEmit` clean; existing `EvolutionCategory` and `ClusterReport` untouched.
  - Depends on: none.

- [ ] **0.2** Create fixture helper that builds `ClusterReport` objects from real 22 Kadmon-Harness instincts via a `:memory:` DB stub. Must accept `{ projectHash, generatedAt, instinctIds?, clusterOverrides? }` and return a fully-formed report. (M)
  - File: `tests/fixtures/make-cluster-report.ts`
  - Verify: importable from both `tests/lib/evolve-report-reader.test.ts` and `tests/lib/evolve-generate.test.ts`; produces a schema-valid `ClusterReport`.
  - Depends on: 0.1.

- [ ] **0.3** Create four template files with placeholder tokens: `{{NAME}}`, `{{SLUG}}`, `{{DESCRIPTION}}`, `{{RATIONALE}}`, `{{SOURCE_CLUSTERS}}`, `{{GENERATED_AT}}`. Match the frontmatter shape of existing `.claude/{skills,commands,agents,rules}/` files. (S)
  - Files: `scripts/lib/evolve-generate-templates/{skill,command,agent,rule}.template.md`
  - Verify: each file parses as markdown with valid frontmatter when tokens are substituted with test values.
  - Depends on: none.

### Phase 1: Report reader (read-side, TDD)

- [ ] **1.1 RED** Write `tests/lib/evolve-report-reader.test.ts` covering: (a) filters by `projectHash` only, (b) respects `KADMON_EVOLVE_WINDOW_DAYS` via env override + `windowDays` option, (c) merges by `instinctId` with most-recent-report-wins on `membership`, union on `clusterId` members (ADR-008:92), (d) returns `[]` when no reports match, (e) unknown `schemaVersion` rejected. (M)
  - File: `tests/lib/evolve-report-reader.test.ts`
  - Verify: `npx vitest run tests/lib/evolve-report-reader.test.ts` — all red (import errors).
  - Depends on: 0.2.

- [ ] **1.2 GREEN** Implement `scripts/lib/evolve-report-reader.ts` exporting `readClusterReportsInWindow({ baseDir, projectHash, windowDays, now }): ClusterReport[]` per ADR-008:364-375. Directory scan via `fs.readdirSync` on `baseDir`, JSON parse with try/catch, filter by hash + window, then merge. (M)
  - File: `scripts/lib/evolve-report-reader.ts`
  - Verify: Phase 1.1 tests green.
  - Depends on: 1.1.

- [ ] **1.3 REFACTOR** Extract `mergeByInstinctId(reports: ClusterReport[]): ClusterReport` as a pure helper if merge grows beyond ~30 lines. Keep it exported for direct unit testing. (S)
  - File: `scripts/lib/evolve-report-reader.ts`
  - Verify: all 1.1 tests still green; unit-test the helper directly.
  - Depends on: 1.2.

### Phase 2: Pure pipeline (heart of Sprint B, TDD)

All Phase 2 tests live in `tests/lib/evolve-generate.test.ts` to minimize file sprawl.

- [ ] **2.1 RED — Part A: purity** Assert `runEvolveGenerate({ projectHash, cwd, dryRun: true })` and `runEvolveGenerate({ ..., dryRun: false })` both return `EvolveGeneratePreview` without touching disk. Mock `fs.writeFile*` and assert 0 calls. (M)
  - Depends on: 0.1, 0.2, 0.3.

- [ ] **2.2 RED — Part B: category routing** Each `EvolutionCategory` (PROMOTE, CREATE_AGENT, CREATE_COMMAND, CREATE_RULE) maps to correct `ProposalType` with valid `targetPath` under `{cwd}/.claude/{type}/`. `CREATE_HOOK` surfaces via `preview.deferredHookCount` with no proposal row (ADR-008:182-184, Q7). (M)
  - Depends on: 2.1.

- [ ] **2.3 RED — Part C: projectHash isolation** Plant two fixture reports with different `projectHash` values into a temp reports dir. Assert `runEvolveGenerate({ projectHash: "aaaa1111" })` returns proposals derived ONLY from the first report. Locks down ADR-008:217 invariant. (M)
  - Depends on: 2.1.

- [ ] **2.4 RED — Part D: stale instinctId** Fixture references `instinctId` values not in the live `:memory:` instincts set. Assert silent drop + diagnostic message surfaces in `preview.meta` or equivalent field (ADR-008:210-211). Pathological slug (`../../../etc/passwd`) rejected at validation. (S)
  - Depends on: 2.1.

- [ ] **2.5 GREEN** Implement `scripts/lib/evolve-generate.ts` with `runEvolveGenerate` per ADR-008:335-337. Imports `readClusterReportsInWindow` from Phase 1. Iterates merged clusters, derives proposal type from `suggestedCategory`, builds `GenerateProposal[]` via template rendering helpers, validates slug regex `/^[a-z0-9][a-z0-9-]{0,63}$/` (ADR-008:63), checks resolved path is under `path.resolve(cwd, ".claude")`. Caps at **10 proposals per run** (ADR-008 Q6, experimental). (L)
  - File: `scripts/lib/evolve-generate.ts`
  - Verify: Phase 2.1-2.4 tests all green; `npx tsc --noEmit` clean.
  - Depends on: 2.1, 2.2, 2.3, 2.4, 1.2.

### Phase 3: Single mutator + collision detection (TDD)

- [ ] **3.1 RED — Part E: write to cwd** `applyEvolveGenerate(preview, approvals, { cwd: tmpDir })` writes artifacts into `{tmpDir}/.claude/{type}/`, creating the directory if missing via `fs.mkdirSync(..., { recursive: true })`. Test against `os.tmpdir()` path. (M)
  - File: `tests/lib/evolve-generate.test.ts`
  - Depends on: 2.5.

- [ ] **3.2 RED — Part F: transactional collision** Pre-seed a file at one of the proposed target paths. Assert `applyEvolveGenerate` returns `{ written: [], collisions: ["<path>"] }` and writes ZERO files — the entire batch aborts (ADR-008:62). (M)
  - Depends on: 2.5.

- [ ] **3.3 RED — Part G: Windows path safety** Use a tmp cwd with spaces in the path (`os.tmpdir() + "/evolve test"`). Assert `path.join` / `path.resolve` usage (no string concat). Test `fileURLToPath` handling if any `import.meta.url` surfaces. (S)
  - Depends on: 2.5.

- [ ] **3.4 GREEN** Implement `applyEvolveGenerate(preview, approvals, opts): ApplyResult` per ADR-008:351-355. Single filesystem mutator. Walk all `approvedIndices`, build absolute target paths, run collision pre-check via `fs.existsSync`, abort if any hit, else write all via `fs.writeFileSync`. Return `pluginInvocations` (the PROMOTE subset's `SkillSpec`s) for command-side to feed to `skill-creator:skill-creator`. (M)
  - File: `scripts/lib/evolve-generate.ts`
  - Verify: Phase 3.1-3.3 tests green.
  - Depends on: 3.1, 3.2, 3.3.

- [ ] **3.5 INTEGRATION — Part H: end-to-end** fixture reports -> `runEvolveGenerate` -> `applyEvolveGenerate` -> read written files back -> assert content matches template substitution exactly. One happy path test; does NOT invoke real skill-creator plugin. (M)
  - File: `tests/lib/evolve-generate.test.ts`
  - Verify: written files parse, frontmatter valid, `sourceInstinctIds` reflected in rendered body.
  - Depends on: 3.4.

### Phase 4: /evolve command orchestration + alchemik step 6

- [ ] **4.1** Update `.claude/agents/alchemik.md`: add Step 6 section titled "Generate (EXPERIMENTAL — refining heuristics through 2026-04-28)" per ADR-008:166. Document that alchemik **proposes only** (ADR-008:68-82, Q2), emits `GenerateProposal[]` in a machine-parseable JSON fence, caps at 10 proposals per run. Do NOT modify `tools:` frontmatter (ADR-008:199-203, Q9). (M)
  - File: `.claude/agents/alchemik.md`
  - Verify: agent-metadata-sync hook (Phase 5) will auto-refresh catalogs; meanwhile, markdown renders and passes `no-context-guard`.
  - Depends on: Phase 3 complete.

- [ ] **4.2** Update `.claude/commands/evolve.md`: add steps 11-15 (or equivalent) for orchestration flow per ADR-008:76-81. Flow: (a) parse alchemik's `GenerateProposal[]` fence, (b) render approval gate using table format from ADR-008:102-120, (c) await `all / none / 1,3 / abort` selection, (d) call `applyEvolveGenerate` for non-PROMOTE proposals, (e) for each PROMOTE, invoke `skill: "skill-creator:skill-creator"` with the proposal's `SkillSpec`, (f) report written files + plugin results. Include explicit fallback if skill-creator plugin invocation fails: emit the spec as markdown for manual use. (M)
  - File: `.claude/commands/evolve.md`
  - Verify: markdown parses; step numbering consistent; references `runEvolveGenerate` and `applyEvolveGenerate` by name.
  - Depends on: 4.1.

- [ ] **4.3** Update `CLAUDE.md`: (a) add `KADMON_EVOLVE_WINDOW_DAYS` row under Environment Variables section, (b) add experimental marker note under /evolve in Commands section, (c) bump hook count 20 -> 21 under Hooks section and Status section, (d) add Sprint B completion note. (S)
  - File: `CLAUDE.md`
  - Verify: all counts consistent with agents.md and hooks.md.
  - Depends on: 4.2.

### Phase 5: Auto-sync hook (agent-metadata-sync)

- [ ] **5.1 RED** Write `tests/hooks/agent-metadata-sync.test.ts` covering: (a) fixture agent file with `model: opus -> sonnet` frontmatter change triggers update of both `CLAUDE.md` agents table AND `.claude/rules/common/agents.md` routing table, (b) body-only change (no frontmatter) is a no-op, (c) missing `model:` key emits warning (exit 1) without crashing, (d) latency assertion: hook completes in under 500ms. Use `execFileSync` with input option (Windows-safe per `typescript/testing.md`). (M)
  - File: `tests/hooks/agent-metadata-sync.test.ts`
  - Verify: red — hook script does not exist yet.
  - Depends on: none (parallel with Phase 4).

- [ ] **5.2 GREEN** Create `.claude/hooks/scripts/agent-metadata-sync.js`. PostToolUse Edit|Write matcher. Parse stdin via `parseStdin()` helper. If `tool_input.file_path` matches `.claude/agents/*.md`, read the new file, extract frontmatter, diff against current `CLAUDE.md` agents table row, write updates synchronously. Exit 1 on warning, NEVER exit 2 (ADR-008:193-194, hook safety rules). Wrap all logic in try/catch. (L)
  - File: `.claude/hooks/scripts/agent-metadata-sync.js`
  - Verify: Phase 5.1 tests green; manual smoke edits pass.
  - Depends on: 5.1.

- [ ] **5.3** Register `agent-metadata-sync` in `.claude/settings.json` under `hooks.PostToolUse` with `Edit|Write` matcher and Windows-safe `PATH="$PATH:/c/Program Files/nodejs"` prefix (matches other hook entries). (S)
  - File: `.claude/settings.json`
  - Verify: JSON parses; existing 20 hook registrations untouched.
  - Depends on: 5.2.

- [ ] **5.4** Update `.claude/rules/common/hooks.md`: append row to the PostToolUse Edit|Write table for `agent-metadata-sync` (purpose: "Auto-syncs agent frontmatter changes to CLAUDE.md + agents.md catalogs"; exit: "1 on warning"). Bump catalog total from 20 to 21 in the section header and in the `## Hook Catalog (20 registered)` title. (S)
  - File: `.claude/rules/common/hooks.md`
  - Verify: markdown table valid; count consistent with CLAUDE.md and settings.json.
  - Depends on: 5.3.

## Verification

Run in order. Do not proceed if any step fails.

1. `npm run build` — clean.
2. `npx tsc --noEmit` — zero errors.
3. `npx vitest run` — full suite green. Baseline 514 tests; expected ~550 after Phase 0-5.
4. `npx vitest run tests/lib/evolve-generate.test.ts tests/lib/evolve-report-reader.test.ts tests/hooks/agent-metadata-sync.test.ts` — targeted re-run.
5. **Manual cross-project E2E**: create a gitignored test harness at `scripts/run-evolve-generate-manual.ts` (NOT shipped). Seed `/tmp/kadmon-sports-test/.claude/` empty dir + a ClusterReport JSON at `~/.kadmon/forge-reports/forge-clusters-test.json` with `projectHash` matching `/tmp/kadmon-sports-test` git remote hash. `cd /tmp/kadmon-sports-test && npx tsx <harness-path>`. Verify artifacts land in `/tmp/kadmon-sports-test/.claude/skills/` (or commands/agents/rules), NOT in Kadmon-Harness.
6. **agent-metadata-sync smoke test**: edit `.claude/agents/alchemik.md` frontmatter `description:` field with a no-op tweak. Confirm CLAUDE.md agents table and `.claude/rules/common/agents.md` refresh within 500ms. Revert.
7. **/chekpoint full tier** (mandatory for production TS + hook changes; no skip possible here).

## Rollback plan

Revert the Sprint B commits. No DB migrations, so no down-script needed. Delete any `.claude/skills/*`, `.claude/commands/*`, `.claude/agents/*`, `.claude/rules/common/*` artifacts that landed in test cwds (they're additive and reversible by `rm`). If `agent-metadata-sync` misbehaves in the field, disable it via `KADMON_DISABLED_HOOKS=agent-metadata-sync` (per `rules/common/hooks.md` Windows Compatibility section) until a fix ships. Existing 22 Kadmon-Harness instincts and `~/.kadmon/kadmon.db` schema are untouched — rollback is pure code revert.

## Risks & Mitigations

- **Risk: naive heuristics produce awkward first artifacts.** The cluster -> category mapping comes from `buildCluster` at `forge-pipeline.ts:394-398`, which is placeholder-level domain-based (ADR-008:228). Mitigation: EXPERIMENTAL marker (Q6) + approval gate + 10-proposal cap + Sprint B.1 heuristic refinement window (target 2026-04-28) based on real Kadmon-Sports/ToratNetz/KAIRON use.

- **Risk: cross-project `projectHash` isolation breaks.** If `runEvolveGenerate` ever leaks proposals across projects, Kadmon-Sports clusters could contaminate Kadmon-Harness `.claude/`. Mitigation: Phase 2.3 invariant test plants a two-hash fixture and locks down the guarantee; additional runtime invariant check in `runEvolveGenerate` cross-validates each cluster's member `instinctId`s against `getActiveInstincts(currentProjectHash)` and silently drops stale references (ADR-008:210-211).

- **Risk: partial-write on collision leaves `.claude/` in inconsistent state.** Mitigation: Phase 3.2 test enforces transactional abort — the mutator walks all proposed paths via `fs.existsSync` pre-check BEFORE any `writeFileSync` call; if any collide, zero files written and full list returned (ADR-008:62).

- **Risk: `agent-metadata-sync` hook latency exceeds 500ms budget.** Would slow the hook chain and degrade every Edit/Write on `.claude/agents/*.md`. Mitigation: Phase 5.1 latency assertion (fail-fast in test) + exit-1-never-exit-2 policy so a slow or broken hook never blocks saves.

- **Risk: `skill-creator:skill-creator` plugin invocation from command-level is untested in the harness.** No existing command currently invokes the plugin programmatically. Mitigation: Phase 4.2 documents the exact `skill: "skill-creator:skill-creator"` invocation pattern and the fallback path — if invocation fails, the command emits the `SkillSpec` as inline markdown so the user can run `skill-creator` manually (ADR-008:229).

## Complexity total

Phase 0: S + M + S = ~half day
Phase 1: M + M + S = ~half day (TDD)
Phase 2: M + M + M + S + L = ~1.5 days (TDD, heart of sprint)
Phase 3: M + M + S + M + M = ~1 day (TDD)
Phase 4: M + M + S = ~half day
Phase 5: M + L + S + S = ~1 day (hook is the tricky bit)

**Estimate: 4-5 days if Phase 5 is smooth, 6-7 days if hook parsing/sync needs iteration.** Matches the v1.1 roadmap allocation for Sprint B.

## Success Criteria

- [ ] `runEvolveGenerate` is pure (0 disk writes in any mode) — Phase 2.1 test green.
- [ ] `applyEvolveGenerate` is the single filesystem mutator and is transactional on collision — Phase 3.2 test green.
- [ ] Cross-project `projectHash` isolation invariant locked down — Phase 2.3 test green.
- [ ] Manual E2E writes artifacts into `/tmp/kadmon-sports-test/.claude/`, NOT into Kadmon-Harness — Verification step 5.
- [ ] `agent-metadata-sync` hook auto-refreshes CLAUDE.md + agents.md within 500ms — Verification step 6.
- [ ] `CREATE_HOOK` clusters are surfaced as informational only (no proposal row) — Phase 2.2 test green.
- [ ] Full test suite green (~550 tests) — `npx vitest run`.
- [ ] TypeScript compiles clean — `npx tsc --noEmit`.
- [ ] `/chekpoint full` passes before merge.
- [ ] No modifications to `state-store.ts`, `forge-pipeline.ts`, `forge-report-writer.ts`, DB schema, or existing 22 instincts.
