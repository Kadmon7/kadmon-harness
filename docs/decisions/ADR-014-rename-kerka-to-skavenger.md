---
number: 14
title: Rename kerka agent to skavenger
date: 2026-04-17
status: accepted
route: A
refines: ADR-009-deep-research-capability.md
---

# ADR-014: Rename `kerka` agent to `skavenger`

> **Deciders**: Ych-Kadmon (architect).
> **Implementation Status**: Proposed 2026-04-17. Mechanical rename PR follows immediately.

## Status

Accepted — 2026-04-17. Refines the naming choice made in ADR-009 without changing any architectural decision from that record. ADR-009 remains authoritative for the agent's routing contract, execution caps, and chain-rule closure over the `deep-research` skill.

## Context

ADR-009 introduced a sonnet sub-agent named `kerka` as the chain-rule executor for the `deep-research` skill and the owner of the `/research` command. That decision was correct architecturally: it closed a routing violation (cataloged-but-unexecutable skill), added YouTube transcript support via `yt-dlp`, enforced execution caps, and preserved almanak's Context7-only posture.

However, the *name* `kerka` was chosen quickly at the time of ADR-009 and does not reflect what the agent does. A user returning to the harness months later sees `kerka` in the agent roster and cannot infer from the name that this is the multi-source research executor. The semantic fit between name and function is weak.

`skavenger` is the preferred name because:

1. **Semantic fit.** The verb *to scavenge* directly describes the agent's workflow — comb multiple sources (web, YouTube transcripts, PDFs, arXiv), extract useful fragments, synthesize a cited report. The agent IS a scavenger of evidence across disparate sources.
2. **K-naming convention preserved.** The harness's agent roster uses names that contain or evoke a `k` sound (arkitect, konstruct, kody, orakle, spektr, feniks, mekanik, kurator, arkonte, kartograf, alchemik, kerka, doks). Spelling *scavenger* as `skavenger` keeps the agent in the visual family.
3. **Discoverability.** New harness users and bootstrap targets (ADR-010 distribution) get a self-documenting agent name. `skavenger` telegraphs its purpose without requiring a catalog lookup.

This is a naming refinement, not an architectural change. No behavior, tool set, cap, workflow route, skill declaration, or chain-rule relationship is altered.

## Decision

Rename the agent from `kerka` to `skavenger`. The rename is *functional-only* — applied to currently live routing surfaces — and is documented by this ADR in a way that preserves the audit trail of ADR-009 through ADR-013.

### In scope (functional surface)

- `.claude/agents/kerka.md` → `.claude/agents/skavenger.md` via `git mv` (preserves rename history).
- Internal references within the renamed file (6 occurrences): frontmatter `name:`, body tag `[kerka]` in output format, comment in Perplexity extension point, agent-memory path string.
- Catalog/routing files that reference the agent at runtime:
  - `CLAUDE.md` agent roster table
  - `README.md` agent table and `/research` description
  - `.claude/rules/common/agents.md` (5 rows: sonnet model list, agent catalog row, auto-invoke rule, manual invoke rule, orchestration pattern)
  - `.claude/rules/common/development-workflow.md` command table `/research` agent column
  - `.claude/commands/research.md` frontmatter and body
  - `.claude/skills/deep-research/SKILL.md` "Execution caps" subsection (renames `(kerka)` → `(skavenger)`)
- Source code that hardcodes the agent name as a string prefix:
  - `scripts/lib/youtube-transcript.ts` temp directory prefix `kerka-yt-` → `skavenger-yt-`
  - `dist/scripts/lib/youtube-transcript.js` regenerated via `npm run build`
- DB runtime: `UPDATE agent_invocations SET agent_type='skavenger' WHERE agent_type='kerka'` (2 historical rows, for dashboard continuity).

### Bundled drift fix (not part of rename, but overdue)

`.claude/skills/deep-research/SKILL.md:128` reads `**Agent**: almanak (primary, for documentation + research)`. This has been stale since ADR-009 moved ownership of `deep-research` from almanak to kerka. The bundled edit updates that line to `**Agent**: skavenger (primary, for multi-source research)`. Including it in this PR honors the `feedback_no_half_done.md` principle — the drift is trivial to fix and leaving it would contradict the rename's intent.

### Out of scope (archival, by ADR append-only policy)

ADR-013 codified the rule that ADRs are append-only once shipped. ADR-009 through ADR-013 and plan-009 through plan-013 captured the state of the world when `kerka` was introduced. Rewriting their bodies retroactively to say `skavenger` would:

- Violate append-only policy and the `feedback_no_half_done.md` intent which drove that policy.
- Destroy the audit trail showing what name was in use between 2026-04-14 and 2026-04-17.
- Create churn across 110 occurrences (62 ADR + 48 plan) with zero functional benefit — no runtime path reads those files.

Therefore ADR-009..ADR-013 bodies and plan-009..plan-013 bodies remain verbatim. Readers arriving at ADR-009 see the original `kerka` naming and a cross-reference in this ADR's `refines:` frontmatter pointing them here for the current name.

### Out of scope (architectural)

This ADR explicitly does NOT alter:

