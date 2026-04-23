---
number: 5
title: Refactor /instinct to /forge with unified pipeline and /evolve handoff contract
date: 2026-04-13
status: accepted
route: A
plan: plan-005-forge-evolve-pipeline.md
---

# ADR-005: Refactor /instinct to /forge with unified pipeline and /evolve handoff contract

> **Implementation Status:** Shipped 2026-04-13 via plan-005 (commits 6eae906…6a4fe16). `/forge` end-to-end live. `/instinct` alias deprecated until 2026-04-20. Promoted to `accepted` on 2026-04-14 along with ADR-006/ADR-007/ADR-008 once MADR `accepted` status was adopted repo-wide.

**Deciders**: Ych-Kadmon (architect), arkitect (agent)

## Context

The current `/instinct` command is a verb-as-noun mismatch. Its purpose is to *forge* raw session observations into tempered, high-confidence patterns — but the command reads as if it manages a static collection ("the instincts"). More importantly, it exposes a flat bag of six subcommands (`status`, `eval`, `learn`, `promote`, `prune`, `export`) that overlap with other surfaces:

- `status` duplicates the INSTINCTS section already rendered by `/kadmon-harness` (dashboard.ts:370-389), including the `→ promote` hint for promotable rows.
- `eval` is mechanically the same data as `status` plus per-row recommendations — it exists only to pre-compute what a promotion gate would show anyway.
- `learn`, `promote`, `prune` are three manual entry points to a pipeline that naturally runs as one sequence (read observations → reinforce/create → flag promotable → archive decayed → present).
- `export` is scaffolding for v1.1 Sprint E cross-project sharing and has no consumer today.

This mirrors the pre-redesign state of `/medik` (see memory: `decision_medik_redesign.md`), which replaced five subcommands with a single "always deep, agent diagnoses and repairs" pipeline gated by user approval. That redesign is now the project idiom for lifecycle-style commands and was dogfooded in v1.0.

Separately, Sprint B of the v1.1 roadmap (`docs/roadmap/v1.1-learning-system.md:47-59`) commits the harness to adding a sixth step to the `/evolve` (alchemik) workflow: *Generate*. Step 6 will group related instincts and propose skills, commands, agents, rules, or hooks through an approval gate. Step 6 is explicitly **out of scope for this ADR**, but its input contract is not — once Sprint B starts, alchemik needs a stable, versioned shape to consume. Defining that contract while we still control the producer avoids a painful retrofit later.

Finally, the SQL table `instincts` and the four exported functions in `scripts/lib/state-store.ts` (`upsertInstinct`, `getActiveInstincts`, `getPromotableInstincts`, `getInstinctCounts`) are the ground truth of the learning subsystem and are depended on by dashboard rendering, session-end hooks, and the learning pipeline. The noun "instinct" is correct for the data model — only the command (the verb) is mis-named.

### Scope fence

**In scope**: command rename, subcommand consolidation, preview gate, minimal CLI escape hatches, deprecation alias, handoff contract shape for `/evolve` step 6.

**Out of scope** (v1.1 Sprint B/E items, explicitly deferred):

- Cross-project auto-promotion (`confidence >= 0.8` across 2+ projects → `scope=global`)
- Instinct decay (no-refresh-in-30-days → `confidence -= 0.02/week`)
- Real cross-project import/export with conflict resolution
- Implementation of `/evolve` step 6 "Generate" itself — only its *input contract*

## Decision

We rename `/instinct` to `/forge`, collapse the six subcommands into a single deep pipeline with a preview gate, keep two narrow escape hatches, and define a typed `ClusterReport` as the stable handoff contract from `/forge` to the future `/evolve` step 6.

### D1. Rename `/instinct` → `/forge` (command/UX only)

The user-facing verb becomes `/forge`. The noun "instinct" is preserved everywhere it already lives:

- SQL table stays `instincts`.
- State-store functions keep their names: `upsertInstinct`, `getInstinct`, `getActiveInstincts`, `getPromotableInstincts`, `getInstinctCounts`, `insertInstinct`, `promoteInstinct`.
- Type `Instinct` in `scripts/lib/types.ts` stays.
- Dashboard section header "INSTINCTS" and the "N active (M promotable)" banner stay.
- Observation hooks (`observe-pre`, `observe-post`, `session-end-all`) are untouched — they write observations, not instincts, and the forge pipeline reads those observations.

