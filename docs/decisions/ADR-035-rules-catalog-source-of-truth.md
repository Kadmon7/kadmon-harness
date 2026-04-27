---
number: 35
title: Rules catalog source-of-truth via non-auto-loaded CATALOG.md
date: 2026-04-26
status: accepted
route: A
plan: plan-035-rules-catalog-source-of-truth.md
---

# ADR-035: Rules catalog source-of-truth via non-auto-loaded CATALOG.md

**Deciders**: Ych-Kadmon, arkitect

## Context

A `/context` audit on 2026-04-26 surfaced that Memory files for Kadmon-Harness occupy **32.6k tokens per turn**. Three of the 19 rule files in `.claude/rules/common/` carry the bulk of that weight, and almost all of it is **catalog data** that already exists in summarized form in `CLAUDE.md`:

| Rule file | Tokens | Catalog content | Overlap with CLAUDE.md |
|-----------|--------|-----------------|------------------------|
| `.claude/rules/common/agents.md` | 4.6k | Agent Catalog 16-row table + Auto-Invoke list | ~40% |
| `.claude/rules/common/hooks.md` | 3.2k | Hook Catalog 22 hooks + 8 modules sub-tables | ~35% |
| `.claude/rules/common/development-workflow.md` | 3.3k | Command Reference 11 commands × 7 phases | ~45% |

The other 16 rule files are 0% catalog overlap — pure operational orchestration logic (decision trees, severity rules, enforcement mappings). Only these three are duplicating reference data into the auto-loaded budget.

The user's intent for the rules layer, stated 2026-04-26, is unambiguous: rules are **operational orchestration instructions for the orchestrator (Claude)** — decision trees, principles, enforcement logic. They are not catalogs. Catalogs are reference documents that should be read on-demand by code consumers and human readers, not pushed into every conversation turn.

A complicating factor: the Kadmon Harness is **always installed in every project** that opts into it (per ADR-010 distribution model). Kadmon-specific terms (agent names like `spektr`, slash commands like `/medik`) are NOT a portability problem in rules — they ARE the operational vocabulary the orchestrator must follow. The "strip everything Kadmon-specific from rules" framing was explicitly rejected during the 2026-04-26 design conversation. The actual problem is duplication of *static catalog data*, not the presence of named entities.

Two consumers read the affected rule files programmatically and constrain any move:

1. `.claude/hooks/scripts/agent-metadata-sync.js` parses the Agent Catalog table inside `agents.md` to keep agent metadata (model, trigger, skills) in sync after frontmatter edits. Its target file path is hardcoded.
2. `scripts/lib/capability-matrix.ts`'s `parseCommandLevelSkillsTable()` reads the `## Command-Level Skills` section of `agents.md` for `/medik` Check #14 (capability-alignment, ADR-029). That section is *operational* (it encodes which skills bypass agent ownership intentionally), not catalog data, and must remain in `agents.md`.

Distribution constraints: per ADR-010 + ADR-019, the harness ships its `.claude/{agents,skills,commands}/` directories via the Claude Code plugin loader (canonical root symlinks resolve into `.claude/<type>/`). Anything we put under those directories already ships through the existing plugin distribution path — no bootstrap or installer changes required.

A precedent for non-auto-loaded artifacts already exists: `.claude/agents/_TEMPLATE.md.example` (ADR-017) sits inside `.claude/agents/` but is not eagerly loaded by Claude Code because the runtime resolver only reads files via `Agent`/`Skill`/slash-command invocation paths, not by directory-walk. The `.md.example` extension was chosen there to also dodge linters; for our case, the literal filename `CATALOG.md` is sufficient because no linter or loader currently scans for `CATALOG.md`.

## Decision

Move the three catalogs from `.claude/rules/common/{agents,hooks,development-workflow}.md` to **dedicated, non-auto-loaded CATALOG.md files** at:

- `.claude/agents/CATALOG.md`
- `.claude/hooks/CATALOG.md`
- `.claude/commands/CATALOG.md`

The three rule files retain only operational orchestration content: decision trees, severity rules, enforcement mappings, and named cross-references to agents/hooks/commands. Each rule file gains a single-line pointer to its CATALOG.md sibling for human readers who want the full reference.

The `## Command-Level Skills` section in `agents.md` **stays in `agents.md`** — it is operational metadata (a curated list of skills that intentionally bypass agent ownership), not catalog data, and is consumed by `parseCommandLevelSkillsTable()` in `scripts/lib/capability-matrix.ts`. Moving it would require editing the parser AND the `/medik` Check #14 contract AND would erase a deliberate operational signal. It stays put.

