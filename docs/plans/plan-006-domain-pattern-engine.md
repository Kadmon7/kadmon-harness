---
number: 6
title: Domain pattern engine — Sprint A v1.1
date: 2026-04-13
status: pending
needs_tdd: true
route: A
adr: ADR-006-domain-pattern-engine.md
---

# Plan-006: Domain pattern engine — Sprint A v1.1 [konstruct]

## Overview

Execute ADR-006 Sprint A: replace the 13 tautological hygiene patterns with 12 domain-specific patterns, grow the pattern engine by exactly 2 new types (`file_sequence`, `tool_arg_presence`), add a 5-line observation-schema patch to log `Skill.skill`, and archive 10 redundant active instincts via a one-shot migration script. The `/forge` pipeline (`forge-pipeline.ts`) is frozen and MUST NOT change — only the pattern engine it consumes and the definitions it reads. Traceability: every decision below is anchored to ADR-006 sections (Decision 1, Decision 2, Migration Plan). Dogfood window: 2 `/forge` sessions post-merge before deciding whether to keep pattern G (`tool_arg_presence`).

## Current state

Verified by reading the repo at commit `0b53627` (clean working tree on `main`):

- **Pattern types** in `scripts/lib/pattern-engine.ts`: **3** — `sequence`, `command_sequence`, `cluster`. Each has a detector function and a `case` in `evaluatePatterns()`. Loader is `loadPatternDefinitions(filePath)`. Total length: 131 lines.
- **Pattern definitions** in `.claude/hooks/pattern-definitions.json`: **13** entries, all hygiene-domain (workflow / git / testing / build / observability / refactoring). Verified by reading the file end-to-end.
- **`PatternDefinition` union** in `scripts/lib/types.ts` lines 223-250: three variants, exported and consumed by `pattern-engine.ts`, `forge-pipeline.ts`, and `tests/lib/pattern-engine.test.ts`.
- **Consumers of `loadPatternDefinitions` / `pattern-definitions.json`** (grep-verified): 4 files total.
  - `scripts/lib/pattern-engine.ts` — defines it.
  - `scripts/lib/forge-pipeline.ts` lines 29, 193-197 — reads definitions for candidate extraction (frozen, no changes).
  - `.claude/hooks/scripts/evaluate-patterns-shared.js` lines 64-69 — dynamic import from `dist/`, reads JSON file.
  - `tests/lib/pattern-engine.test.ts` line 115 — reads the JSON file in one test; will need adjustment for new count.
- **`observe-pre.js`** (46 lines): logs `toolName`, `filePath` (from `file_path` or `path` arg), and a `metadata` block. Metadata captures `command` (all tools), `agentType`/`agentDescription` (Agent tool only), and `taskSubject`/`taskDescription`/`taskId`/`taskStatus` (TaskCreate/TaskUpdate only). **Confirmed: no `Skill.skill` capture exists today.**
- **Active instincts** on dashboard as of ADR-006 (2026-04-13): 11 — 10 hygiene-domain at confidence 0.9, 1 outlier. The migration will archive the 10 whose `pattern` name matches the 13 definitions we are deleting; the 11th instinct (non-matching) stays untouched. Exact number archived may be 9 or 10 depending on how many of the 13 definitions had a corresponding active instinct row at migration time — the script is deterministic by pattern-name match, not by count.
- **Test baseline**: 469 passing across 47 files (commit `71c06a1`, per ADR prompt). Repo now at `0b53627` (two docs commits since). No production code has moved. `tests/lib/pattern-engine.test.ts` has ~11 test cases; `tests/hooks/observe-pre.test.ts` exists and exercises the hook via `execFileSync`. Both will be extended, not replaced.

## Assumptions