This is a verb/noun split, not a data-model rename. The rename costs a skill file rename, a command file rename, and any documentation/cross-reference touches (CLAUDE.md Commands table, `.claude/rules/common/agents.md` command catalog, dashboard promote-hint text, roadmap references, the existing memory entry pointing at `/instinct`).

### D2. Consolidate six subcommands into a single pipeline

`/forge` (no argument) runs the full pipeline in order:

1. **Read** — load observations JSONL for the current session from the temp directory.
2. **Extract** — run pattern detection against `pattern-definitions.json` and produce candidate patterns.
3. **Reinforce / Create** — for each candidate, either `upsertInstinct` to bump confidence and occurrences, or create a new instinct at confidence 0.3 (current `learn` semantics).
4. **Evaluate** — compute per-row recommendations (`promote | keep | prune`) using the same thresholds as today (`promote` at `confidence >= 0.7 && occurrences >= 3`, `prune` at `confidence < 0.2 && occurrences < 2` or `contradictions > occurrences` older than 7 days). This is the former `eval` output, computed in-memory, not a separate subcommand.
5. **Cluster** — group instincts by similarity/domain/action to produce a `ClusterReport` (see Handoff Contract below). Clusters are computed, not stored.
6. **Preview Gate** — present a single structured table:
    - what WOULD be reinforced, created, promoted, or pruned,
    - the cluster report,
    - totals and expected state deltas.
   The user approves, rejects, or edits the plan. Nothing is mutated until approval.
7. **Apply** — on approval, run `upsertInstinct` and status transitions (`active → promoted`, `active → archived`). Write the cluster report to the session's working directory as `forge-clusters-<session-id>.json` so it can be consumed out-of-band (see D5).
8. **Report** — print what changed and surface the cluster report path.

The pipeline is always "deep". There is no `--light` mode. This mirrors the `/medik` redesign idiom: the agent diagnoses and repairs in one pass, gated once at a single approval point.

### D3. Drop redundant subcommands

The following are removed entirely:

| Removed | Replacement |
|---------|-------------|
| `/instinct status` | `/kadmon-harness` dashboard (already renders INSTINCTS section with confidence bars and `→ promote` hint) |
| `/instinct eval` | Preview gate step 4+6 of the unified pipeline (same data, in-flight) |
| `/instinct learn` | Pipeline step 3 |
| `/instinct promote` | Pipeline step 6+7 (promotion is proposed, approved, then applied) |
| `/instinct prune` | Pipeline step 6+7 (prune is proposed, approved, then applied) |

No subcommand parser accepts the old names *except* as deprecation aliases (see D6).

### D4. Minimal escape hatches

Only two escape hatches survive:

- **`/forge --dry-run`** — run steps 1–6 (read, extract, reinforce-in-memory, evaluate, cluster, preview) and print what WOULD happen, but skip step 7 entirely. No DB writes, no gate. Useful for CI, for introspection, and for debugging the pipeline without polluting state. Also useful as the "I just want to see" replacement for former `status`/`eval` without hitting the dashboard.
- **`/forge export`** — export current `instincts` rows for the current project to a JSON file. This is Sprint E scaffolding (deferred feature); we keep the CLI surface now so Sprint E does not require *another* rename. It is documented as "v1.1 preview — shape may change before cross-project sync ships." The output format is a thin serialization of `Instinct[]` with a header block containing `{ project_hash, exported_at, schema_version: 1 }`. It is NOT the `ClusterReport`.

No other flags. No positional arguments. `/forge` and `/forge --dry-run` and `/forge export` are the entire surface.

### D5. Handoff contract to `/evolve` step 6 — `ClusterReport`

This is the most important design decision in this ADR, because it is the only part that binds a component that does not yet exist.

**What is a cluster?** A cluster is a set of instincts that share enough structural similarity (action verb, domain, file-pattern affinity, or recurring pattern text) that they would reasonably be generalized together into a single higher-order artifact — a skill, a command, an agent, a rule, or a hook. A cluster is a *proposal surface*, not a ground-truth grouping.

**How are clusters represented?** As a typed TypeScript interface (`ClusterReport`) living in `scripts/lib/types.ts` alongside `Instinct`. Each cluster carries the member instinct IDs (not copies), a suggested evolution category (aligned with the five categories in `alchemik.md`: PROMOTE, CREATE AGENT, CREATE COMMAND, CREATE RULE, OPTIMIZE — plus CREATE HOOK which alchemik should gain in Sprint B), and confidence/support metrics so step 6 can rank proposals.

