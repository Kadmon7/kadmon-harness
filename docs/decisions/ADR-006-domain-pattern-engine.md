---
number: 6
title: Replace hygiene pattern definitions with domain-specific patterns and extend the engine minimally
date: 2026-04-13
status: proposed
route: A
plan: plan-006-domain-pattern-engine.md
---

# ADR-006: Replace hygiene pattern definitions with domain-specific patterns and extend the engine minimally

> **Implementation Status:** Shipped 2026-04-13 via plan-006 (commits 6a4fe16 + a62290c). 12 domain patterns active. 11 hygiene instincts archived via one-shot migration. First domain instinct (`bac7fbce` `/doks after editing CLAUDE.md`) created live in production DB. Dogfood window ends 2026-04-20 — re-review pattern G (`tool_arg_presence`) and any unfired patterns then.

**Deciders**: Ych-Kadmon (architect), arkitect (agent)

## Context

The learning loop that `/forge` (ADR-005) drives depends entirely on `.claude/hooks/pattern-definitions.json`. That file today holds 13 definitions across 3 types — `sequence`, `cluster`, `command_sequence` — and every single definition detects a hygiene rule that a hook already enforces.

**Evidence from the current project DB (dashboard run, 2026-04-13):**

- 10 of 11 active instincts are at confidence 0.9 (the cap).
- `Commit before pushing` — 85 occurrences. Already enforced by `git-push-reminder` hook.
- `Re-run tests after fixing failures` — 108 occurrences. Already observable via `post-edit-typecheck` + normal test runs.
- `Read files before editing them` — 28 occurrences. Already enforced by `no-context-guard` hook (exit 2 on violation).
- `Verify before committing code`, `Plan before implementing changes`, `Search before writing new code`, `Explore multiple files before taking action`, `Test after implementing changes` — all duplicate existing hooks or commands.

This exact diagnosis was recorded on 2026-04-05 in project memory (`project_instinct_assessment.md`). Six instincts were archived at that time; the learning engine re-created them within days because the pattern definitions that detect them still fire. The loop is self-reinforcing and tautological.

With `/forge` pipeline frozen by ADR-005, the cluster report feeding Sprint B's `/evolve` step 6 will consist entirely of hygiene noise unless the pattern definitions change. Promoting any of these instincts to a skill would duplicate a hook — the worst failure mode the learning system can produce, because it inflates context and creates two competing enforcement paths.

**Sprint A of the v1.1 roadmap** (`docs/roadmap/v1.1-learning-system.md:18-45`) commits the harness to replacing these with domain-specific patterns that detect behavior NOT covered by hooks. This ADR decides (1) which new patterns to define and (2) whether the pattern engine itself needs to grow to express them.

### Current engine capability

From `scripts/lib/pattern-engine.ts`:

- **`sequence`** — matches two adjacent tool names in the tool sequence (e.g. `Read` then `Edit`). Does not inspect file paths, tool arguments, or time gaps.
- **`command_sequence`** — matches Bash commands by substring, either in pairs (trigger → follower) or by counting trigger occurrences alone. Only reads `metadata.command` from observations. Bash-only.
- **`cluster`** — counts runs of N+ consecutive calls to the same tool name.

From `.claude/hooks/scripts/observe-pre.js`, each observation logs:

- `toolName`, `filePath` (top-level, from `tool_input.file_path` or `tool_input.path`).
- `metadata.command` for all tools (captures Bash `command`, null for others).
- `metadata.agentType`, `metadata.agentDescription` — **only for the `Agent` tool**.
- `metadata.taskSubject`, `metadata.taskDescription`, `metadata.taskId`, `metadata.taskStatus` — only for `TaskCreate`/`TaskUpdate`.

**Critical gap:** `filePath` is persisted to observations.jsonl but the pattern engine does **not consume it**. `detectSequence` only compares `toolSeq[i]`, which is the tool name. The `Skill` tool's `skill` argument (e.g. `"skill-creator:skill-creator"`) is not captured at all. Plan metadata (`needs_tdd`) lives in agent artifacts, not observations.

### Scope fence

**In scope**: pattern definition replacement, minimum engine changes required to express the accepted patterns, migration plan for the 10 redundant active instincts.

**Out of scope** (explicitly deferred):