| # | Assumption | Status |
|---|---|---|
| 1 | ADR-006 is the source of truth for pattern schemas (`file_sequence`, `tool_arg_presence`), the 12-pattern inventory, thresholds, and glob strings. This plan copies them, does not re-decide them. | **validated** (read ADR end-to-end) |
| 2 | `observe-pre.js` currently logs `tool_name` but NOT any `Skill.skill` argument. | **validated** (read observe-pre.js lines 14-28 — no `Skill` branch exists) |
| 3 | No consumer of `pattern-definitions.json` outside `pattern-engine.ts`, `forge-pipeline.ts`, `evaluate-patterns-shared.js`, and the pattern-engine test file. | **validated** (grep `pattern-definitions` across repo → 4 code files + docs) |
| 4 | `forge-pipeline.ts` and `forge-report-writer.ts` are frozen by ADR-005 and this plan does not touch them. | **validated** (ADR-005 + ADR-006 both declare the freeze) |
| 5 | Glob matching for `file_sequence` can be implemented with a small internal matcher (no new npm dep) — the ADR allows either `minimatch` or a 20-line recursive matcher; this plan picks a hand-rolled matcher to avoid introducing a new runtime dep. | **needs confirmation at Phase 2 RED** — if hand-rolled proves brittle on Windows path edge cases, fall back to `minimatch` (already transitive via vitest). Decision made in-phase based on test outcomes. |
| 6 | `evaluate-patterns-shared.js` consumes the engine via dynamic import from `dist/` and will automatically pick up new pattern types once `pattern-engine.ts` is rebuilt. No edits needed to that file. | **validated** (read the dynamic import block) |
| 7 | The migration script can archive instincts by pattern-name match against a hard-coded list of the 13 deleted pattern names, because the script is a one-shot and the names are stable artifacts of ADR-006. | **validated** (matches ADR-006 Migration Plan Option B) |
| 8 | `threshold: 1` is the right starting threshold for all 12 new patterns per ADR-006 "Risks" mitigation (raise selectively once data exists). | **validated** (ADR-006 line 225) |

## Phase breakdown (TDD strict — RED → GREEN → REFACTOR per code phase)

Feniks will be invoked after this plan is approved and will drive RED first for each code phase; konstruct (me) will drive GREEN per this spec. Phases 6 and 7 are no-code and marked `TDD: n/a`.

---

### Phase 1 — Observation schema patch: log `Skill.skill` as `metadata.skillName` (S)

**Goal**: Pattern G (`tool_arg_presence` for `skill-creator` compliance) needs `metadata.skillName` to exist on `tool_pre` events for the Skill tool. Pure additive — no existing consumer breaks.

**RED** — extend `tests/hooks/observe-pre.test.ts`:
- New test case: `"captures Skill.skill as metadata.skillName when toolName === 'Skill'"`
  - Input: `{ session_id: SESSION_ID, tool_name: "Skill", tool_input: { skill: "skill-creator:skill-creator" } }`
  - Assert: observations.jsonl line parses to an event with `metadata.skillName === "skill-creator:skill-creator"`.
- New test case: `"leaves skillName null for non-Skill tools"`
  - Input: `{ session_id: SESSION_ID, tool_name: "Edit", tool_input: { file_path: "/tmp/x.ts" } }`
  - Assert: parsed event has `metadata.skillName === undefined` (no key added for non-Skill tools).
- New test case: `"sets skillName to null when Skill tool is invoked with no skill arg"`
  - Input: `{ session_id: SESSION_ID, tool_name: "Skill", tool_input: {} }`
  - Assert: `metadata.skillName === null`.

**GREEN** — edit `.claude/hooks/scripts/observe-pre.js` (insert after the TaskUpdate block, before the `event = {...}` assembly, ~5 lines):
```javascript
if (toolName === "Skill") {
  metadata.skillName = input.tool_input?.skill ?? null;
}
```
No other edits. Do NOT touch the top-level `event` object. Do NOT add a top-level `skillName` field — it lives under `metadata` only (consistent with the existing `agentType`/`taskSubject` pattern).

**REFACTOR**: None. File stays well under the 200-line preferred limit (~50 lines after patch).

**Complexity**: S
**Dependencies**: none
**Risk**: Low. Observations.jsonl is ephemeral per session — no migration. No existing test asserts the absence of `metadata.skillName`, so nothing breaks.

---

### Phase 2 — Pattern type: `file_sequence` (M)

**Goal**: Add the `file_sequence` discriminated-union variant to `PatternDefinition`, add a `detectFileSequencePattern()` detector, wire it into `evaluatePatterns()`. Covers 10 of the 12 accepted patterns (A, B, C, D, E, F, H, I, J, K per ADR-006 Table 1).

**RED** — new test file `tests/lib/pattern-engine-file-sequence.test.ts`:

Test cases (each is its own `it(...)` block):

1. `"detects Edit on matching glob followed by Bash matching followedByCommand (happy path)"`
   - Build `lines: string[]` with 3 events:
     - `tool_pre` Edit, filePath `scripts/lib/types.ts`
     - `tool_pre` Bash, metadata.command `npm run build`
     - `tool_pre` Read (filler)
   - Call `detectFileSequencePattern(lines, { editTools: ["Edit","Write"], filePathGlob: "**/types.ts", followedByCommands: ["npm run build","tsc"], withinToolCalls: 5 })`.
   - Assert return = `1`.

2. `"does not count when filePath does not match glob"`
   - Edit on `scripts/lib/state-store.ts` → Bash `npm run build` → return = `0` with glob `**/types.ts`.

