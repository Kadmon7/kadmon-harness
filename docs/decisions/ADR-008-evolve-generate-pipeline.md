---
number: 8
title: /evolve Generate step 6 — cross-project artifact generation pipeline
date: 2026-04-14
status: proposed
route: A
plan: plan-008-evolve-generate-pipeline.md
---

# ADR-008: /evolve Generate step 6 — cross-project artifact generation pipeline

**Deciders**: Ych-Kadmon (architect), arkitect (agent)

## Context

ADR-005 closed the producer half of the forge -> evolve loop: `/forge` now writes a versioned `ClusterReport` JSON to `~/.kadmon/forge-reports/forge-clusters-<sessionId>.json` and deprecated the old `/instinct` subcommands (shipped 2026-04-13). The consumer half — `/evolve` step 6 "Generate" — was deferred with a placeholder in `types.ts:34` ("Consumed by /evolve step 6 Generate (v1.1 Sprint B, not yet implemented)") and explicitly left out of scope for ADR-005.

Sprint B of v1.1 now ships that consumer. The strategic context (decided by the user, not relitigated here):

1. **Sprint B ships BEFORE plan-003 distribution.** Reversing the original deferral. Rationale: running `/forge` in a real second project is the only way to validate that the heuristics generalize, and plan-003 (bootstrap) presupposes the loop actually closes.
2. **CWD-aware execution.** `/evolve` must be invocable from any project directory — `Kadmon-Harness`, `Kadmon-Sports` (already on GitHub as `Kadmon7/Kadmon-Sports`), `ToratNetz`, `KAIRON`. Cluster reads MUST be scoped to the current project's `projectHash`, and generated artifacts MUST land in `{cwd}/.claude/{type}/`, not in the Kadmon-Harness tree.
3. **Shared DB, isolated content.** Everything still lives in `~/.kadmon/kadmon.db`. Cross-project isolation is achieved by filtering on `project_hash`, which is already how `state-store.ts:429` serves instincts and how `forge-pipeline.ts:100` reads them.

The projectHash primitive that makes this work is already correct. `project-detect.ts:22` computes `projectHash = hashString(remoteUrl)` where `remoteUrl` comes from `git remote get-url origin` run against `cwd` (`project-detect.ts:16`). Different git repos -> different hashes -> automatic isolation with zero new code at the data layer. The state store's filter (`state-store.ts:432`: `WHERE project_hash = ?`) and the producer's write path (`forge-pipeline.ts:244`: each fresh Instinct tagged with `projectHash`) already honor this boundary. ClusterReport carries `projectHash` in its envelope (`types.ts:86`), so the consumer only needs to trust and filter on that field.

### The loop diagram

```
Project X cwd -> /forge
   read observations (tmp/kadmon/<sessionId>)
   -> runForgePipeline({ projectHash, sessionId })     [pure]
   -> preview gate
   -> applyForgePreview                                 [single DB mutator]
   -> writeClusterReport(report)                        [~/.kadmon/forge-reports/]

Project X cwd -> /evolve  (n sessions later)
   read ClusterReports in window filtered by projectHash
   -> alchemik Audit/Identify/Propose/Validate/Report (steps 1-5)
   -> runEvolveGenerate({ projectHash, window })        [pure]   <-- new
   -> generate gate (batch approval)
   -> applyEvolveGenerate(proposals, approvals)         [single FS mutator] <-- new
      writes artifacts to {cwd}/.claude/{type}/
      invokes skill-creator:skill-creator for skills
   -> report
```

Everything ADR-005 established — "pure pipeline, single mutator, file IPC, schemaVersion guard, no DB schema change" — must be mirrored here.

## Decision

This section answers Q1-Q10 concretely. Every claim about current state is anchored to a file:line.

### Q1 — Artifact destination

**Decision:** Artifacts are always written to `path.resolve(process.cwd(), ".claude", type)`. Never to the Kadmon-Harness tree (unless cwd is Kadmon-Harness, in which case the two coincide — no special case). The `type` directory is one of `skills/`, `commands/`, `agents/`, `rules/common/` for now (hooks deferred — see Q7).

**Why:** Claude Code resolves `.claude/` from the invoker's working directory at runtime. Generated skills/commands/agents are consumed by Claude Code running in that project, so they must live there. Writing them into Kadmon-Harness would make them unreachable from Kadmon-Sports sessions and would pollute the harness tree with project-specific artifacts.

