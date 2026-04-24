---
number: 29
title: Capability & Metadata Alignment Audit
date: 2026-04-24
status: accepted
route: A
plan: plan-029-capability-alignment-audit.md
---

> **Post-hoc clarification (2026-04-24):** nominal "Check #9" renamed to **Check #14** during plan-029 Phase 0 — slot 9 was taken by Install health (ADR-024), and plan-028 had already claimed 10-13. See plan-029 Assumptions.

# ADR-029: Capability & Metadata Alignment Audit

**Deciders**: Ych-Kadmon, arkitect

## Context

On 2026-04-23 the `council` skill was discovered silently broken. Its documentation named `konstruct` as the primary owner sub-agent, yet `konstruct`'s `tools:` frontmatter intentionally omits `Task` — the exact tool `council` needs to spawn its three voices. Metadata parsed, the loader injected the skill, and the declaration looked correct at a glance. The skill was simply unexecutable when routed through its declared owner. The fix (moving ownership up to `/abra-kdabra` Step 1.5 and the main orchestrator; see `.claude/rules/common/agents.md` "Command-Level Skills" table and `memory/decision_council_orchestrator_ownership.md`) closed the incident, and `docs/research/research-005-skill-comply-council-pilot-2026-04-24.md` verified the fix (3/3 PASS, 100% compliance).

The defect class is broader than one skill. A skill can declare capabilities (tools, ownership, file paths, command hooks) that silently disagree with the rest of the harness. The loader will not complain. `/medik` Check #8 (`lint-agent-frontmatter.ts`) validates **syntax** (YAML block list + subdirectory layout), but it cannot see **capability mismatch** — the runtime contract between what a skill needs and what its owner agent provides.

The harness currently ships 46 skills, 16 agents, 11 commands, 19 rules. The combinatorial surface is large enough that any asymmetric declaration — skill says A owns it, A's frontmatter omits the tool the skill needs — can hide for weeks. This ADR decides how to systematically detect and prevent that class of bug.

Today, 2026-04-24, the `scripts/lib/medik-checks/` directory is being populated by a parallel session (plan-028) with modular check files: `types.ts`, `stale-plans.ts`, `skill-creator-probe.ts`, `hook-health-24h.ts`, `instinct-decay-candidates.ts`. The check module contract is already established — each file exports `runCheck(ctx: CheckContext): CheckResult` with status `PASS | NOTE | WARN | FAIL`. Any new audit should ride this contract rather than invent a parallel one.

## Decision

Adopt **Path B — `/medik` Check #9 as a new file in `scripts/lib/medik-checks/`** under the name `capability-alignment.ts`, scheduled to land **after** plan-028 Phase 4/5 merges to avoid collision with the parallel session.

The check runs a single walk over agents, skills, commands, and the "Command-Level Skills" table in `rules/common/agents.md`, builds an in-memory **capability matrix**, and emits violations under five categories:

1. **Capability mismatch** (FAIL) — skill declares or heuristically requires a tool absent from its owner agent's `tools:` frontmatter.
2. **Ownership drift** (WARN) — skill → agent declaration is asymmetric (skill names owner, owner's `skills:` list omits the skill, or vice versa).
3. **Path drift** (FAIL) — skill referenced at flat path rather than `.claude/skills/<name>/SKILL.md`. (Overlaps with Check #8 but covers command frontmatter and the agents.md table, which Check #8 does not scan.)
4. **Command-skill drift** (FAIL) — command `skills:` frontmatter references a skill that does not exist on disk.
5. **Orphan skill** (NOTE) — skill on disk with no agent owner and no entry in the "Command-Level Skills" table.

To make capability mismatch detectable deterministically, introduce an **opt-in** `requires_tools:` YAML field in skill frontmatter. Skills that need explicit tool routing (currently: `council` needs `Task`; `deep-research` needs `WebFetch` and `Task`; any skill invoking sub-agents) declare it. For skills that do not declare the field, a **heuristic fallback** scans the skill body for literal tool mentions (`Task(`, `WebFetch`, `Bash(`, `Skill(`) and flags likely omissions as WARN (not FAIL). The field is opt-in precisely because a false FAIL blocking `/medik` is worse than a missed WARN.

Severity model summary:

| Condition | Severity | Gate behavior |
|-----------|----------|---------------|
| Declared `requires_tools` ⊄ owner `tools` | FAIL | blocks `/medik clean` gate; prints remediation |
| Heuristic tool detection, skill lacks `requires_tools` | WARN | advisory; prompts declaration |
| Ownership asymmetry | WARN | advisory |
| Path drift | FAIL | already a deep invariant (ADR-013) |
| Command → missing skill | FAIL | breaks command runtime |
| Orphan skill | NOTE | prompts stocktake review |

## Alternatives Considered

### Alternative 1: Path A — Standalone script (`scripts/lib/audit-skill-capabilities.ts`)

- **Pros**: Simplest to land. No parallel-session coordination. Produces a markdown report. Zero risk of exceeding `/medik` latency budget.
- **Cons**: Drift returns after one commit. Nothing triggers it automatically. User must remember to run. Audits do not become part of the harness's immune system. Research-004/005 establish that capability check belongs in the recurring gate, not a one-shot.
- **Why not**: Does not match the harness's "detect recurring class of bug" doctrine. The council bug existed precisely because nothing recurring was checking this surface.

### Alternative 2: Path C — Extend `skill-stocktake` skill

- **Pros**: Logical grouping — all skill-level audits in one skill. Reuses existing invocation path.
- **Cons**: `skill-stocktake` is about quality verdicts (Keep/Improve/Update/Retire/Merge) — semantic content of each skill. Capability alignment is a **structural, cross-artifact** invariant. Bundling them stretches the skill's scope and couples two concerns that have different cadences (stocktake is quarterly; alignment must fire on every `/medik`). Also, a skill that calls an LLM for verdicts cannot cleanly produce deterministic FAIL/WARN.
- **Why not**: Different concern class, different cadence, different determinism profile. Don't bolt a hard gate onto a soft-review skill.

### Alternative 3: Path D — New `capability-audit` skill + command

- **Pros**: Most discoverable. First-class artifact.
- **Cons**: Most overhead to ship (skill + command + agent owner discussion + rules update). Users would invoke it rarely — same recurrence problem as Path A. A new command for something that belongs inside `/medik` is process bloat and itself introduces a new ownership question ("which agent owns capability-audit?").
- **Why not**: Recurrence is the core requirement; a standalone command fails it the same way a script does. A new skill/command is also more surface for this very audit to check — ironic and costly.

### Alternative 4 (the chosen one): Path B — `/medik` Check #9

- **Pros**: Recurring by default — every `/medik` invocation runs it. Consolidates harness health in one place. Rides the check module contract (`runCheck(ctx) -> CheckResult`) already paved by plan-028. Fits the existing category taxonomy (`runtime` for capability mismatch, `knowledge-hygiene` for ownership/orphans). Modular file-per-check layout already accepted.
- **Cons**: Parallel-session collision risk — `scripts/lib/medik-checks/` is under active edits in another VSCode window. Adds runtime cost to `/medik`. Requires one schema addition (`requires_tools:`) to make FAIL-grade capability checks deterministic. The heuristic fallback can produce false WARNs.
- **Why chosen**: It is the only option that makes the audit **part of the steady-state immune system**. The collision is a coordination problem, not a design problem (mitigation: merge AFTER plan-028 Phase 4/5). Runtime cost is bounded (one filesystem walk + one YAML parse per artifact — see Implementation Notes for the budget).

## Consequences

### Positive

- Catches the council-class bug before it lands, not weeks later.
- Establishes a reusable **capability matrix** data structure (`buildCapabilityMatrix(ctx)`) that future checks can consume — e.g., "every agent mentioned in a command's `agent:` field exists", "every rule referenced from an agent exists".
- Forces skills that invoke sub-agents or plugins to explicitly declare their tool requirements — a documentation win independent of the audit.
- Self-hosting: the audit validates its own skill file (`capability-audit` is NOT added; the check module has no corresponding skill — it is a pure lib). The check's own alignment is satisfied by running against the matrix it builds.
- Matches the pattern of ADR-028's modular `/medik` split — one check per file, one concern per check, shared types.

### Negative

- Adds ~50–150 ms to every `/medik` invocation (estimate; see Implementation Notes).
- Adds a new frontmatter field (`requires_tools:`) that future skill authors must learn. Mitigated by the heuristic fallback — forgetting to declare is WARN, not FAIL.
- Skill authors who copy the existing 46 skills as templates will not see the field until at least one declares it. Mitigated by updating `skill-creator:skill-creator` plugin guidance and the `_TEMPLATE` skeleton convention (separate follow-up).

### Risks

- **Collision with parallel session.** Mitigation: konstruct's plan MUST sequence landing as "verify plan-028 Phase 4/5 is merged → `git pull` → add `capability-alignment.ts`". Do not open a PR while `scripts/lib/medik-checks/` is under active edits.
- **Heuristic false positives.** Scanning skill body for `Task(` can match examples in code blocks, not actual tool invocations. Mitigation: heuristic is WARN-only, never FAIL; declaration is opt-in; the check prints the matching line so the user can verify in ~5 s.
- **Schema churn.** Adding `requires_tools:` to 46 skills is not required on landing — the heuristic covers unannotated skills. A follow-up migration (post-landing) can annotate the 3–5 skills known to spawn sub-agents (council, deep-research, skill-comply, skill-stocktake if it spawns, continuous-learning-v2 if it spawns). That migration is out of scope for plan-029.
- **Matrix churn when agents/skills change frequently.** Mitigation: the matrix is rebuilt per invocation from source files — no caching, no stale state.

## Implementation Notes

### Files to create

- `scripts/lib/medik-checks/capability-alignment.ts` — the check entrypoint. Exports `runCheck(ctx: CheckContext): CheckResult`. Must match the contract in `scripts/lib/medik-checks/types.ts` exactly.
- `scripts/lib/capability-matrix.ts` — the pure builder module. Exports:
  - `interface CapabilityMatrix { agents: AgentEntry[]; skills: SkillEntry[]; commands: CommandEntry[]; commandLevelSkills: Set<string>; }`
  - `function buildCapabilityMatrix(ctx: { cwd: string }): CapabilityMatrix`
  - `function findViolations(matrix: CapabilityMatrix): Violation[]`
  - `interface Violation { kind: 'capability-mismatch' | 'ownership-drift' | 'path-drift' | 'command-skill-drift' | 'orphan-skill'; severity: 'FAIL' | 'WARN' | 'NOTE'; subject: string; message: string; evidence: string; }`
- `tests/lib/medik-checks/capability-alignment.test.ts` — vitest unit tests. Follows the pattern already in `tests/lib/medik-checks/`.
- `tests/lib/capability-matrix.test.ts` — unit tests for the matrix builder (more extensive — fixture-driven, covers each violation kind).

### Files to edit

- `scripts/lib/medik.ts` (or wherever the check registry lives — konstruct should grep first): register `capability-alignment` as Check #9 (verify numbering against what plan-028 actually lands; renumber if 9 is taken — pick the next free slot).
- `.claude/skills/council/SKILL.md` — add `requires_tools: [Task]` to frontmatter. This is the dogfood test: the check, once shipped, must PASS on council and FAIL if `requires_tools` is removed. (konstruct: verify no other skill currently would break when this field is introduced — field is opt-in, unknown keys are ignored by the existing loader.)
- `.claude/skills/deep-research/SKILL.md` — add `requires_tools: [Task, WebFetch]` for symmetry.
- `.claude/rules/common/agents.md` — no changes on landing; a separate commit can note `requires_tools` in the "Command-Level Skills" table preamble. NOT required for this ADR.

### Matrix schema (types, source of truth lives in `capability-matrix.ts`)

```typescript
interface AgentEntry {
  name: string;               // filename minus .md
  filePath: string;
  tools: string[];            // parsed from `tools:` YAML list
  skills: string[];           // parsed from `skills:` YAML block list
  model: 'opus' | 'sonnet' | string;
}

interface SkillEntry {
  name: string;               // directory name
  filePath: string;           // always <name>/SKILL.md
  declaredOwner?: string;     // parsed from `owner:` or inferred from agents' skills: lists
  requiresTools: string[];    // from frontmatter; [] if not declared
  heuristicTools: string[];   // detected from body scan; [] if not found
  isCommandLevel: boolean;    // true if listed in rules/common/agents.md "Command-Level Skills" table
}

interface CommandEntry {
  name: string;               // filename minus .md
  filePath: string;
  skills: string[];           // parsed from command frontmatter `skills:` field
  agents: string[];           // parsed from command frontmatter `agent:` field
}
```

### Detection rules

1. **Capability mismatch (FAIL)**: for each `SkillEntry` with non-empty `requiresTools` and a resolvable `declaredOwner`, fail if `requiresTools` ⊄ `owner.tools`. Evidence: the exact missing tool name + owner file + line number.
2. **Ownership drift (WARN)**: if agent.skills includes X but skill X's `declaredOwner` ≠ this agent, AND X is not a command-level skill, emit WARN naming both files.
3. **Path drift (FAIL)**: scan command frontmatter `skills:` values, scan the "Command-Level Skills" table; if any reference does not resolve to `.claude/skills/<name>/SKILL.md`, fail. (Covers the gap where Check #8 only scans agents.)
4. **Command-skill drift (FAIL)**: for each CommandEntry, every entry in `skills` must correspond to a SkillEntry with that name. Missing = FAIL.
5. **Orphan skill (NOTE)**: SkillEntry with no declared owner AND not in `commandLevelSkills`. NOTE-only because ADR-013 does not mandate that every skill have an owner — some are genuinely utility.

### Heuristic tool detection

Scan skill body (not frontmatter) for these literal regex anchors:

- `/\bTask\s*\(/` or `/\bTask\s+tool\b/i` → candidate Task dependency
- `/\bWebFetch\s*\(/` or `/\bWebFetch\b/` in an instruction sentence (not a code-block example) → candidate WebFetch dependency
- `/\bBash\s*\(/` in an instruction sentence → candidate Bash dependency

Strip fenced code blocks before matching to reduce false positives. If the scan finds a candidate tool and the skill does NOT declare it in `requires_tools`, emit WARN suggesting the declaration.

### Performance budget

Target: < 150 ms on a cold run for the current 46 skills + 16 agents + 11 commands + 1 rules file.

Back-of-envelope: 46 + 16 + 11 = 73 files × ~500 µs (read + parse frontmatter) ≈ 37 ms, plus one 200-line `rules/common/agents.md` read (~1 ms), plus O(N×M) cross-reference checks on in-memory maps (< 5 ms). The heuristic scan adds ~46 × 2 ms = 92 ms worst case. Total worst case ~135 ms — within budget. konstruct's plan should include a benchmark gate (vitest `bench` or a simple `console.time` assertion).

### Gate behavior in `/medik`

- `/medik` (default): prints all five violation categories. Summary line: "Capability alignment: 0 FAIL / 2 WARN / 1 NOTE".
- `/medik clean`: FAIL blocks the commit gate. WARN and NOTE do not.
- Individual invocation (not yet supported, but should be planned): `npx tsx scripts/lib/medik-checks/capability-alignment.ts` — reuses the same entrypoint as a CLI for local debugging.

### Failure modes handled

- Missing `docs/` directory — skip silently (consistent with stale-plans.ts).
- Malformed YAML frontmatter on any file — emit NOTE for that file, continue with the rest. Never let one bad file fail the whole check.
- Missing `rules/common/agents.md` — emit WARN (should always exist in harness repo) and treat commandLevelSkills as empty.

### Sequencing / coordination with parallel session

konstruct's plan MUST include these gates in this order:

1. **Wait** until plan-028 Phase 4/5 checks land on `release/v1.3` (verify: all current `scripts/lib/medik-checks/*.ts` files are tracked in git, not untracked).
2. `git pull` before opening a branch for plan-029.
3. **Verify** the check registry file (wherever plan-028 lands the check loop — likely `scripts/lib/medik.ts` or a new `scripts/lib/medik-checks/index.ts`) has a stable interface. If it changed, adapt `capability-alignment.ts` registration accordingly.
4. Open `feature/capability-alignment-check` from fresh `release/v1.3`.
5. Never edit files in `scripts/lib/medik-checks/` other than the new `capability-alignment.ts` in this PR.

### Self-hosting

The audit validates its own alignment passively: `capability-alignment.ts` is not a skill and does not appear in the matrix. The council skill, once annotated with `requires_tools: [Task]`, is the seed test case — the check must PASS with the current ownership fix (command-level) and FAIL if council is reassigned to an owner lacking `Task`. Unit tests enshrine this.

### Future extensions (OUT OF SCOPE for plan-029, tracked here for context)

- Migrating all 3–5 sub-agent-spawning skills to declare `requires_tools:`.
- Adding rule-reference validation (agent mentions `.claude/rules/<x>` that doesn't exist).
- Surfacing matrix summary in `/nexus` dashboard.
- Extending the heuristic to detect `Skill(` plugin invocations (harder because plugins are command-level by convention — see MEMORY.md Subagent tool convention).

## no_context Application

This ADR is grounded in direct reads of `scripts/lib/medik-checks/types.ts`, `scripts/lib/medik-checks/stale-plans.ts`, `scripts/lib/medik-checks/skill-creator-probe.ts`, `scripts/lib/lint-agent-frontmatter.ts`, and `.claude/skills/council/SKILL.md`. The check module contract, category taxonomy, status vocabulary, and file-per-check pattern are all taken from code that exists today, not invented. The 46-skill count and 16-agent count come from actual filesystem enumeration (`.claude/skills/*/SKILL.md` glob + CLAUDE.md status line cross-check). The council incident references specific file paths that exist (`memory/decision_council_orchestrator_ownership.md`, `docs/research/research-005-skill-comply-council-pilot-2026-04-24.md` — caller-provided) and a specific runtime defect class (sub-agent tool gating) that matches the documented MEMORY.md pattern: "ZERO agents have `Skill` in their `tools:` frontmatter — plugins are command-level."

What remains unverified and is therefore left as konstruct's pre-flight check: (1) the exact file where `/medik`'s check registry lives after plan-028 lands — the current file `scripts/lib/medik.ts` may or may not have been refactored; (2) the exact check number to claim — depends on whether plan-028 already numbered 9/10/11/12/13. If either is uncertain at implementation time, konstruct must re-read the registry file before coding.