3. `"does not count when follow-up Bash command substring is absent"`
   - Edit on matching file → Bash `git status` → return = `0` with followedByCommands `["npm run build"]`.

4. `"respects withinToolCalls window — follow-up outside window does not count"`
   - Edit matching → 6 filler tool_pre events → Bash matching, with `withinToolCalls: 5`. Return = `0`.

5. `"counts multiple independent matches without double-consuming the follow-up"`
   - Edit1 match → Bash match → Edit2 match → Bash match. Return = `2`.

6. `"does not count non-edit tools even on matching file"`
   - Tool_pre Read on matching file → Bash match. Return = `0` (Read is not in `editTools`).

7. `"accepts Write as well as Edit when editTools includes both"`
   - Write on matching file → Bash match. Return = `1`.

8. `"normalizes Windows backslash paths before glob matching"`
   - Edit on `scripts\\lib\\types.ts` (escaped backslashes inside JSON) → Bash match. Return = `1` with glob `**/types.ts`.

9. `"handles malformed JSONL lines without crashing"`
   - Lines array contains `"not json"`, `"{\"broken"`, then one valid matching pair. Return = `1`.

10. `"evaluatePatterns wires file_sequence correctly"` — high-level: pass a `PatternDefinition` with `type: "file_sequence"`, assert the result object has `name`, `count`, `triggered: true` when threshold met.

Assertion shape: every test returns a plain number from `detectFileSequencePattern()` or a `PatternResult` from `evaluatePatterns()`. No mocks of the DB. No I/O. Pure function tests.

**GREEN** — edits:

1. **`scripts/lib/types.ts`** — extend `PatternDefinition` discriminated union (after the `cluster` variant, before the closing `;`):
   ```typescript
   | {
       type: "file_sequence";
       name: string;
       action: string;
       editTools: string[];         // e.g. ["Edit","Write"]
       filePathGlob: string;        // e.g. "**/types.ts"
       followedByCommands: string[];// OR semantics
       withinToolCalls: number;
       threshold: number;
       domain?: string;
     }
   ```

2. **`scripts/lib/pattern-engine.ts`** — add new exported function:
   ```typescript
   export function detectFileSequencePattern(
     lines: string[],
     def: {
       editTools: string[];
       filePathGlob: string;
       followedByCommands: string[];
       withinToolCalls: number;
     },
   ): number
   ```
   Implementation rules (from ADR-006 Decision 2 / Change 1):
   - Single forward pass, O(n) over `lines`. No nested loops.
   - Parse each line with try/catch; skip malformed.
   - Maintain a small queue of `pendingEditIndices` — each entry is `{ index: number, consumed: false }`.
   - For each `tool_pre`:
     - If `toolName ∈ editTools` and `filePath` (normalized: backslash → slash) matches `filePathGlob`, push to queue.
     - If `toolName === "Bash"` and `metadata.command` contains any string from `followedByCommands`, scan the queue for the oldest un-consumed edit whose index is within `withinToolCalls` of the current index; if found, mark consumed, increment `count`.
     - Prune queue entries whose `(currentIndex - entry.index) > withinToolCalls`.
   - Return `count`.
   - Hand-rolled glob matcher: support `**/`, `*.md`, `*` within a single segment. Unit-tested via the Phase 2 test cases (case 8 exercises the Windows path). If any Phase 2 test fails due to glob edge cases, switch to `minimatch` (already installed as a transitive dep; add to direct deps if needed).

3. **`scripts/lib/pattern-engine.ts`** — extend `evaluatePatterns()` switch with a new case:
   ```typescript
   case "file_sequence":
     count = detectFileSequencePattern(lines, {
       editTools: def.editTools,
       filePathGlob: def.filePathGlob,
       followedByCommands: def.followedByCommands,
       withinToolCalls: def.withinToolCalls,
     });
     break;
   ```

**REFACTOR**: If `pattern-engine.ts` exceeds 200 lines after both new detectors land, extract glob-normalization helper (`normalizePath`) and glob-matching helper (`matchGlob`) to a private module-scope block at the top of the file. Do not create a new file unless the file exceeds 400 lines (unlikely).

**Complexity**: M
**Dependencies**: Phase 1 (observations must be schema-compatible, but since `file_sequence` reads `filePath` and `metadata.command` which already exist, this phase technically could run in parallel — keep sequential for review clarity)
**Risk**: Medium. Glob matching is new surface and Windows paths are the main risk. Mitigated by test case 8 specifically exercising backslash input.

---

### Phase 3 — Pattern type: `tool_arg_presence` (M)