**Edge cases (all specified, none TBD):**

1. **Missing `.claude/` dir.** `applyEvolveGenerate` runs `fs.mkdirSync(target, { recursive: true })` before each write. No fatal on missing directory; creation is expected on first `/evolve` in a fresh project.
2. **Name collision with existing harness or project file.** Before any write, the mutator walks all proposed paths and checks `fs.existsSync`. If ANY collision is found, the entire batch is aborted with a diagnostic listing every collision and a suggestion (`"rename to <name>-2"` or `"delete existing file first"`). The abort is transactional: no files are written if any would collide. Rationale: generated artifacts are reversible-by-delete, but silent overwrites are not.
3. **Path safety.** The artifact name is derived from the proposal's `slug` field, validated against `/^[a-z0-9][a-z0-9-]{0,63}$/` in the pure pipeline. `path.resolve` is then used to construct the absolute target. Writes are rejected if the resolved path escapes `path.resolve(process.cwd(), ".claude")` (defensive check against pathological slugs; should never trigger but matches the `forge-report-writer.ts:36` `isUnder` pattern).
4. **cwd === Kadmon-Harness.** No special case. `.claude/` exists, artifacts are appended alongside existing 46 skills / 15 agents / 11 commands. Collision check still fires and prevents overwrite.

### Q2 — Plugin invocation orchestration

**Decision:** alchemik **proposes** only; `/evolve` command-level Claude **orchestrates** the writes and the `skill-creator:skill-creator` plugin invocation.

**Why:** Three converging pieces of evidence:

1. alchemik's frontmatter declares `tools: Read, Grep, Glob, Bash` (`alchemik.md:5`). No `Skill` tool. Adding it would be a surface-expansion change that ADR-005's precedent explicitly avoided.
2. `Grep` across `.claude/agents/*.md` returned **zero** matches for any agent with `Skill` in its `tools:` frontmatter. The project convention is: commands invoke plugins, agents don't. Breaking that convention here for one agent would be a Golden Hammer.
3. The `/abra-kdabra` command already uses this pattern: konstruct (opus subagent) produces a plan document, then command-level Claude gates on the user and invokes feniks separately (`abra-kdabra.md:30-40`). Same shape, proven idiom.

**Shape:** alchemik step 6 emits a structured list of `GenerateProposal[]` embedded in its markdown report under a machine-parseable fence (exact shape specified in Q4). `/evolve` command-level Claude parses that fence, renders the generate gate, awaits approval, then:

- For `suggestedCategory === "PROMOTE"` -> call `skill: "skill-creator:skill-creator"` with the proposal's skill spec (pattern, action, source clusters).
- For everything else (`CREATE_COMMAND`, `CREATE_AGENT`, `CREATE_RULE`) -> `applyEvolveGenerate` writes markdown directly from templates under `scripts/lib/evolve-generate-templates/`.

This split preserves the constraint that "skills must go through the plugin" (`rules/common/agents.md:18`) without making alchemik a Skill-tool caller.

### Q3 — Multi-report consumption window

**Decision:** Read all ClusterReports in `~/.kadmon/forge-reports/` whose `projectHash` matches the current cwd's hash AND whose `generatedAt` is within the last `KADMON_EVOLVE_WINDOW_DAYS` days (default: **7**). Merge clusters from multiple reports by `instinctId`, **keeping the most recent membership score** when duplicates appear.

**Why:** 
- **Most-recent-only** (option a) discards evidence: if the user ran `/forge` on Monday and Tuesday, Tuesday's report is a snapshot, not a union.
- **All-time** (option c) is unbounded and drifts: instincts that were real 6 months ago but are now stale would keep re-surfacing as generate proposals.
- **Windowed** (option b, chosen) gives a rolling picture that decays naturally and caps read work at O(reports-in-window).

**Merge semantics** (the non-obvious part): when the same `instinctId` appears in 2 reports with different `membership` values, the consumer takes the value from the report with the newer `generatedAt`. Rationale: confidence drifts upward as patterns are reinforced (`forge-pipeline.ts:233`: `confidence += 0.1` per reinforcement); the newer report reflects the current confidence. If the same `clusterId` appears in 2 reports with different member sets, the consumer takes the **union** of members, again with membership-by-most-recent-report. Cluster metrics (`meanConfidence`, `totalOccurrences`, `distinctSessions`) are **recomputed** from the merged member set against the live `getActiveInstincts(projectHash)` — the stored metrics in old reports are ignored as stale.