`CLAUDE.md` is **not** expanded. CLAUDE.md is also auto-loaded; expanding it would yield zero net token savings and create a second source-of-truth problem with `agent-metadata-sync.js`. CLAUDE.md keeps its existing brief Agent | Model two-column table (used by `agent-metadata-sync.js`'s second sync target) unchanged.

One hook is repointed: `.claude/hooks/scripts/agent-metadata-sync.js` switches its full-table sync target from `.claude/rules/common/agents.md` to `.claude/agents/CATALOG.md`. Its CLAUDE.md sync block (the brief two-column table) is unchanged.

## Alternatives Considered

### Alternative 1: Expand CLAUDE.md to hold the full catalogs

- **Pros**: Single source of truth in a file every contributor already reads. Zero new files. No hook repoint needed.
- **Cons**: CLAUDE.md is itself auto-loaded into every conversation turn. Net token savings = 0 — the 11k of catalog data simply moves from one auto-loaded slot to another. CLAUDE.md would balloon past 600 lines and dilute the high-signal project-overview content that earns its auto-load slot.
- **Why not**: Fails the primary goal (token reduction). Violates the principle that auto-loaded content must be load-bearing on every turn — catalogs are reference data, not orchestration logic.

### Alternative 2: Move catalogs to `.claude/{agents,hooks,commands}/CATALOG.md` (CHOSEN)

- **Pros**: ~6–7k tokens / turn permanent savings (Memory files 32.6k → ~26k). Single source-of-truth per artifact type, co-located with the artifacts themselves. Bootstrap and plugin distribution unchanged — `.claude/<type>/` directories already ship via the plugin (ADR-010 + ADR-019). Code consumers (agent-metadata-sync, doks drift checks) read on-demand, not per turn. The `_TEMPLATE.md.example` precedent (ADR-017) confirms `.claude/agents/` files are not eagerly loaded by Claude Code's runtime resolver.
- **Cons**: Adds 3 new files to maintain (offset: doks agent gains drift-detection responsibility for CATALOG.md row counts vs. actual filesystem counts). One hook repoint required (agent-metadata-sync.js). One test fixture path update (tests/hooks/agent-metadata-sync.test.ts). Low residual risk that Claude Code starts auto-loading `CATALOG.md` files in a future release — mitigated by post-Step-1 manual `/context` validation and a documented fallback to `.claude/reference/CATALOG.md`.
- **Why chosen**: Only option that delivers real, permanent token savings AND keeps a single source-of-truth per artifact type AND requires zero distribution-layer changes. The hook repoint is a 5-line edit. The drift risk is bounded by the existing `_TEMPLATE.md.example` precedent and by an explicit verification gate.

### Alternative 3: Hybrid — brief in CLAUDE.md + detailed in REFERENCE.md outside `.claude/`

- **Pros**: Keeps a quick-reference visible in CLAUDE.md while moving detail out of the auto-load budget.
- **Cons**: Two files per artifact type to keep in sync. The brief CLAUDE.md table will drift from the detailed REFERENCE.md table within weeks — exactly the problem we are trying to solve. Out-of-`.claude/` storage means the file is not part of the plugin distribution, so installer machinery would need to ship it separately.
- **Why not**: Sync burden compounds the original duplication problem. Distribution requires new installer plumbing for zero benefit over Alternative 2.

## Consequences

### Positive

- **~6–7k tokens / turn permanent savings** — Memory files drop from 32.6k to ~26k. Compounds across every session for every contributor.
- **Single source-of-truth per artifact type.** The Agent Catalog lives in exactly one place (`.claude/agents/CATALOG.md`), the Hook Catalog in exactly one place (`.claude/hooks/CATALOG.md`), the Command Reference in exactly one place (`.claude/commands/CATALOG.md`).
- **Rules become navigable as orchestration logic.** Reading `agents.md` after the trim shows decision trees and routing principles without 50% scroll-through of a static table.
- **Bootstrap and plugin distribution unchanged.** `CATALOG.md` ships inside `.claude/{type}/`, which is already covered by the plugin manifest (ADR-010) and canonical root symlinks (ADR-019). No installer changes, no marketplace.json changes, no new permissions.
- **Co-location with artifacts.** Agents directory holds agent files AND the catalog of agents. Hooks directory holds hook scripts AND the catalog of hooks. The reference data lives next to the thing it references.

### Negative

- Adds 3 new files to maintain. Offset: doks agent (`.claude/agents/doks.md`) gains explicit drift-detection responsibility for verifying CATALOG.md row counts match the filesystem (16 agents, 22 hooks, 11 commands).
- One hook repoint required: `.claude/hooks/scripts/agent-metadata-sync.js` switches `agentsMdPath` from `.claude/rules/common/agents.md` to `.claude/agents/CATALOG.md`. The CLAUDE.md sync block (brief two-column table) stays at its existing target — no second repoint.
- One test fixture path update: `tests/hooks/agent-metadata-sync.test.ts` re-shapes the temporary fixture path. All 7 existing assertions remain identical in logic.
- Skills, commands, or agent files that reference removed sections by literal heading ("see Agent Catalog above") will need wording updates. Mitigation: pre-flight grep on `.claude/{skills,agents,commands}/` for "Agent Catalog", "Hook Catalog", "Command Reference" string matches before Step 3.

### Risks

- **CATALOG.md auto-loading by Claude Code.** If Claude Code's runtime resolver decides to eagerly load `CATALOG.md` files in `.claude/<type>/`, the entire token-savings rationale collapses. **Likelihood: Low** — `_TEMPLATE.md.example` (ADR-017) sits in `.claude/agents/` today and is not auto-loaded; the resolver is invocation-driven, not directory-walk-driven. **Mitigation**: post-Step-1 manual `/context` validation gate. If the gate fails, fall back to `.claude/reference/CATALOG.md` (a directory Claude Code does not auto-traverse). The fallback path is documented in the plan but expected not to fire.
- **`agent-metadata-sync.js` test fixture drift.** The hook's test file uses a temp directory with a synthetic `agents.md`-shaped table; the new target file is `agents/CATALOG.md`-shaped. **Mitigation**: Step 2 of the plan explicitly re-shapes the fixture; logic-level assertions are unchanged because the table format itself is unchanged.
- **`/medik` Check #14 false fail.** `parseCommandLevelSkillsTable()` reads `## Command-Level Skills` in `agents.md`. **Mitigation**: that section is explicitly preserved verbatim in `agents.md` — only the Agent Catalog and Auto-Invoke sections are removed. Verified by reading `scripts/lib/capability-matrix.ts` before issuing this ADR.
- **Cross-references in skills/agents to removed sections.** Some skill or agent file may say "see Agent Catalog in agents.md". **Mitigation**: pre-flight grep step before Step 3 of the plan; replace any matches with pointer to CATALOG.md.
- **Plugin-distributed projects lose catalogs.** **Likelihood: Zero** — CATALOG.md files live inside `.claude/{type}/`, which is the exact directory shipped by the plugin manifest. Existing distribution covers this without change.

## Verification

After implementation, the following gates MUST pass:

1. **Token audit**: `/context` Memory files section drops from 32.6k to ~26k. Concrete acceptance threshold: Memory files < 28k tokens.
2. **`/medik` Check #14**: capability-alignment PASSES — `parseCommandLevelSkillsTable()` still finds the `## Command-Level Skills` section in `agents.md`.
3. **`agent-metadata-sync.js` end-to-end**: edit any agent's `model:` frontmatter field, save, observe the hook write to `.claude/agents/CATALOG.md` (not `.claude/rules/common/agents.md`). The CLAUDE.md brief Agent | Model table sync remains unaffected.
4. **Vitest suite**: `npm run build && npx vitest run` — all 1069+ tests pass. Exactly one fixture path update is expected (`tests/hooks/agent-metadata-sync.test.ts`).
5. **Doks drift**: `/doks` reports CATALOG.md row counts (16/22/11) matching filesystem reality.
6. **Auto-load gate** (post-Step-1, manual): restart session, run `/context`, confirm `.claude/agents/CATALOG.md` does NOT appear in Memory files. If it does, fall back to `.claude/reference/CATALOG.md` per the fallback path documented in plan-035.

## References

- **plan-035**: `docs/plans/plan-035-rules-catalog-source-of-truth.md` — implementation steps, file deltas, rollback per step, test plan. Source plan currently held at `C:\Users\kadmo\.claude\plans\te-comento-q-en-transient-frost.md` and to be moved to the canonical plan path.
- **ADR-017**: `docs/decisions/ADR-017-agent-template-system.md` — `_TEMPLATE.md.example` precedent confirming `.claude/agents/` files are not eagerly loaded by Claude Code. The non-auto-load behavior CATALOG.md depends on is the same behavior `_TEMPLATE.md.example` has been relying on since 2026-04-19.
- **ADR-019**: `docs/decisions/ADR-019-canonical-root-symlinks-for-plugin-loader.md` — canonical root symlinks `./{agents,skills,commands}` resolve into `.claude/<type>/` for the Claude Code plugin loader. CATALOG.md files inside those directories ship through the existing plugin distribution path with no manifest changes.
- **ADR-010**: `docs/decisions/ADR-010-harness-distribution-hybrid.md` — hybrid plugin + install.sh distribution model. Confirms `.claude/<type>/` directories are plugin-shipped territory.
- **ADR-029**: `docs/decisions/ADR-029-capability-alignment-audit.md` — `/medik` Check #14 (capability-alignment) and the `parseCommandLevelSkillsTable()` consumer that constrains where the Command-Level Skills section can live.

## no_context Application

This ADR is grounded in direct reads of the three rule files (line counts and section boundaries), `scripts/lib/capability-matrix.ts` (the `parseCommandLevelSkillsTable()` consumer that pins `## Command-Level Skills` to `agents.md`), the existing ADR-029 (style and tone reference), and plan-035 at its current draft location. The 32.6k token figure comes from the user's `/context` audit on 2026-04-26, not from estimation. The 16/22/11 artifact counts come from CLAUDE.md status line cross-checked against filesystem reality. The `_TEMPLATE.md.example` non-auto-load precedent (ADR-017) is the load-bearing assumption for the chosen path; the verification step exists precisely because that assumption — while well-supported — is the one place where this decision could fail at runtime in a future Claude Code release.