**Goal**: Add the `tool_arg_presence` variant to `PatternDefinition`, add `detectToolArgPresencePattern()`, wire into `evaluatePatterns()`. Covers Pattern G only.

**RED** — new test file `tests/lib/pattern-engine-tool-arg-presence.test.ts`:

1. `"counts tool_pre events where metadata[key] contains expectedValue (happy path)"`
   - Lines: 3 tool_pre events, all `toolName: "Skill"`, with `metadata.skillName` values `skill-creator:skill-creator`, `other-skill`, `skill-creator:skill-creator`.
   - Call `detectToolArgPresencePattern(lines, { toolName: "Skill", metadataKey: "skillName", expectedValues: ["skill-creator"] })`.
   - Assert return = `2`.

2. `"returns 0 when toolName does not match"`
   - All events are `toolName: "Edit"`. Return = `0`.

3. `"returns 0 when metadata key is missing"`
   - Skill events but metadata has no `skillName` field. Return = `0`.

4. `"matches any expectedValue (OR semantics)"`
   - Events with `skillName` values `foo:bar`, `baz:qux`. expectedValues `["foo","baz"]`. Return = `2`.

5. `"handles malformed JSONL without crashing"` — same pattern as Phase 2.

6. `"evaluatePatterns wires tool_arg_presence correctly"` — high-level dispatcher test with full `PatternDefinition`, asserts `PatternResult.triggered` when count >= threshold.

**GREEN** — edits:

1. **`scripts/lib/types.ts`** — append to discriminated union:
   ```typescript
   | {
       type: "tool_arg_presence";
       name: string;
       action: string;
       toolName: string;
       metadataKey: string;
       expectedValues: string[];   // OR semantics; substring match
       threshold: number;
       domain?: string;
     }
   ```

2. **`scripts/lib/pattern-engine.ts`** — add detector:
   ```typescript
   export function detectToolArgPresencePattern(
     lines: string[],
     def: {
       toolName: string;
       metadataKey: string;
       expectedValues: string[];
     },
   ): number
   ```
   Walk lines, for each `tool_pre` where `e.toolName === def.toolName`, read `e.metadata?.[def.metadataKey]`, count if the value is a string and contains any `expectedValues[i]` as substring. Return count.

3. **`scripts/lib/pattern-engine.ts`** — switch case in `evaluatePatterns()`:
   ```typescript
   case "tool_arg_presence":
     count = detectToolArgPresencePattern(lines, {
       toolName: def.toolName,
       metadataKey: def.metadataKey,
       expectedValues: def.expectedValues,
     });
     break;
   ```

**REFACTOR**: None expected. ~15-line detector.

**Complexity**: M
**Dependencies**: Phase 1 (depends on `metadata.skillName` being captured; without Phase 1, Pattern G has nothing to read).
**Risk**: Low-Medium. Pure counter. ADR-006 flags this whole type as "drop if no evidence after dogfood" — treat as the least load-bearing phase. Do NOT delete the code if dogfood kills the pattern; just remove the definition from the JSON. The type stays available for future reuse.

---

### Phase 4 — Pattern definitions rewrite (M)

**Goal**: Replace all 13 hygiene entries in `.claude/hooks/pattern-definitions.json` with the 12 domain-specific patterns specified in ADR-006 Table 2 (rows A–L). Single atomic rewrite.

**RED** — extend `tests/lib/pattern-engine.test.ts`:

1. Add/update the existing `"loads definitions from JSON file"` test:
   - Assert exact count: `expect(defs.length).toBe(12)` (was: `>= 8`).
   - Assert no hygiene names remain — regression guard. Use a hard-coded denylist of the 13 old names and assert none appear:
     ```typescript
     const banned = [
       "Read files before editing them",
       "Verify before committing code",
       "Explore multiple files before taking action",
       "Search before writing new code",
       "Test after implementing changes",
       "Check dashboard for system health",
       "Plan before implementing changes",
       "Read tests alongside source code",
       "Commit before pushing",
       "Re-run tests after fixing failures",
       "Multi-file refactor pattern",
       "Glob search before editing",
       "Build after editing TypeScript",
     ];
     for (const def of defs) expect(banned).not.toContain(def.name);
     ```
   - Assert every loaded definition has `type` in `["sequence","command_sequence","cluster","file_sequence","tool_arg_presence"]`.
   - Assert the type distribution matches ADR-006 Decision 1: 10 `file_sequence`, 1 `tool_arg_presence`, 1 `cluster`. (This is the load-bearing structural assertion.)