**Stored or computed?** **Computed at handoff time**, not stored in the DB. Reasons:

- The DB stays single-sourced on observational facts (`instincts` rows). Clusters are a *view* over those facts.
- Clusters would decay in value if cached — every new session reshapes the clustering.
- Storing clusters creates a second sync problem (instinct updated → cluster stale) that we do not need.
- Computing at handoff costs O(n²) similarity on active instincts, and `n` is already bounded (current project: ~10 active). Cheap.

**How does it get from `/forge` to `/evolve`?** As a **JSON file** written to a known path, not an in-memory pipe:

- Path: `~/.kadmon/forge-reports/forge-clusters-<session-id>.json` (sibling to the DB, lives outside the repo, not committed).
- Written by `/forge` step 7.
- Read by `/evolve` step 6 when alchemik is invoked.
- Alchemik is allowed to also compute a fresh report from the DB if the file is missing or stale (older than the current session).

**Why a file, not in-memory?**

- `/forge` and `/evolve` are independent commands, often run in different sessions (days apart). In-memory coupling is impossible.
- A file is diff-able, inspectable, reproducible, and cacheable.
- A file survives `/kompact` and session restart.
- A file can be committed by the user if they want to audit a specific forge→evolve handoff in a PR.

**Schema versioning.** The contract carries `schemaVersion: 1`. Alchemik must check this on read. Bump the version on any breaking change; provide a migration or hard-error with a clear message.

See the full `ClusterReport` interface in the **Handoff Contract** section below.

### D6. Alias strategy — deprecate `/instinct` for 1–2 sessions

The command file `.claude/commands/instinct.md` is renamed to `.claude/commands/forge.md`. A thin stub `.claude/commands/instinct.md` is kept for one to two sessions as a deprecation alias:

- Invoking `/instinct` (with or without old subcommand) prints a warning to stderr:
  `[deprecated] /instinct → /forge. Subcommands were removed; see /forge --dry-run. This alias will be removed after 2026-04-20.`
- The alias then forwards to `/forge` with the closest equivalent behavior:
    - `/instinct`, `/instinct status`, `/instinct eval` → `/forge --dry-run`
    - `/instinct learn`, `/instinct promote`, `/instinct prune` → `/forge`
    - `/instinct export` → `/forge export`
- Remove the alias entirely once the user confirms muscle memory has shifted (calendar check at 2026-04-20, i.e. ~1 week after rollout).

The removal is a single-line deletion (plus the stub file) and does not require a schema or data migration.

## Rationale

**Why rename at all?** The verb/noun mismatch is the kind of papercut that compounds: every time a new collaborator reads the command name, they have to infer the action from the noun. `/forge` makes the action self-evident and protects the noun "instinct" for the data model, where it is correct.

**Why consolidate?** Six subcommands forced the user to sequence them mentally (learn → eval → promote → prune) and then run them one at a time. The pipeline encodes the sequence. The preview gate preserves user control at the exact point where mutation happens, which is the only control point that matters. This is the same reasoning that drove the `/medik` redesign — see memory `decision_medik_redesign.md`.

**Why keep `--dry-run` and `export`?** Dry-run serves two constituencies: CI/scripted checks and "I just want to inspect what pattern extraction would say." It costs one flag. Export is Sprint E scaffolding — keeping the surface today means Sprint E ships without yet another rename, and the cost is a ~20-line serializer that writes what is already a stable shape (`Instinct[]`).

**Why a typed file contract for the handoff?** Because `/forge` and `/evolve` are decoupled in time and session. Because the `ClusterReport` is not raw data — it is a *view* that can drift — so storing it in SQL would create a sync problem. Because defining the contract *now*, with a schema version, prevents the Sprint B author from having to reverse-engineer what `/forge` emits. Because a JSON file is the simplest possible cross-command IPC the harness already understands (hook events, observations, session summaries all use the same pattern).

**Why a short deprecation window?** The alias is a kindness to muscle memory, not a compatibility contract. v1.0 is production but has a single user and 2 collaborator targets; two sessions is enough for recall to adjust. Long deprecation windows rot into permanent aliases — we've seen this on other projects.