**Empty-window behavior:** if zero reports match, `runEvolveGenerate` returns `{ proposals: [], skipped: "no-reports-in-window" }` and alchemik's report surfaces "No forge reports in the last 7 days for project <hash-prefix>. Run /forge first." This is a soft-skip, not an error.

### Q4 — Approval gate batch shape

**Decision:** One single table, mirroring `/forge`'s preview gate byte-for-byte where shapes permit. Rows are `GenerateProposal` items; user can `approve all`, `reject all`, or `select 1,3,5` by index.

**Gate rendering format** (adapted from `forge.md:57-89`):

```
## /evolve generate — preview

### Source window
Reports: 3 (2026-04-08 -> 2026-04-14), projectHash: 9444ca5b

### Would create (N proposals)
| #  | type    | name                        | target path                                  | complexity | confidence | source clusters     |
|----|---------|-----------------------------|----------------------------------------------|------------|------------|---------------------|
| 1  | skill   | read-before-edit-workflow   | .claude/skills/read-before-edit-workflow.md  | S          | HIGH       | workflow (4)        |
| 2  | command | test-after-change           | .claude/commands/test-after-change.md        | M          | MED        | testing (2)         |
| 3  | rule    | ts-async-error-handling     | .claude/rules/typescript/async-errors.md     | S          | HIGH       | typescript (3)      |
| 4  | agent   | performance-profiler        | .claude/agents/performance-profiler.md       | L          | LOW        | performance (2)     |

### Totals
4 proposals: 1 skill, 1 command, 1 rule, 1 agent

Approve? [all / none / 1,3 / abort]
```

**GenerateProposal schema** (the fenced JSON block alchemik must emit, validated by Zod on command-side):

```typescript
interface GenerateProposal {
  index: number;                  // 1-based for user selection
  type: "skill" | "command" | "agent" | "rule";
  slug: string;                   // kebab-case, matches /^[a-z0-9][a-z0-9-]{0,63}$/
  name: string;                   // human-readable (used in table)
  targetPath: string;             // relative to cwd, e.g. ".claude/skills/foo.md"
  sourceClusterIds: string[];     // traceability back to ClusterReport
  sourceInstinctIds: string[];    // FK to instincts table
  suggestedCategory: EvolutionCategory;
  complexity: "S" | "M" | "L";
  confidence: "HIGH" | "MED" | "LOW";
  rationale: string;              // shown in verbose mode only
  spec: SkillSpec | CommandSpec | AgentSpec | RuleSpec; // type-discriminated
}
```

**Why one table, not four:** mirrors `/forge`'s single-table precedent, keeps the approval cost constant regardless of proposal count, and lets the user approve a heterogeneous mix without repeat prompts.

### Q5 — TDD fixtures strategy

**Decision:** Use the **real 22 Kadmon-Harness instincts** as test fixtures. A helper `tests/fixtures/make-cluster-report.ts` reads the live DB (`:memory:` copy seeded from a JSON dump of current production instincts) and produces `ClusterReport` fixtures that go through `runEvolveGenerate`. Assertions verify **pipeline correctness**, not **heuristic quality**.

**What the tests verify:**
1. Schema validation: malformed ClusterReport is rejected with a clear error, not a crash.
2. Window filter: reports outside `KADMON_EVOLVE_WINDOW_DAYS` are excluded.
3. ProjectHash filter: reports from other projects are excluded (fixture includes a "wrong-project" report with a different hash; it must never appear in proposals).
4. Merge semantics: 2 fixture reports with the same instinctId but different memberships -> newer wins.
5. Proposal shape: emitted `GenerateProposal[]` passes its own Zod schema.
6. Mutator dry-run: `runEvolveGenerate` (pure) never writes files. Verified by snapshot of `fs` mock.
7. Collision detection: if a target path already exists, `applyEvolveGenerate` aborts with a listing and writes nothing.
8. Path safety: a proposal with a pathological slug (e.g. `../../../etc/passwd`) is rejected at validation time.
9. Category routing: a `PROMOTE` proposal produces a "needs plugin" marker in the apply result; `CREATE_COMMAND`/`CREATE_AGENT`/`CREATE_RULE` produce direct-write results.