2. Add regression test: `"all file_sequence definitions have threshold 1"` per ADR-006 risk mitigation — starting threshold is `1` across the board. Iterate defs and assert `def.threshold === 1` when `def.type === "file_sequence"`.

**GREEN** — fully rewrite `.claude/hooks/pattern-definitions.json`.

The 12 entries, derived directly from ADR-006 Table 2 (A–L). Glob strings, editTools, followedByCommands, and thresholds are authoritative per the ADR; if the ADR left any field implicit, konstruct picks the narrowest sensible value and documents the choice in a code comment (JSON does not allow comments, so documentation lives in this plan + commit message).

| Name | type | Key fields |
|---|---|---|
| A: `Build + test after editing types.ts` | `file_sequence` | glob `**/scripts/lib/types.ts`, editTools `["Edit","Write"]`, followedBy `["npm run build","tsc","vitest"]`, within 10, threshold 1, domain `harness-maintenance` |
| B: `Schema check after editing state-store.ts` | `file_sequence` | glob `**/scripts/lib/state-store.ts`, followedBy `["db-health","PRAGMA","vitest"]`, within 10, threshold 1, domain `data-layer` |
| C: `/doks after editing agent definition` | `file_sequence` | glob `**/.claude/agents/*.md`, followedBy `["doks","/doks"]`, within 15, threshold 1, domain `harness-maintenance` |
| D: `/doks after editing skill definition` | `file_sequence` | glob `**/.claude/skills/*.md`, followedBy `["doks","/doks"]`, within 15, threshold 1, domain `harness-maintenance` |
| E: `/doks after editing command definition` | `file_sequence` | glob `**/.claude/commands/*.md`, followedBy `["doks","/doks"]`, within 15, threshold 1, domain `harness-maintenance` |
| F: `vitest after editing hook script` | `file_sequence` | glob `**/.claude/hooks/scripts/*.js`, followedBy `["vitest"]`, within 10, threshold 1, domain `harness-maintenance` |
| G: `Skill creation must use skill-creator` | `tool_arg_presence` | toolName `Skill`, metadataKey `skillName`, expectedValues `["skill-creator"]`, threshold 1, domain `harness-maintenance` |
| H: `/doks after editing CLAUDE.md` | `file_sequence` | glob `**/CLAUDE.md`, followedBy `["doks","/doks"]`, within 15, threshold 1, domain `docs` |
| I: `/forge --dry-run after editing pattern-definitions.json` | `file_sequence` | glob `**/pattern-definitions.json`, followedBy `["forge","/forge"]`, within 15, threshold 1, domain `learning-meta` |
| J: `npm install + almanak after editing package.json` | `file_sequence` | glob `**/package.json`, followedBy `["npm install","almanak","/almanak"]`, within 15, threshold 1, domain `harness-maintenance` |
| K: `npm run build after editing types.ts` (split of A) | `file_sequence` | glob `**/scripts/lib/types.ts`, followedBy `["npm run build","tsc"]`, within 10, threshold 1, domain `harness-maintenance` |
| L: `3+ consecutive Edit cluster → checkpoint` | `cluster` | tool `Edit`, minClusterSize 3, threshold 2, domain `refactoring` |

The `editTools` default for all `file_sequence` entries is `["Edit","Write"]` unless otherwise noted.

**REFACTOR**: None. JSON file.

**Complexity**: M (high test churn, low logic churn)
**Dependencies**: Phase 2 (`file_sequence` type must exist) and Phase 3 (`tool_arg_presence` type must exist). This phase will fail RED if Phases 2/3 are not GREEN first.
**Risk**: Medium. Main risk is a glob string mismatch between the JSON and real observation filePaths. Mitigated by Phase 7 running `/forge --dry-run` live in-session and checking that the new pattern names appear in the ClusterReport (or at least in the candidate list).

---

### Phase 5 — Archive migration script (S)

**Goal**: Implement `scripts/migrate-archive-hygiene-instincts.ts`. One-shot. Idempotent. Archives any `active` instinct whose `pattern` column matches one of the 13 deleted hygiene pattern names. Leaves the archived rows in the DB (`status = 'archived'`) per ADR-006 Migration Plan Option B.

**RED** — new test file `tests/scripts/migrate-archive-hygiene-instincts.test.ts`:

Setup: use `:memory:` SQLite (via existing state-store test pattern — `KADMON_TEST_DB=:memory:`). Seed:
- 10 instincts with `status: 'active'` and `pattern` matching 10 of the 13 deleted names.
- 1 instinct with `status: 'active'` and `pattern: 'unrelated-pattern-name'`.
- 1 instinct with `status: 'archived'` and `pattern` matching a deleted name (should not be touched).