## Consequences

### Positive

- **Command surface shrinks**: 6 subcommands → 1 pipeline + 2 flags. Easier to teach, easier to remember, one approval point.
- **Verb/noun split clarifies the mental model**: `/forge` is the action, `instincts` are the data, `/evolve` is the meta-evolution.
- **Preview gate is always on**: no accidental promotion or prune. Matches the `/medik` and `/chekpoint` gate discipline already in the harness.
- **Handoff contract is defined before the consumer exists**: Sprint B can start immediately against a stable schema.
- **No data migration**: table, functions, types, hooks all untouched. Only presentation and command routing change.
- **Dashboard is the single source of status truth**: one less place where "current instincts" is rendered, so fewer divergent views to keep in sync.

### Negative

- **Muscle-memory cost for the user**: `/instinct` has been in use since v0.4. One to two sessions of friction during the deprecation window. Mitigated by the alias and the warning message.
- **Writing a JSON report on every forge run**: small disk write, but it happens every time. Mitigated by the report living in `~/.kadmon/forge-reports/` (not committed) and by the file being small (tens of KB for typical active-instinct counts).
- **ClusterReport is a contract we will live with**: bumping its schema is a breaking change for future alchemik step 6. Mitigated by `schemaVersion: 1` field and by keeping the shape minimal (member IDs only, no denormalization).
- **Clustering is computed every run**: O(n²) over active instincts. Acceptable at current scale (~10 instincts); may need reconsidering past ~1000 active per project (not a near-term concern).
- **Dry-run duplicates the display logic of the preview gate**: the gate is the same table either way. Mitigated by making the gate a pure function of pipeline state and calling it from both paths.

### Neutral

- **Clustering algorithm is unspecified in this ADR**: the algorithm (similarity metric, threshold, tie-breaking) is an implementation detail that konstruct will plan and that alchemik may refine in Sprint B. The *contract* (`ClusterReport` shape) is fixed; the *producer* (clustering strategy) is free to evolve.
- **No change to how instincts are created or promoted at the data layer**: `upsertInstinct`, `promoteInstinct`, and the lifecycle state machine in `types.ts:24-30` are unchanged.
- **No change to the dashboard "→ promote" hint**: it still exists, still renders, but now points at `/forge` instead of `/instinct promote`. A one-word string change in `scripts/lib/dashboard.ts`.

### Risks

- **Risk**: Users invoke `/instinct` after the alias is removed and get "command not found."
    - **Mitigation**: The deprecation warning names the exact removal date. Emit it *every* time the alias is hit, not only once per session. Add a one-line note to CLAUDE.md Commands table during the deprecation window.
- **Risk**: The `ClusterReport` shape proves insufficient when Sprint B is actually implemented, forcing a schema bump before it has consumers.
    - **Mitigation**: Keep the shape minimal (IDs, category, confidence, support). Alchemik step 6 computes its own enrichment from the DB. A v2 schema can be introduced without breaking the file format if we keep `schemaVersion` and a `meta: Record<string, unknown>` escape hatch.
- **Risk**: Clustering produces nonsensical groupings because active instinct count is tiny.
    - **Mitigation**: Floor on minimum cluster size (1 — a single-member cluster is valid as a direct PROMOTE candidate). Treat the cluster report as a *proposal*, not a fact; alchemik still has human approval gate downstream.
- **Risk**: The forge-reports directory grows unboundedly.
    - **Mitigation**: Add a simple retention policy (keep last 20 reports) to the pipeline's step 7, or to a session-end hook. Out of scope for the ADR but noted for konstruct's plan.

## Alternatives Considered

### Alternative 1: Do nothing — keep `/instinct` with its six subcommands

- **Pros**:
    - Zero migration cost.
    - No deprecation alias to maintain.
    - No new contract to design.
- **Cons**:
    - The verb/noun mismatch persists.
    - Future `/evolve` step 6 has to define the handoff contract as a drive-by anyway — we just pay the design cost later with less context.
    - Leaves the surface inconsistent with the `/medik` idiom that the project has already adopted.
    - Doesn't solve the UX problem that `status`/`eval` overlap the dashboard.
- **Why not**: The cost of the redesign is modest (rename + stub + consolidation), and the contract work is cheaper to do *now* while we own both producer and consumer design than later when Sprint B is underway. "Do nothing" saves effort at the cost of paying it all at once later.