- Sprint B alchemik step 6 "Generate" — ADR-005 already defined its input contract.
- The two v1.1 open bugs (`sessions.ended_at` timestamp inversion, `hook_events.duration_ms` always NULL) — tracked in v1.1 Sprint C.
- Changes to the `Instinct` data model, lifecycle state machine, or confidence/occurrence bookkeeping.
- Changes to the `/forge` pipeline consumption logic (`forge-pipeline.ts` is frozen by ADR-005).
- Python, Supabase, React stack patterns — activated when those stacks come online, not now.

## Decision

This ADR makes two decisions. Decision 2 is the load-bearing one.

### Decision 1: Pattern inventory — replace all 13 hygiene definitions with 12 domain-specific patterns

Evaluation of the 8 user-proposed candidates and a short list of additions surfaced by the roadmap entry:

| # | Pattern | Domain | Verdict | Notes |
|---|---------|--------|---------|-------|
| 1 | After editing `scripts/lib/types.ts`, run build + full tests | harness-maintenance | **NEEDS NEW TYPE** (`file_sequence`) | Needs filePath glob match on Edit followed by command substring match on Bash. Current `sequence` ignores filePath; current `command_sequence` ignores the tool that preceded the command. |
| 2 | When plan has `needs_tdd:true`, invoke feniks agent | workflow | **REJECT** | Plan metadata is not in observations.jsonl. Capturing it would require coupling `observe-pre` to plan artifacts, and feniks invocation is already enforced by the `/abra-kdabra` skill itself. Not worth an observation-schema change for a rule that is already load-bearing in a skill. |
| 3 | Creating/editing a skill → must use `skill-creator:skill-creator` plugin | harness-maintenance | **NEEDS OBSERVATION SCHEMA CHANGE** (log `Skill.skill` arg) + **NEEDS NEW TYPE** (`file_sequence` with negation) | observe-pre does not log Skill tool arguments today. Without the argument we cannot tell `skill-creator` apart from any other skill invocation. Worth the small observe-pre extension — this is a real, recurring compliance gap. |
| 4 | After adding agent/skill/command, run `/doks` | harness-maintenance | **NEEDS NEW TYPE** (`file_sequence`) + schema already sufficient | Requires `Write.file_path` matching `.claude/agents/**` or `.claude/skills/**` or `.claude/commands/**`, then a subsequent Skill invocation with arg `doks`. File path is already logged; Skill arg gap (see #3) applies here too. |
| 5 | Before SELECT on `sessions.ended_at`, check db-health first | data-layer | **REJECT for this ADR** | SQL substring matching would require parsing Bash command content for SQL text, which is brittle, and `sessions.ended_at` inversion is already tracked as a v1.1 Sprint C bug. Not a durable pattern — once the bug is fixed, the pattern becomes obsolete. |
| 6 | After `/abra-kdabra`, konstruct agent must run | workflow | **EXPRESSABLE** (`command_sequence` with cross-tool match) or **NEEDS NEW TYPE** | Slash commands are invoked via Bash on this project (`SlashCommand` tool is wrapped). The konstruct auto-invoke is already in `.claude/rules/common/agents.md` as a MUST rule. If a user skips konstruct, detecting that is valuable — but the signal is "no Agent call with subagent_type=konstruct after /abra-kdabra," which is a **negative-match**. Current engine cannot express negation. Deferred: the rule is already enforced by the skill chain, and ADR-005 just landed. |
| 7 | When editing `pattern-definitions.json`, archive orphaned instincts | learning-meta | **REJECT** | Meta-editorial pattern with occurrence count of 1 per ADR revision. Not a behavioral pattern; it's a one-off migration. This ADR's own migration plan handles it. |
| 8 | After editing hook scripts (`.claude/hooks/scripts/*.js`), run matching hook tests | harness-maintenance | **NEEDS NEW TYPE** (`file_sequence`) | Edit with filePath glob `.claude/hooks/scripts/**/*.js` followed by Bash command containing `vitest` and a matching test file name. Simpler variant (just "run vitest after hook edit") fits `file_sequence` cleanly without test-file matching. |

**Accepted patterns for this ADR** (the 8 above that survive) plus 4 additions drawn from the roadmap and current pain:

| # | Name | Type | Domain | Rationale |
|---|------|------|--------|-----------|
| A | After editing `scripts/lib/types.ts`, run build + vitest | `file_sequence` | harness-maintenance | Fixes real problem: types.ts changes require dist/ rebuild before lifecycle hooks pick them up. Muscle-memory gap. |
| B | After editing `scripts/lib/state-store.ts`, run db schema check | `file_sequence` | data-layer | state-store changes are the most bug-dense surface in the project; the db-health-check util exists specifically for this. |
| C | After editing `.claude/agents/*.md`, run `/doks` | `file_sequence` | harness-maintenance | Already a MUST rule; gap is in compliance not definition. |
| D | After editing `.claude/skills/*.md`, run `/doks` | `file_sequence` | harness-maintenance | Same as C. |
| E | After editing `.claude/commands/*.md`, run `/doks` | `file_sequence` | harness-maintenance | Same as C. |
| F | After editing `.claude/hooks/scripts/*.js`, run vitest | `file_sequence` | harness-maintenance | Hook scripts have co-located tests; editing without re-testing is the top cause of hook regressions per memory `project_stop_hooks_lifecycle.md`. |
| G | Skill creation/edit uses `skill-creator:skill-creator` | `tool_arg_presence` | harness-maintenance | Compliance check. Requires Skill tool arg logging. |
| H | After editing `CLAUDE.md`, run `/doks` | `file_sequence` | docs | CLAUDE.md drift detection — a common real-world gap. |
| I | After editing `pattern-definitions.json`, run `/forge --dry-run` | `file_sequence` | learning-meta | Sanity-check the engine's own input before shipping. Feeds back into the learning loop. |
| J | After editing `package.json`, run `npm install` and `/almanak` | `file_sequence` | harness-maintenance | Dependency changes without almanak lookup were a real incident (vitest 2→4 bump). |
| K | After editing `scripts/lib/types.ts`, run `npm run build` (specialization of A) | `file_sequence` | harness-maintenance | See A; split so that clustering can group build-related vs test-related patterns. |
| L | After 3+ consecutive edits to the same file, suggest checkpoint | `cluster` | refactoring | EXPRESSABLE in current `cluster` type **only if** we track the file the cluster is over — current cluster ignores filePath. **Downgraded to a plain Edit-cluster** (fits current type) with a note that per-file clustering can come later. |

**Dropped/deferred**: #2 (needs_tdd, unavailable field), #5 (SQL introspection, too narrow and obsolete soon), #6 (negation, not supported), #7 (not behavioral).

**Count**: 12 accepted patterns, 13 existing definitions deleted. Net: fewer, more useful.

### Decision 2: Engine changes — one new pattern type, one observation-schema addition

After walking the accepted list, exactly **two** engine-level changes are load-bearing. Anything beyond that is speculative.

#### Change 1: Add a new pattern type `file_sequence`

Most of the accepted patterns (A, B, C, D, E, F, H, I, J, K) share the same shape: *edit/write a file matching a glob, then run a Bash command containing a substring.* This is not expressible by any current type:

- `sequence` ignores filePath entirely (only matches tool names).
- `command_sequence` only looks at `metadata.command` in isolation; it cannot condition the trigger on an `Edit`/`Write` that preceded it.
- `cluster` counts same-tool runs, nothing else.

**Proposed TypeScript shape** (to be added to `scripts/lib/types.ts` in the `PatternDefinition` union):

```typescript
| {
    type: "file_sequence";
    name: string;
    action: string;
    /** Minimatch-style glob matched against the observation filePath. */
    filePathGlob: string;
    /** Tool names that count as "editing" the file. Usually ["Edit", "Write"]. */
    editTools: string[];
    /** Substring(s) expected in a subsequent Bash command. OR semantics across the array. */
    followedByCommands: string[];
    /** Maximum intervening observations allowed between the edit and the Bash command. */
    withinToolCalls: number;
    threshold: number;
    domain?: string;
  }
```

**Detector semantics** (`detectFileSequence` in `pattern-engine.ts`):

1. Walk observations in order.
2. On every `tool_pre` where `toolName ∈ editTools` and `filePath` satisfies `filePathGlob`, record the index.
3. For each recorded index, scan forward up to `withinToolCalls` observations. If any of them is a Bash `tool_pre` whose `metadata.command` contains any string from `followedByCommands`, count a match and consume the edit (do not double-count).
4. Return the count.

Why `withinToolCalls` rather than wall-clock time: observation timestamps exist, but sessions have compaction gaps that make wall-clock unreliable. Tool-call distance is what the engine already reasons about.

**Glob matching**: use `minimatch` (already a transitive dependency via vitest) or a 20-line recursive matcher; konstruct picks. Globs are declaration-only in `pattern-definitions.json` — never user input — so injection concerns do not apply.

**Why not extend `sequence` with an optional `beforeFileGlob` field**: would keep all matching logic in one detector but make the type union less obvious and force every `sequence` reader (loader, dry-run renderer, any future tooling) to handle an optional field that most definitions will never use. A new, narrowly-scoped type is cheaper than a leaky extension.

#### Change 2: Extend `observe-pre.js` to log `Skill.skill` argument

Pattern G (`skill-creator:skill-creator` compliance) is the only accepted pattern that the current observation schema cannot feed. The change is surgical:

```javascript
// In observe-pre.js, inside the metadata block, add:
if (toolName === "Skill") {
  metadata.skillName = input.tool_input?.skill ?? null;
}
```

That is the entire patch. No schema migration (observations.jsonl is ephemeral per session). No impact on existing hooks. Adds under 5 lines.

**No new pattern type for G** — it can be expressed with a new lightweight type or (cheaper) as a post-hoc compliance check computed inside the `/forge` pipeline's evaluator. For this ADR we pick the **lightweight new type** because it keeps pattern definitions declarative and discoverable:

```typescript
| {
    type: "tool_arg_presence";
    name: string;
    action: string;
    /** Tool name to match. */
    toolName: string;
    /** Metadata key to inspect (e.g. "skillName"). */
    metadataKey: string;
    /** Substring(s) expected. OR semantics. */
    expectedValues: string[];
    threshold: number;
    domain?: string;
  }
```

Detector: walk observations, count `tool_pre` events where `toolName === def.toolName` AND `metadata[def.metadataKey]` contains one of `expectedValues`. Simple counter.

This second type is **only justified if G stays on the accepted list**. If konstruct discovers during implementation that `Skill` tool invocations are already so rare that a simpler approach suffices, the type should be dropped in favor of in-pipeline evaluation. That is an implementation call, not an ADR call — but I am flagging it so konstruct does not blindly add the type.

**Total engine surface added**: 2 pattern types (`file_sequence`, `tool_arg_presence`), 2 detector functions, 1 observe-pre line for the Skill tool. That is the minimum needed; no more.

## Rationale

**Why not stay within existing types?** Because 10 of 12 accepted patterns require file-path matching and none of the three existing types consume filePath. Staying put would force us to drop most of the accepted list, which defeats Sprint A's goal.

**Why not add more pattern types proactively?** Speculative features rot. Memory entry `v1_prioritization.md` (ADR-008) already records the preference for "P0 first, gate tests after." The same discipline applies here: ship the minimum that makes the dogfooding loop produce meaningful ClusterReports in 1–2 sessions, then reassess.

**Why dogfood before designing Sprint B?** Sprint B (alchemik step 6 Generate) needs real ClusterReport inputs to design against. Right now the engine produces hygiene noise, so any Sprint B design built against it would be designing against a lie. One week of `/forge` runs with domain patterns produces honest input, and honest input is worth more than clever algorithms.

**Why archive the 10 redundant instincts rather than letting them decay?** Because ADR-005 explicitly deferred instinct decay to v1.1 Sprint E. Without decay, the redundant instincts will stay at confidence 0.9 forever and continue to bias cluster computation. A one-shot archival sweep, keyed to this ADR's migration plan, is the cleanest cut.

**Why not delete `pattern-definitions.json` entries that generate the bad instincts and let `/forge --prune` clean up?** `/forge --prune` requires `contradictions > occurrences`, and these instincts are not being contradicted — they are being correctly detected as hygiene events. Prune semantics do not fit. A direct archival sweep is the right tool.

## Consequences

### Positive

- **Signal quality**: the learning loop starts producing patterns that matter (harness maintenance, doks compliance, dependency management) instead of patterns that already have enforcement hooks.
- **Engine change is minimal**: 2 new types, ~80 lines in `pattern-engine.ts`, 5 lines in `observe-pre.js`. Small blast radius.
- **ClusterReport quality**: Sprint B designs against real signal. The engine change unblocks Sprint B without touching Sprint B.
- **Dogfood cycle shortens**: 1–2 sessions of normal work should produce at least 3–5 new instincts from the new definitions, versus zero new signal today.
- **Hook/instinct duplication eliminated**: the redundancy noted in `project_instinct_assessment.md` stops re-manifesting.

### Negative

- **`PatternDefinition` discriminated union grows to 5 variants**. Every consumer (loader, dry-run renderer, preview gate, any future introspection tool) must handle two more cases. Mitigated by the discriminator (`type` field) already being exhaustive via TypeScript `switch`.
- **Glob matching is new surface area** in the engine. Tests must cover: exact match, wildcard match, non-match, absolute paths vs relative paths, Windows backslashes. Mitigated by keeping globs to a whitelist of simple patterns (`**/types.ts`, `.claude/agents/*.md`, etc.) and using an established matcher.
- **`observe-pre.js` gains a conditional branch for the Skill tool**. Adds ~0.1 ms to observe-pre's budget (<50 ms target). Measurable but not concerning.
- **Instinct archival is destructive** — once the 10 redundant instincts are archived, their historical occurrence counts become inert. Mitigated by the DB keeping the rows (`status = 'archived'`) rather than deleting them, so they remain inspectable.
- **The new definitions will fire less often** than the hygiene ones did. Expect `/forge` dashboard counts to look emptier for a week. This is correct behavior — noise is going away — but will feel like regression.

### Neutral

- **No impact on hooks**. All 20 hooks continue to operate as documented.
- **No impact on `/forge` pipeline logic**. ADR-005 froze `forge-pipeline.ts`; this ADR only changes what feeds it.
- **No impact on the `Instinct` data model** or lifecycle. `upsertInstinct`, `getActiveInstincts`, `getPromotableInstincts`, and the confidence/occurrence bookkeeping are untouched.
- **Dashboard rendering is unchanged**. The INSTINCTS section will render whatever instincts exist; the content changes but the code path does not.

### Risks

- **Risk**: Glob matcher has a Windows-specific edge case (backslash normalization, drive-letter prefixes).
  - **Mitigation**: tests run on Windows; normalize `filePath` to forward slashes inside `detectFileSequence` before matching. Document in the `pattern-engine.ts` header.
- **Risk**: New patterns produce too few hits to trigger the threshold (default 3 per pattern-definitions convention), so `/forge` reports remain empty for weeks.
  - **Mitigation**: start with `threshold: 1` for all new definitions. Raise selectively once we have data. Konstruct should choose thresholds in the plan.
- **Risk**: Konstruct implements `file_sequence` with a naive scan that becomes O(n²) on long sessions.
  - **Mitigation**: the detector is linear over observations with a single forward scan. Flag this explicitly in the plan (single-pass with a sliding window, not nested loops).
- **Risk**: Pattern G (skill-creator compliance) turns out to be unnecessary because Skill tool invocations are always correct in practice.
  - **Mitigation**: konstruct can drop the `tool_arg_presence` type and pattern G during implementation if evidence from the first dogfood session shows zero non-compliant invocations. Treat G as the least load-bearing accepted pattern.
- **Risk**: The 12 accepted patterns still cluster into nothing meaningful when `/forge` runs.
  - **Mitigation**: that is itself Sprint B signal — "the clustering algorithm needs more than 12 patterns to find structure." Re-evaluate after 2 dogfood sessions and decide whether to add Python/Supabase/React patterns early (breaking scope) or accept singletons as valid cluster members (already allowed by ADR-005).

## Alternatives Considered

### Alternative 1: Just delete the 13 hygiene patterns without replacement

- **Pros**:
  - Zero engine change.
  - Fastest possible win against noise.
  - One-line fix: empty the JSON array.
- **Cons**:
  - `/forge` pipeline produces empty cluster reports.
  - Sprint B starts against zero signal, worse than designing against noise.
  - The learning loop degrades from "tautological" to "dead." The point of Sprint A is to make the loop produce value, not to turn it off.
  - Wastes the opportunity cost of the existing observation infrastructure.
- **Why not**: Making the loop silent is not the same as making it useful. This alternative solves a symptom (noise) and kills the patient.

### Alternative 2: Add all 8 user-proposed candidates verbatim, regardless of expressability

- **Pros**:
  - Maximum coverage of user intent.
  - User gets what they asked for, literally.
- **Cons**:
  - Requires at least 3 new pattern types (`file_sequence`, `tool_arg_presence`, negation/`missing_sequence`), plus observation-schema extensions for plan metadata (`needs_tdd`) and possibly SQL text inspection.
  - Scope creep: 2 of the 8 patterns would be enforced by existing skills/rules anyway (feniks auto-invoke, konstruct auto-invoke).
  - Engine grows by 4+ types in one pass, with no dogfood data to validate any of them.
  - Blast radius: every consumer of `PatternDefinition` has to handle 7 variants.
- **Why not**: ADR-005 just froze `forge-pipeline.ts`; this ADR should protect that freeze by keeping its changes narrow. Ship 2 types, dogfood, revisit. If evidence demands more, add them in ADR-007 against evidence rather than speculation.

### Alternative 3: Extend existing `sequence` type with optional filePath glob instead of adding `file_sequence`

- **Pros**:
  - Fewer variants in the discriminated union.
  - Less code duplication in the detector.
- **Cons**:
  - `sequence` semantics become ambiguous: does a plain `{ before: "Read", after: "Edit" }` match regardless of file, or does it require an absent glob to explicitly mean "any"? Either answer is a trap.
  - All 4 existing `sequence` definitions would need the optional field handled.
  - Leaky abstraction — internal detector complexity for a surface-level simplification.
- **Why not**: A narrow new type is cheaper than a leaky extension. TypeScript discriminated unions are explicitly designed for this; using them here costs one more `case` branch in the detector switch and saves semantic ambiguity.

### Alternative 4: Keep hygiene patterns, but gate them out of ClusterReports using a denylist

- **Pros**:
  - No engine change.
  - No observation change.
  - No instinct archival.
  - Preserves historical confidence data.
- **Cons**:
  - Denylist is another layer to maintain; it has to be kept in sync with the 13 hygiene pattern names.
  - `/forge` still upserts the redundant instincts every session — they just don't reach the report. The DB keeps growing with noise.
  - Dashboard still renders the redundant instincts. The user still sees them.
  - Does not address the Sprint A mandate to define domain patterns.
- **Why not**: It fixes the symptom (noise in ClusterReports) without fixing the cause (tautological pattern definitions), and it does nothing for Sprint A's actual goal.

## Migration Plan for Existing Instincts

The 10 currently-redundant active instincts need to leave the DB's active set. Two options:

**Option A — Sweep via `/forge --prune`**: rejected above. Prune semantics (`contradictions > occurrences`) do not match the failure mode.

**Option B — One-shot archival SQL**: run a single `UPDATE instincts SET status = 'archived', updatedAt = ? WHERE status = 'active' AND pattern IN (...)` keyed to the 13 pattern names we are removing. Rows stay in the table, status changes to `archived`, they disappear from `getActiveInstincts()`, and they no longer bias clustering.

**Decision**: Option B. Konstruct produces a one-shot migration script `scripts/migrate-archive-hygiene-instincts.ts` that:

1. Reads the current `pattern-definitions.json` pattern names (the 13 about to be deleted).
2. Archives active instincts whose `pattern` field matches any of those names.
3. Logs the count and writes the archived IDs to stderr.
4. Is idempotent — running twice is a no-op.
5. Runs once, manually, as part of ADR-006 rollout.

The script is not a recurring hook and is not wired into `/forge`. It runs once, ships the rollout, and stays in `scripts/` as an inert historical record (same pattern as `scripts/migrate-v0.4.ts`).

**Why not delete the archived rows**: the `status = 'archived'` state already exists in the lifecycle state machine (`types.ts:24-30`) and is the correct signal. Deletion loses history; archival preserves it.

## Cross-References

- **ADR-005** (`docs/decisions/ADR-005-forge-evolve-pipeline.md`) — defines the `/forge` pipeline and `ClusterReport` contract that this ADR feeds. Pipeline logic is frozen; this ADR only changes inputs.
- **Plan-005** (`docs/plans/plan-005-forge-evolve-pipeline.md`) — the forge implementation plan. Nothing in plan-005 should need to change because of this ADR.
- **Plan-006** (to be written by konstruct) — `docs/plans/plan-006-domain-pattern-engine.md`. Scope: new pattern types, detector functions, observation-schema patch, pattern-definitions.json rewrite, archival migration script, tests.
- **v1.1 Roadmap Sprint A** (`docs/roadmap/v1.1-learning-system.md:18-45`) — the sprint this ADR executes.
- **Project memory** `project_instinct_assessment.md` (2026-04-05) — original diagnosis of the hygiene-loop problem. This ADR is the fix.
- **Project memory** `decision_forge_pipeline.md` — captures the frozen-pipeline constraint.

## Out of Scope

The following are explicitly deferred and MUST NOT be designed or implemented as part of this ADR or plan-006:

- **Sprint B alchemik step 6 "Generate"** — input contract already defined in ADR-005; implementation is Sprint B.
- **v1.1 bug: `sessions.ended_at` timestamp inversion** — tracked in v1.1 Sprint C. Not touched by this ADR.
- **v1.1 bug: `hook_events.duration_ms` always NULL** — tracked in v1.1 Sprint C. Not touched.
- **Changes to the `Instinct` data model** (columns, lifecycle states, confidence math) — stable contract.
- **Changes to the `/forge` pipeline consumption logic** in `forge-pipeline.ts` — frozen by ADR-005.
- **Python, Supabase, React pattern sets** — activated when those stacks come online, per roadmap ordering.
- **Plan metadata in observations** (`needs_tdd`, etc.) — required only for rejected pattern #2; not worth the observation-schema coupling.
- **Negation / missing-sequence detection** — required only for rejected pattern #6; revisit when we have a real compliance gap that demands it.
- **SQL content inspection** in `command_sequence` — rejected pattern #5; data-layer concerns should not leak into the engine.
- **Per-file cluster detection** (cluster type reasoning about filePath) — pattern L downgraded to plain Edit-cluster. Revisit after dogfood if per-file refactor signal becomes load-bearing.
- **Retention policy for archived instincts** — out of scope; defer to Sprint E decay work.

## Review Date

Revisit this ADR after 2 full `/forge` dogfood sessions (estimated by 2026-04-20). Specifically re-evaluate:

1. Are the 12 new patterns firing often enough to produce non-empty ClusterReports?
2. Is pattern G (`skill-creator:skill-creator` compliance) producing any signal, or should it be dropped?
3. Does the clustering output suggest new patterns worth adding for ADR-007?
4. Did `file_sequence` introduce any Windows path-normalization bugs?

If all four answers are positive, this ADR closes as "validated." Otherwise, amendments belong in ADR-007, not a retrofit of this one.

## Post-Ship Follow-Up

**2026-04-13 — `file_sequence` follow-up matching: Bash-only → Bash + Skill (dual-surface).**

During the Phase 7 verification window after plan-006 shipped (commit `6a4fe16`), dogfood surfaced a silent gap in `detectFileSequencePattern`: follow-up matching only checked `Bash.metadata.command`. But slash commands like `/doks`, `/forge`, `/almanak` are invoked as **Skill tool calls** in Claude Code, not as Bash commands — their name lives in `Skill.metadata.skillName`. As a result, 5 of the 12 domain patterns shipped in this ADR (C, D, E, H, I, and the `/almanak` half of J) could never fire in real usage, despite their definitions being correct.

The fix extends the detector to inspect **both** `Bash.metadata.command` and `Skill.metadata.skillName`, using the same `followedByCommands` substring match for either surface. This is additive — no definitions change, no existing tests regress — and was covered by 3 new tests in `tests/lib/pattern-engine-file-sequence.test.ts` (Skill branch matches, Skill branch doesn't match, Bash and Skill are interchangeable).

This does not invalidate the Review Date checklist above; question #1 ("Are the 12 patterns firing often enough?") should simply now be answerable with real signal from the 5 previously-dead patterns. Question #4 ("Did `file_sequence` introduce any Windows path-normalization bugs?") remains open.

**Maintenance note for future editors of `detectFileSequencePattern`**: both the Bash branch and the Skill branch must stay in sync. When adding a new follow-up surface (e.g. a hypothetical `SlashCommand` tool), update both the detector and `tests/lib/pattern-engine-file-sequence.test.ts`. CLAUDE.md "Common Pitfalls" records this invariant.