Test cases:

1. `"archives all active instincts whose pattern matches a deleted hygiene name"`
   - Run the script's exported `runArchiveMigration(db)` function.
   - Assert: 10 instincts moved from `active` to `archived`.
   - Assert: the 1 unrelated active instinct is still `active`.
   - Assert: the 1 pre-archived instinct is still `archived` (untouched, not re-updated).

2. `"is idempotent — running twice is a no-op on the second pass"`
   - Run twice in a row. Second run returns `0` archived.
   - Assert row counts unchanged after the second run.

3. `"returns the list of archived instinct IDs"`
   - First run returns an array of 10 IDs matching the seeded rows.

4. `"does nothing when no matching active instincts exist"`
   - Seed only the unrelated instinct. Run returns `0` archived, no mutation.

**GREEN** — new file `scripts/migrate-archive-hygiene-instincts.ts`:

Shape:
- Export `runArchiveMigration(db: Database): { archivedIds: string[] }` for testability.
- Hard-code `DELETED_HYGIENE_PATTERN_NAMES: readonly string[]` — all 13 names from the old JSON (same list as the banned array in Phase 4 RED).
- Use existing state-store helpers where possible. Check for an `archiveInstinct(id)` or `updateInstinctStatus(id, status)` function first (Read `scripts/lib/state-store.ts` for the actual API). If such a helper exists, use it in a loop. If not, run a single parameterized `UPDATE instincts SET status = 'archived', updated_at = ? WHERE status = 'active' AND pattern IN (?,?,?,...)` and let sql.js handle it. **Do not add a new export to state-store** unless the helper is genuinely missing and needed — the script can operate directly on a `Database` handle.
- `main()` at the bottom: opens the default DB (`~/.kadmon/kadmon.db`), calls `runArchiveMigration`, logs the count and IDs to stderr, exits. Protect with `if (import.meta.url === \`file://${process.argv[1]}\`)` so importing the file in tests does not auto-run `main`.

**REFACTOR**: None. Single-file script, <100 lines.

**Complexity**: S
**Dependencies**: Phase 4 (must know which patterns are deleted — though the list is hard-coded, logical dependency is on the rewrite being the source of truth)
**Risk**: Low. :memory: DB, idempotent by design, destructive only to rows that match the denylist.

---

### Phase 6 — Memory + roadmap + doks (S, no code) — TDD: n/a

**Goal**: Close the documentation loop and let the harness's own drift-detection catch any ripple.

Steps:

1. **Memory update**: edit `C:\Users\kadmo\.claude\projects\C--Command-Center-Kadmon-Harness\memory\project_instinct_assessment.md` — add a 2026-04-13 note describing the hygiene → domain rewrite, the 10-instinct archival, the dogfood window (2 sessions), and the re-review date (~2026-04-20). Keep the entry under ~10 lines.

2. **Roadmap check-off**: edit `docs/roadmap/v1.1-learning-system.md` Sprint A section (lines 18-45). Check off:
   - "Patrones de harness maintenance" (covered by A/B/C/D/E/F/H/I/J/K)
   - "Deprecar 6 patrones redundantes" (we deprecated 13, not 6 — note the over-delivery in the line)
   - Leave unchecked: "Patrones de workflow avanzado" (none in the 12), "Patrones de seguridad" (explicitly out of scope), "Patrones por stack" (deferred per ADR-006).

3. **/doks sync**: invoke the doks agent (via `/doks` command). Expected ripple surfaces:
   - `CLAUDE.md` "Common Pitfalls" — may want a note about `pattern-definitions.json` now being domain-specific.
   - `.claude/rules/common/hooks.md` — mentions "13 definitions from `.claude/hooks/pattern-definitions.json`" (grep confirmed line). Update to `12 definitions`.
   - `CLAUDE.md` "Status" line — test count will change (469 + new tests); doks should not hard-code, but if it does, update.
   - Any skill or command .md that mentions "13 patterns". Grep first.

**Complexity**: S
**Dependencies**: Phases 1–5 merged (doks needs the real file state)
**Risk**: Low. All changes are documentation.

---

### Phase 7 — Verification & cutover (S, no code) — TDD: n/a

**Goal**: Deterministic acceptance gate before commit+push.

Steps (in order — do not skip or reorder):