### Alternative 2: Rename only (`/instinct` → `/forge`), keep the six subcommands

- **Pros**:
    - Smallest possible diff: one file rename plus text changes.
    - Preserves all existing call patterns verbatim.
    - Low-risk deprecation (alias is a straight forward).
- **Cons**:
    - Solves the verb/noun papercut but leaves the subcommand bloat, the dashboard-overlap, and the missing gate in place.
    - Misses the chance to align with the `/medik` idiom.
    - Doesn't address the `/evolve` handoff contract at all — still a Sprint B drive-by.
- **Why not**: Partial fix. The consolidation and the contract are the high-leverage parts; a rename alone is cosmetic. Doing the rename and *then* coming back for the consolidation is two rounds of friction (two deprecation notices) instead of one.

### Alternative 3: Consolidate without renaming — `/instinct` becomes a single pipeline

- **Pros**:
    - No alias needed, no deprecation window, no user muscle-memory cost.
    - All the UX improvements (single pipeline, preview gate, handoff contract).
- **Cons**:
    - Preserves the verb/noun mismatch forever. The noun-named command would now mean "forge new instincts from observations" — even worse than today, because the name would actively mislead.
    - Collaborators reading the command name for the first time would still have to infer the verb.
- **Why not**: The rename is the cheap half of the decision and removes the papercut permanently. Keeping the bad name to avoid one week of alias friction is a poor trade.

### Alternative 4: Store `ClusterReport` in SQL instead of a JSON file

- **Pros**:
    - Queryable from other components.
    - Survives without an extra directory.
    - Consistent with other harness state.
- **Cons**:
    - Creates a second sync problem: `instincts` updated → cluster stale → when to recompute?
    - Requires a new table with its own schema, migration, and tests.
    - Clusters are derived data (violation of the `patterns.md` rule "NEVER store derived data that can be computed").
    - In-session coupling suggests IPC, which a file handles naturally.
- **Why not**: The patterns rule is explicit, and the clustering cost is cheap. File IPC with schema versioning is the minimum viable contract.

## Handoff Contract

The stable, versioned shape consumed by `/evolve` step 6. Defined in `scripts/lib/types.ts` (konstruct will determine the exact placement).

```typescript
// Added to scripts/lib/types.ts alongside the existing `Instinct` interface.

export type EvolutionCategory =
  | "PROMOTE"        // instinct(s) → skill
  | "CREATE_AGENT"   // cluster → agent
  | "CREATE_COMMAND" // cluster → command
  | "CREATE_RULE"    // cluster → rule
  | "CREATE_HOOK"    // cluster → hook (new in Sprint B)
  | "OPTIMIZE";      // cluster → component tweak

export interface ClusterMemberRef {
  /** FK to instincts.id — never a copy of the row */
  instinctId: string;
  /** Confidence of this member inside the cluster (0..1). May differ from instinct.confidence */
  membership: number;
}

export interface Cluster {
  /** Stable ID within this report. Not persisted, not reused across reports. */
  id: string;
  /** Suggested evolution category for this cluster. A hint for step 6, not a mandate. */
  suggestedCategory: EvolutionCategory;
  /** Human-readable label, e.g. "read-before-edit patterns" */
  label: string;
  /** Optional domain tag (TypeScript, SQL, Python, hooks, git, ...) if derivable */
  domain?: string;
  /** Member instincts (by ID). At least one member required. */
  members: ClusterMemberRef[];
  /** Aggregate metrics, recomputed each run */
  metrics: {
    /** Mean confidence across member instincts */
    meanConfidence: number;
    /** Sum of occurrences across members — proxy for evidence strength */
    totalOccurrences: number;
    /** Count of contradicted instincts in this cluster — proxy for pattern instability */
    contradictionCount: number;
    /** Sessions that contributed at least one member observation */
    distinctSessions: number;
  };
  /** Free-form rationale for the clustering decision. Used by alchemik to explain proposals. */
  rationale: string;
}

export interface ClusterReport {
  /** Contract version. Bump on breaking changes. Alchemik MUST check this on read. */
  schemaVersion: 1;
  /** Project hash at the time the report was generated */
  projectHash: string;
  /** Session that produced the report */
  sessionId: string;
  /** ISO 8601 timestamp */
  generatedAt: string;
  /** All clusters found this run. May be empty. */
  clusters: Cluster[];
  /** Instincts considered but not placed into any cluster (singletons below support threshold) */
  unclustered: ClusterMemberRef[];
  /** Aggregate totals for quick inspection without re-walking the report */
  totals: {
    activeInstincts: number;
    clusteredInstincts: number;
    unclusteredInstincts: number;
    promotableInstincts: number;
  };
  /** Escape hatch for future fields without bumping schemaVersion. Producers may populate; consumers MAY ignore. */
  meta?: Record<string, unknown>;
}
```