**What the tests do NOT verify:** whether the generated skill is "good", whether the name is well-chosen, whether the cluster -> category mapping is semantically correct. Those are heuristic-quality questions that cannot be answered without cross-project data. **Heuristic quality refinement is explicitly deferred to Sprint B.1** — a 2-week window of real cross-project use (Kadmon-Sports, ToratNetz, KAIRON) after Sprint B ships, followed by heuristic tuning based on user feedback.

**Why real fixtures, not synthetic:** the 22 live instincts are the highest-fidelity input we have. Synthetic fixtures would encode our current guesses about cluster shape and bias the tests toward passing for the wrong reason.

### Q6 — Experimental flag

**Decision:** Mark step 6 as **experimental** in two places:

1. A new section header in `alchemik.md` step 6 description: `## Step 6: Generate (EXPERIMENTAL — refining heuristics through 2026-04-28)`.
2. A one-line note in `CLAUDE.md` under the Commands section referencing the /evolve entry.

**No code-level feature flag.** The pipeline is shipped as operational; the marker is documentation-only. Rationale: a feature flag would imply "this might be off"; the reality is "this is on, but we're still tuning the heuristics". Remove both markers at the Sprint B.1 review (target: 2026-04-28).

### Q7 — CREATE_HOOK scope cut

**Decision:** **Defer `CREATE_HOOK` category generation to Sprint B.1.** Sprint B ships skill, command, agent, and rule generation only.

**Why:** Hook script generation is categorically more complex than markdown generation:
- Hooks are TypeScript/JavaScript files with real runtime semantics (stdin parsing, exit codes, hook-event logging via `log-hook-event.js`).
- They have latency budgets (`hooks.md:82-85`: 50ms / 100ms / 500ms tiers).
- They must integrate with `.claude/settings.json` registration, which means `/evolve` would need to edit settings — a surface we've kept off-limits from auto-generation so far.
- They have security implications (one of the 20 registered hooks is `block-no-verify`; generating a bad hook could silently compromise safety).

The markdown categories (skill/command/agent/rule) are additive and reversible by file delete. A bad generated hook could block commits or mis-report errors. That asymmetry justifies a one-sprint deferral. When `CREATE_HOOK` ships in Sprint B.1 it will use real Sprint B cross-project data to inform the template, and will ship with a stricter preview gate (diff-style render + mandatory dry-run).

**Consequence:** alchemik's step 6 still **classifies** clusters as `CREATE_HOOK` in the output report (existing `EvolutionCategory` union at `types.ts:46` stays unchanged), but any `CREATE_HOOK` cluster is surfaced as **informational** in the generate gate — "3 clusters suggest new hooks; CREATE_HOOK generation is deferred to Sprint B.1" — and no proposal row is emitted.

### Q8 — Auto-sync hook for agent metadata

**Decision:** A new `PostToolUse` hook `agent-metadata-sync` on `Edit|Write` matcher. Runs **synchronously**, latency budget **< 500ms** (non-critical tier). Detects edits to `.claude/agents/*.md` frontmatter and updates two tables:
- `CLAUDE.md` — the Agents table (the `| Agent | Model |` section).
- `.claude/rules/common/agents.md` — the "Agent Catalog" and "Routing" tables.

**Execution model:** synchronous, in-process. Rationale: the edits are tiny (table row updates), the hook runs only when an agent file is touched (which is rare), and async/background adds complexity without value. Matches the existing `post-edit-format.js` and `quality-gate.js` pattern.

**Failure mode:** **warn, never block.** Exit code `1` (warning) if sync fails, with a stderr message naming the file and the detected change. Never exit `2` — a malformed frontmatter on a WIP agent file should not block the save. The warning includes a suggested manual fix.

**Scope of detection:** only `model:`, `tools:`, `description:` fields in the frontmatter. Adding new agents (i.e. creating a new `.claude/agents/*.md` file) is detected separately in a follow-up line and appends to both tables.

**Why part of Sprint B:** the /evolve generate pipeline can produce new agent files. Without this sync hook, generated agents would be invisible in the project catalog until manual sync — defeating the "close the loop" goal.

### Q9 — alchemik agent tools

**Decision:** **No change** to alchemik's `tools:` frontmatter. Current `Read, Grep, Glob, Bash` is sufficient.

**Why:** Step 6's work for alchemik is pure analysis + proposal emission. It reads ClusterReport JSON files (Read), searches for existing artifacts to avoid collisions in its proposals (Grep, Glob), and optionally runs dashboard for baseline metrics (Bash). All writes happen at command level. Adding `Write` or `Skill` would violate the "propose only" invariant and break the Q2 orchestration split.