1. `npx tsc --noEmit` — must exit 0.
2. `npm run build` — must succeed; `evaluate-patterns-shared.js` and lifecycle hooks consume the compiled engine from `dist/`.
3. `npx vitest run` — must be 100% green. Expected total: **469 (old) + ~20 (new) = ~489 passing across 49 files** (new files: `pattern-engine-file-sequence.test.ts`, `pattern-engine-tool-arg-presence.test.ts`, `migrate-archive-hygiene-instincts.test.ts`; `observe-pre.test.ts` and `pattern-engine.test.ts` grow but stay in their existing files). Exact number depends on how many cases feniks adds in RED — this plan specifies the minimums.
4. **Run migration**: `npx tsx scripts/migrate-archive-hygiene-instincts.ts` against the real `~/.kadmon/kadmon.db`. Confirm stderr reports the count of archived instincts (expected: 10, possibly 9). Run `npx tsx scripts/dashboard.ts` — INSTINCTS section should show 0 active instincts whose name matches the 13 deleted hygiene names, and ARCHIVED count should have grown by the reported delta.
5. **Re-run the migration once** — expected output: `0 archived` (idempotency confirmed live, not just in tests).
6. **`/forge --dry-run` in this same session** — confirm the pipeline still works and does not crash on the new engine / new definitions. Expected: ClusterReport produced, may or may not contain triggered patterns (new thresholds are `1`, but the current session's observations may not yet have fired the new definitions). The success criterion here is "no crash + report JSON validates against the schema," not "new patterns triggered."
7. **`/chekpoint full`** — diff touches production code in `scripts/lib/`, a hook script, schema-adjacent tests, a migration script, and JSON definitions. Full tier is mandatory, no debate (per `rules/common/development-workflow.md` Tiered table rows 1, 3, 5). Expected reviewers: ts-reviewer + spektr (migration script touches SQL + file paths) + orakle (SQL UPDATE + state-store surface) + kody (consolidator). `--no-verify` is NEVER acceptable.
8. **User approval gate** — kody consolidates, user confirms, only then `git push`.

**Commit message**: `feat(pattern-engine): domain patterns A-L + file_sequence/tool_arg_presence types` (conventional, scope-tagged). Body references ADR-006 and plan-006. Footer: `Reviewed: full`.

**Complexity**: S
**Dependencies**: Phases 1–6 complete
**Risk**: Low if Phases 1–5 pass. The only live-execution risk is the migration running against a DB whose schema drifted; mitigated by running against the test `:memory:` DB first (Phase 5 tests) and by `state-store` schema being stable (no changes in this plan).

---

## Files to modify

| Path | Change | Phase |
|---|---|---|
| `.claude/hooks/scripts/observe-pre.js` | Add 3-line `Skill` branch in metadata block | 1 |
| `scripts/lib/types.ts` | Extend `PatternDefinition` union with 2 new variants | 2, 3 |
| `scripts/lib/pattern-engine.ts` | Add `detectFileSequencePattern`, `detectToolArgPresencePattern`, 2 `evaluatePatterns` switch cases, path-normalize helper, glob matcher | 2, 3 |
| `.claude/hooks/pattern-definitions.json` | Full rewrite: delete 13, add 12 | 4 |
| `scripts/migrate-archive-hygiene-instincts.ts` | **NEW** — one-shot archival script | 5 |
| `tests/hooks/observe-pre.test.ts` | Add 3 test cases for `metadata.skillName` | 1 RED |
| `tests/lib/pattern-engine-file-sequence.test.ts` | **NEW** — 10 test cases | 2 RED |
| `tests/lib/pattern-engine-tool-arg-presence.test.ts` | **NEW** — 6 test cases | 3 RED |
| `tests/lib/pattern-engine.test.ts` | Update loader test count + add banned-names regression guard + type distribution assertion | 4 RED |
| `tests/scripts/migrate-archive-hygiene-instincts.test.ts` | **NEW** — 4 test cases (happy path, idempotent, returns IDs, no-op) | 5 RED |
| `docs/roadmap/v1.1-learning-system.md` | Check off Sprint A items; note over-delivery on deprecations | 6 |
| `.claude/rules/common/hooks.md` | Update "13 definitions" reference to 12 | 6 (via doks) |
| `CLAUDE.md` | Possible ripple updates — let doks decide | 6 (via doks) |
| project memory `project_instinct_assessment.md` | 10-line dated note | 6 (manual; not a commit) |

**Not touched** (explicit — this is the frozen surface per ADR-005 / ADR-006):

- `scripts/lib/forge-pipeline.ts`
- `scripts/lib/forge-report-writer.ts`
- `scripts/lib/state-store.ts` (unless Phase 5 proves an `archiveInstinct` helper is genuinely missing; even then, a minimal additive export, never a signature change)
- `scripts/lib/instinct-manager.ts`
- `.claude/hooks/scripts/evaluate-patterns-shared.js` (already imports dynamically from `dist/`)
- Any other hook script
- Any other agent, skill, or command definition

## Out of scope

Explicitly deferred, per ADR-006 "Out of Scope":

- Sprint B alchemik step 6 "Generate" — contract defined in ADR-005, implementation is Sprint B.
- v1.1 Sprint C bugs: `sessions.ended_at` timestamp inversion, `hook_events.duration_ms` always NULL.
- `Instinct` data model changes (columns, lifecycle states, confidence math).
- `forge-pipeline.ts` consumption logic changes.
- Python / Supabase / React pattern sets.
- Plan metadata (`needs_tdd`) in observations.
- Negation / missing-sequence detection.
- SQL content inspection in `command_sequence`.
- Per-file cluster detection.
- Retention policy for archived instincts.
- New commands. New agents. New skills. New hooks.
- Promotion workflow changes.

If any work in those areas seems necessary during implementation, stop and write ADR-007. Do not bleed this plan.

## Verification checklist

- [ ] `npx tsc --noEmit` exits 0.
- [ ] `npm run build` exits 0.
- [ ] `npx vitest run` 100% green, test count >= 489 (469 baseline + new cases).
- [ ] `.claude/hooks/pattern-definitions.json` contains exactly 12 entries. Distribution: 10 `file_sequence`, 1 `tool_arg_presence`, 1 `cluster`. None of the 13 old hygiene names present.
- [ ] `PatternDefinition` union in `types.ts` has exactly 5 variants.
- [ ] `pattern-engine.ts` exports exactly 5 detectors (3 old + 2 new) plus `evaluatePatterns` and `loadPatternDefinitions`.
- [ ] `observe-pre.js` produces `metadata.skillName` for Skill tool calls and omits the key for non-Skill calls.
- [ ] Migration script run produces dashboard with 0 active hygiene instincts whose name matches the deleted list; archived count grew by the reported delta.
- [ ] Migration script run twice → second run archives 0.
- [ ] `/forge --dry-run` in a live session produces a ClusterReport without crashing on the new engine.
- [ ] `/chekpoint full` passes with 4 reviewers (ts-reviewer + spektr + orakle + kody), all BLOCK gates green.
- [ ] `/doks` run post-merge — all drift fixed or acknowledged.
- [ ] User gives explicit OK before `git push`.
- [ ] Project memory `project_instinct_assessment.md` updated with the 2026-04-13 note.
- [ ] `docs/roadmap/v1.1-learning-system.md` Sprint A items checked off.

## Rollback

The minimal safe revert path, if Phase 2 or 3 uncovers a blocking issue (e.g. the hand-rolled glob matcher has a Windows edge case that `minimatch` does not, or `file_sequence` proves to need wall-clock instead of tool-call distance):

### Scenario A — Glob matcher has a Windows edge case we cannot quickly fix
**Action**: swap the hand-rolled matcher for `minimatch`. Add to `package.json` direct deps if needed (it is already transitive via vitest). This is a 1-hour swap, not a rollback.

### Scenario B — `file_sequence` semantics prove wrong (e.g. tool-call distance is fooled by compaction, or double-consumption protection has a bug)
**Action**: if caught before Phase 4 ships, redesign the detector in-place (this is Phase 2 REFACTOR territory). If caught after Phase 4 ships, the rollback is: revert the single commit that shipped the rewrite + engine changes. Because Phases 1–5 are in one commit per the Phase 7 gate, this is a single `git revert <sha>` operation. The migration script's archival is NOT reverted automatically — archived instincts stay archived (which is the desired state regardless of whether the engine works), so there is nothing to un-do on the DB side.

### Scenario C — Pattern G (`tool_arg_presence`) produces zero signal after dogfood
**Action**: NOT a rollback. Follow the ADR-006 dogfood guidance: delete the Pattern G entry from `pattern-definitions.json` in a follow-up commit, but keep the `tool_arg_presence` type and detector in the engine code. The type is reusable and cheap to retain.

### Scenario D — The migration script archives the wrong instincts (false positives)
**Action**: the script is idempotent and purely status-updating. Reversal is a single SQL `UPDATE instincts SET status = 'active' WHERE id IN (<archivedIds>)` using the IDs the script logged to stderr. Keep the stderr output until the dogfood window is over.

### What does NOT constitute a rollback
- Empty ClusterReports from `/forge` after the cutover. ADR-006 explicitly flags this as expected behavior during the dogfood window ("Expect /forge dashboard counts to look emptier for a week. This is correct behavior — noise is going away.").
- Feniks finding a failing test mid-implementation. That is the TDD workflow working as designed, not a rollback trigger.

---

**End of plan-006.**