- Agent model (`sonnet`).
- Tool set (`Read, Grep, Glob, Bash, WebSearch, WebFetch`).
- Skill declaration (`deep-research`).
- Execution caps (5 sub-questions, 3 WebSearch per sub-question, 5 WebFetch total, 1 transcript per URL — from ADR-009 D5).
- Workflow routes (A: YouTube, B: PDF/arXiv, C: General deep-research).
- Memory file contract (`.claude/agent-memory/<name>/MEMORY.md`, dynamically created).
- Security posture (prompt-injection defense, untrusted content treatment).
- The commented Perplexity Sonar Fase 2 extension point.

Any change to the above belongs in a separate ADR.

## Consequences

### What changes

- **Routing.** `/research` dispatches to `skavenger` instead of `kerka`. Users and auto-invocation rules unaffected — the command name `/research` is unchanged.
- **Dashboard.** `agent_invocations` history shows `skavenger` with 2 migrated rows; zero `kerka` rows. Future invocations persist with `agent_type='skavenger'`.
- **Agent memory.** First write by `skavenger` creates `.claude/agent-memory/skavenger/MEMORY.md`. No migration needed because the `kerka` memory directory was never instantiated.
- **Bootstrap distribution (ADR-010).** New projects onboarded from the harness bootstrap after this PR lands receive `skavenger` out of the box. No legacy `kerka` surface distributed.
- **Grep discipline.** `rg "kerka" .claude/ scripts/ CLAUDE.md README.md` returns zero hits post-merge. `rg "kerka" docs/` still returns historical hits in ADR-009..013 and plan-009..013, which is intentional.

### What does not change

- `/research` command surface.
- `deep-research` skill content (except the bundled `:128` drift fix).
- Any test in `tests/` (none reference the agent name directly — verified).
- Hook behavior in `.claude/hooks/scripts/` (none reference the agent name — verified).
- Permissions in `.claude/settings.json` (no reference — verified).

### What could go wrong

- **R1 — `agent-metadata-sync.js` is inert for renames.** The hook syncs only the `model` column and only for existing rows keyed by name. On a rename it finds no `skavenger` row, logs a warning, and exits. The hook does NOT remove the old `kerka` row. *Mitigation*: catalogs are edited by hand in the rename PR. Post-merge the hook correctly maintains the `skavenger` row on future model changes.
- **R2 — Live Claude Code sessions with cached agent resolution.** A running session that spawned `kerka` before the merge holds the old resolution in memory. *Mitigation*: the merge commit message instructs users to restart Claude Code after pulling, mirroring the ADR-013 migration pattern.
- **R3 — dist/ artifact drift.** `youtube-transcript.ts` compiles to `dist/scripts/lib/youtube-transcript.js` and the agent spawns it via `npx tsx`. *Mitigation*: `npm run build` runs as part of the rename commit gate; the commit includes the rebuilt artifact if dist/ is tracked.
- **R4 — External references.** None in this repo. If any external documentation (blog posts, external wiki) references `kerka`, those are out of this harness's control. Not a blocker.

### Rollback

Each of the rename commits (ADR, core rename, DB migration) is independently revertible. `git revert` returns the agent identity to `kerka`. The DB migration reverses with a symmetric UPDATE. Cost: one PR.

## Non-goals

- **Retroactive body edits to ADR-009..013 or plan-009..013.** See "Out of scope (archival)" above.
- **Behavioral changes, tool additions, cap changes, workflow modifications.** Belong to future ADRs.
- **Renaming of the `deep-research` skill.** The skill name is correct (describes the methodology, not the executor); only the executor's name changes.
- **Renaming of any other agent.** Scoped to `kerka` only.
- **Changes to the bootstrap script (ADR-010).** The rename ships in time for the first bootstrap distribution, so no "legacy alias" machinery is needed. Early adopters of the bootstrap receive `skavenger` directly.

## Checklist Verification

- [x] **Requirements documented.** Scope listed file-by-file with line counts. Out-of-scope archival set explicitly named.
- [x] **Alternatives evaluated.** Three options considered: (A) functional-only + new ADR — chosen; (B) functional-only, no ADR — rejected, loses audit trail; (C) full retroactive rewrite — rejected, violates append-only.
- [x] **Evidence anchored.** ADR-009 cited as origin of the `kerka` name. `rules/common/agents.md` K-naming convention cited. `feedback_no_half_done.md` cited for the bundled drift-fix justification.
- [x] **Data model specified.** `agent_invocations` table, column `agent_type`, 2-row UPDATE. No schema change.
- [x] **Component responsibilities defined.** Identical to ADR-009 except for the agent name. No new component introduced.
- [x] **Error handling strategy.** `agent-metadata-sync.js` behaves as inert no-op; manual catalog edits compensate. Documented as R1.
- [x] **Testing strategy.** Linter 16/16, vitest green, grep gate (0 hits outside docs/), dashboard visual check, one real `/research` invocation post-merge.
- [x] **Migration path.** 3 mechanical commits on one branch, each independently revertible. Gates between commits.
- [x] **Windows compatibility.** `git mv` preserves rename history; no case-folding risk because `skavenger.md` is all lowercase. No new runtime code paths.
- [x] **Observability planned.** Success measurable via the grep gate, the linter, and the dashboard continuity check. No new telemetry required.
- [x] **Rollback plan.** Per-commit `git revert` and symmetric DB UPDATE documented above.

## Review date

**2026-07-17** — three months from acceptance. Criterion: `skavenger` still matches how people describe the agent in daily use; no confusion reports; no requests to rename again. If the name has not outlasted the 90-day window, rename fatigue is a real cost and the next round of changes should require a higher bar than aesthetic preference.