### Q10 — projectHash filtering: cross-project isolation invariant

**Decision:** Isolation is guaranteed by the ClusterReport envelope, not by trust. The consumer (`runEvolveGenerate`) MUST:
1. Derive current `projectHash` via `detectProject(process.cwd())` at invocation time (`project-detect.ts:13`).
2. Filter `readClusterReports(baseDir)` results by `report.projectHash === currentProjectHash`. No fallback, no "close match".
3. Invariant-check each cluster's member `instinctId`s against `getActiveInstincts(currentProjectHash)` — any instinct referenced by a cluster but not present in the current project's active set is **dropped silently** (it's a stale reference from an earlier report, possibly after the instinct was archived).

**Verified current state:**
- `/forge` writes `projectHash` into ClusterReport at `forge-pipeline.ts:359`. Already correct.
- `state-store.ts:432` filters active instincts by `project_hash = ?`. Already correct.
- `project-detect.ts:22` computes hash from `git remote get-url origin`, making cwd-derived hashing automatic with no new code.

**Invariant test (ships with Sprint B):** a test fixture plants two ClusterReport files in a temp `forge-reports/` dir — one with `projectHash: "aaaa1111"`, one with `projectHash: "bbbb2222"`. `runEvolveGenerate({ projectHash: "aaaa1111" })` must return proposals derived ONLY from the first report. This locks down the isolation guarantee against future regressions.

## Consequences

### Positive
- The forge -> evolve loop is closed end-to-end. A user running `/forge` in Kadmon-Sports, accumulating sport-specific instincts over several sessions, can then run `/evolve` in the same directory and get skills/commands/agents/rules generated INTO Kadmon-Sports/`.claude/`. No manual copying, no cross-project leakage.
- plan-003 (distribution bootstrap) can ship next with a real validated loop behind it. The deferral reversal paid off.
- The pure/mutator split from ADR-005 is preserved (`runEvolveGenerate` + `applyEvolveGenerate`), so the same testing strategy (dry-run fixtures + single-mutator integration tests) transfers.
- No DB schema changes, no migration script needed. Sprint C (ADR-007 data integrity) is unaffected.

### Negative
- Heuristics are naive at launch. The mapping "cluster -> proposal type" is driven by `suggestedCategory` from ADR-005's `buildCluster` (`forge-pipeline.ts:394-398`), which is itself a placeholder (domain-based, not semantic). Users will see proposals that feel off for the first 1-2 weeks. This is explicitly accepted (Q6 experimental marker).
- The `skill-creator:skill-creator` plugin invocation from command-level Claude is a new surface. If the plugin's API changes, `/evolve` breaks. Mitigation: wrap the plugin call in a try/catch and fall back to "proposal emitted but skill creation skipped — run skill-creator manually with: <spec>".
- The collision-detection abort-entire-batch strategy is conservative. A user with 1 collision out of 10 proposals has to rename and rerun. Alternative strategies (partial apply, auto-suffix) were considered and rejected as too clever.

### Neutral
- `CREATE_HOOK` is deferred to Sprint B.1 (Q7). alchemik still classifies clusters as hook candidates but emits them as informational, not actionable. No loss of data, just gated rollout.
- `KADMON_EVOLVE_WINDOW_DAYS` env var is introduced (default 7). Adds one more env knob to the environment variable catalog in `CLAUDE.md`.
- The new auto-sync hook (Q8) brings the registered hook count from 20 to 21 and requires one update to `rules/common/hooks.md`.

## Alternatives Considered

### Q1 — Artifact destination

**Alternative 1a: harness-global** — always write to `Kadmon-Harness/.claude/`.
- Pros: single source of truth; generated skills reusable across projects without bootstrap.
- Cons: violates the entire Sprint B goal of project-scoped evolution; makes Kadmon-Sports-specific skills visible (and potentially auto-loaded) in ToratNetz; no way to have a "sports-training-workflow" skill without polluting every project; contradicts the user's explicit strategic decision.
- **Why not:** directly opposes the strategic direction already set by the user. Rejected without further debate.

**Alternative 1b: scope-prompt** — at each `/evolve` run, ask the user "write to project-local or harness-global?"
- Pros: flexibility; user controls each decision.
- Cons: adds a prompt step that almost always has the same answer; imposes a decision the user already made at the strategic level; error-prone (wrong choice in the moment contaminates the tree).
- **Why not:** user has already decided this globally. Re-asking at each invocation is user-hostile.

**Chosen: project-local always with collision detection (1).** Deterministic, matches the strategic direction, reversible-by-delete, no cross-project leakage.

### Q2 — Plugin invocation orchestration

**Alternative 2a: subagent-direct** — grant alchemik the `Skill` tool and let it invoke `skill-creator:skill-creator` itself.
- Pros: one less round-trip; alchemik owns the entire step 6 pipeline.
- Cons: breaks the "propose only" invariant; no subagent in the project currently has `Skill` in tools (grep confirmed); mixes analysis and side-effects in one phase; makes testing harder (can't dry-run).
- **Why not:** violates an established convention with no offsetting benefit.

**Alternative 2b: command-orchestrated (chosen)** — alchemik emits structured proposals; `/evolve` command-level Claude gates and invokes plugin.
- **Why chosen:** matches the `/abra-kdabra` pattern (konstruct proposes, command invokes feniks), preserves test dry-run shape, keeps alchemik's tool surface minimal.

### Q3 — Multi-report consumption window

**Alternative 3a: most-recent-only.**
- Pros: simplest; no merge logic.
- Cons: discards evidence from earlier reports in the same working session; a user who runs `/forge` daily loses Monday's data by Tuesday.
- **Why not:** over-prunes.

**Alternative 3b: windowed (chosen, default 7 days).**
- **Why chosen:** rolling evidence with bounded read cost; configurable via env.

**Alternative 3c: all-time.**
- Pros: maximum evidence.
- Cons: unbounded growth; stale reports from months ago re-surface; performance unbounded.
- **Why not:** doesn't decay.

### Q7 — CREATE_HOOK scope

**Alternative 7a: include CREATE_HOOK in Sprint B.**
- Pros: complete category coverage at launch; one ADR, one plan.
- Cons: 2-3x implementation cost (template complexity, settings.json editing, security review); higher failure blast radius; blocks Sprint B launch by 1-2 weeks; no cross-project data yet to validate templates against.
- **Why not:** the delay costs more than the feature is worth at this stage; the markdown categories are the high-value ones.

**Alternative 7b: defer to Sprint B.1 (chosen).**
- **Why chosen:** ships the 4 high-value categories now; `CREATE_HOOK` gets tuned against real Sprint B telemetry; preserves safety invariants.

## Implementation hand-off

Konstruct will need to touch the following files. Public API surface for the new module is specified below so konstruct can draft the plan without reverse-engineering this ADR.

### New files

**`scripts/lib/evolve-generate.ts`** — the Sprint B centerpiece, mirrors `forge-pipeline.ts` structure.

```typescript
import type { ClusterReport, EvolutionCategory, Instinct } from "./types.js";

export interface EvolveGenerateOptions {
  projectHash: string;
  cwd: string;
  reportsDir?: string;        // defaults to ~/.kadmon/forge-reports
  windowDays?: number;        // defaults to env KADMON_EVOLVE_WINDOW_DAYS or 7
  now?: Date;                 // test seam
}

export type ProposalType = "skill" | "command" | "agent" | "rule";
export type Complexity = "S" | "M" | "L";
export type ProposalConfidence = "HIGH" | "MED" | "LOW";

export interface GenerateProposal {
  index: number;
  type: ProposalType;
  slug: string;
  name: string;
  targetPath: string;
  sourceClusterIds: string[];
  sourceInstinctIds: string[];
  suggestedCategory: EvolutionCategory;
  complexity: Complexity;
  confidence: ProposalConfidence;
  rationale: string;
  spec: SkillSpec | CommandSpec | AgentSpec | RuleSpec;
}

export interface EvolveGeneratePreview {
  proposals: GenerateProposal[];
  sourceReportCount: number;
  sourceWindow: { from: string; to: string };
  deferredHookCount: number;   // Q7: CREATE_HOOK clusters surfaced as info
  skipped?: "no-reports-in-window";
}

/** PURE. Reads ClusterReports, merges, emits proposals. Never writes files. */
export async function runEvolveGenerate(
  opts: EvolveGenerateOptions,
): Promise<EvolveGeneratePreview>;

export interface ApplyApprovals {
  approvedIndices: number[];   // 1-based, from user selection
}

export interface ApplyResult {
  written: Array<{ type: ProposalType; targetPath: string }>;
  pluginInvocations: Array<{ slug: string; spec: SkillSpec }>; // command-side handles these
  collisions: string[];        // if non-empty, nothing was written
  errors: string[];
}

/** SINGLE MUTATOR. Writes markdown files. Returns plugin-invocation list for command-side. */
export function applyEvolveGenerate(
  preview: EvolveGeneratePreview,
  approvals: ApplyApprovals,
  opts: EvolveGenerateOptions,
): ApplyResult;
```

**`scripts/lib/evolve-generate-templates/`** — markdown templates for each type.
- `skill.template.md`
- `command.template.md`
- `agent.template.md`
- `rule.template.md`

**`scripts/lib/evolve-report-reader.ts`** — new module for the read-side scan.
```typescript
export interface ReadReportsOptions {
  baseDir: string;
  projectHash: string;
  windowDays: number;
  now: Date;
}
export function readClusterReportsInWindow(
  opts: ReadReportsOptions,
): ClusterReport[];
```
(Alternative: add this function to `forge-report-writer.ts`. Recommendation: separate module. The writer and reader sides have different failure modes and deserve independent test surfaces.)

**`.claude/hooks/scripts/agent-metadata-sync.js`** — Q8 sync hook (PostToolUse, Edit|Write matcher). Exit 1 on warning, exit 0 otherwise. Never exit 2.

**`tests/lib/evolve-generate.test.ts`** — Q5 test surface. Covers the 9 test assertions enumerated above.

**`tests/fixtures/make-cluster-report.ts`** — helper that builds ClusterReport fixtures from the live 22 instincts (loaded from a JSON snapshot).

### Modified files

- `scripts/lib/types.ts` — add `SkillSpec`, `CommandSpec`, `AgentSpec`, `RuleSpec` discriminated union. Keep existing `EvolutionCategory` and `ClusterReport` unchanged.
- `.claude/agents/alchemik.md` — add Step 6 section (marked EXPERIMENTAL per Q6), add the `GenerateProposal[]` output fence format to the Output Format section. No changes to `tools:` frontmatter (Q9).
- `.claude/commands/evolve.md` — extend step list with the new step 6 flow: parse alchemik output -> render gate -> await approval -> invoke `runEvolveGenerate` wrapper -> handle plugin invocations for PROMOTE proposals.
- `.claude/settings.json` — register `agent-metadata-sync` in the `hooks.PostToolUse` array.
- `.claude/rules/common/hooks.md` — append `agent-metadata-sync` to the registered hook catalog (bringing count to 21).
- `CLAUDE.md` — add `KADMON_EVOLVE_WINDOW_DAYS` to Environment Variables section; add experimental marker note under /evolve command; bump registered hook count.
- `docs/plans/plan-008-evolve-generate-pipeline.md` — konstruct writes this in its pass.

### Not touched
- `scripts/lib/state-store.ts` — no schema changes, no new functions.
- `scripts/lib/forge-pipeline.ts` — no changes (producer unchanged).
- `scripts/lib/forge-report-writer.ts` — no changes (shared by reader module).
- Existing 22 Kadmon-Harness instincts — read by fixture helper, never mutated.
- `~/.kadmon/kadmon.db` schema — no migration.

## Checklist verification
- [x] Requirements documented with acceptance criteria (Q1-Q10 each state "what" concretely).
- [x] API contracts defined (`runEvolveGenerate`, `applyEvolveGenerate`, `GenerateProposal`, `ApplyResult`).
- [x] Data models specified (ClusterReport reused, GenerateProposal new).
- [x] User workflows mapped (loop diagram in Context).
- [x] Component responsibilities defined (alchemik proposes, command orchestrates, mutator writes).
- [x] Error handling strategy (collision-abort, empty-window soft-skip, plugin-failure fallback).
- [x] Testing strategy planned (9 assertions, real-instinct fixtures, invariant lockdown).
- [x] Migration path (none needed — additive, no schema change).
- [x] Performance targets (hook < 500ms; read window O(reports)).
- [x] Security requirements (path traversal reject, collision abort, parameterized queries unchanged).
- [x] Windows compatibility (path.resolve, existing project-detect pattern, no shell interpolation).
- [x] Observability (gate output, apply result, alchemik report section).

## Review date
**2026-04-28** — Sprint B.1 review. At that date: evaluate heuristic quality from real cross-project use, remove EXPERIMENTAL markers, ship `CREATE_HOOK` category, and revisit collision-detection strategy if partial-apply is requested by users.