**File path**: `~/.kadmon/forge-reports/forge-clusters-<sessionId>.json`
**Producer**: `/forge` pipeline step 7 (on apply).
**Consumer**: `/evolve` step 6 (to be built in v1.1 Sprint B).
**Retention**: last 20 reports (konstruct to implement; policy subject to revision).
**Versioning discipline**: consumers read `schemaVersion` first, error-out with a migration hint if unknown.

## Migration Notes

Konstruct is expected to produce the step-by-step plan. High-level milestones (not prescriptive file edits):

1. **Rename command file** — `.claude/commands/instinct.md` becomes `.claude/commands/forge.md` with the new unified pipeline described in D2.
2. **Keep deprecation stub** — new thin `.claude/commands/instinct.md` whose sole behavior is (a) print the deprecation warning, (b) map the old subcommand to the closest `/forge` behavior, (c) exit.
3. **Add `ClusterReport` types** to `scripts/lib/types.ts`.
4. **Implement clustering + report writer** in a new module under `scripts/lib/` — konstruct picks the name. Pure function over `Instinct[]` producing `ClusterReport`.
5. **Wire the preview gate** — reuse the same rendering function for the interactive gate and for `--dry-run` output so they cannot drift.
6. **Update cross-references** — CLAUDE.md Commands table, `.claude/rules/common/agents.md` command catalog, dashboard promote-hint text in `scripts/lib/dashboard.ts:382`, any roadmap entries that spell `/instinct`, and the existing memory entry.
7. **Tests** — unit tests for the clustering function (happy path, empty input, singletons, contradictions), integration test for the full pipeline with `:memory:` SQLite, tests for the deprecation alias (warns + forwards correctly), tests for `--dry-run` (no mutation), tests for `ClusterReport` JSON round-trip and `schemaVersion` guard.
8. **Run `/chekpoint` at `full` tier** — the diff touches production `.ts` in `scripts/lib/` and a command file. Per `.claude/rules/common/development-workflow.md`, this is non-negotiable full tier.
9. **Remove alias** — scheduled for 2026-04-20 or one week after user confirms muscle memory shift, whichever comes first. Separate tiny commit.

### Backward compatibility

- **Data**: 100% compatible. No table, column, or type change.
- **Hooks**: untouched. `observe-pre`, `observe-post`, `session-end-all` continue to produce observations exactly as they do today.
- **Dashboard**: "INSTINCTS" section renders the same data. Only the hint text changes (`→ promote` now implies `/forge`).
- **Session start banner**: no change.
- **Memory entries**: the entry `decision_memory_system.md` in project memory mentions "/instinct" in passing; konstruct should check and update any live references to avoid stale pointers.

## Out of Scope

The following are explicitly deferred and MUST NOT be designed or implemented as part of this ADR or its plan. They belong to v1.1 Sprint B or Sprint E:

- **`/evolve` step 6 "Generate"** implementation — this ADR designs its *input* contract only.
- **Cross-project auto-promotion** (`confidence >= 0.8` in ≥2 projects → `scope = global`) — Sprint E.
- **Instinct decay** (confidence erosion over calendar time) — Sprint E.
- **Real cross-project import/export with conflict resolution** — Sprint E. The `/forge export` subcommand is scaffolding only.
- **Clustering algorithm selection** (similarity metric, threshold tuning, domain detection heuristics) — implementation detail for konstruct's plan; not a design decision.
- **Retention policy for `forge-reports/`** — konstruct to pick a default (last 20 suggested); revisit if it becomes a problem.
- **Alchemik model/tool changes** to support step 6 — Sprint B.
- **Dashboard rewrites** beyond updating the promote-hint text — out of scope.
- **Changes to the `Instinct` lifecycle state machine** (`active` → `promoted` → etc.) — the contract is stable and documented in `types.ts:24-30`.
