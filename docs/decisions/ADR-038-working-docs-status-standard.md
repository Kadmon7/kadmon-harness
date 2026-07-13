---
number: 38
title: Working-docs status standard + drift-prevention enforcement
date: 2026-07-13
status: accepted
route: A
plan: plan-038-working-docs-status-standard.md
---

# ADR-038: Working-docs Status Standard + Drift-Prevention Enforcement

**Deciders**: Ych-Kadmon (arkitect)

## Context

The harness accumulated a family of "working docs" that track state in three different
notations, and they have started to drift:

- **ADRs** (`docs/decisions/*.md`) — frontmatter `status:`. Survey: 30x `accepted`, 2x `superseded`. Documented enum (abra-kdabra.md "Artifact Format"): `proposed | accepted | deprecated | superseded`. No drift.
- **Plans** (`docs/plans/*.md`) — frontmatter `status:`. Survey: 27x `completed`, 1x `in-progress`, 2x `superseded`. Documented enum: `pending | in_progress | completed`. **Two drifts**: (a) one plan uses `in-progress` (hyphen) where the enum is `in_progress` (underscore) — plan-036, set by AUD-08; (b) `superseded` is in use on 2 plans but is not in the documented plan enum — it leaked from the ADR enum.
- **Roadmap** (`docs/roadmap/*.md`) — no frontmatter `status:` at all; inline `[ ]`/`[x]`/`[d]` checkboxes plus prose.
- **BACKLOG.md** — 5-marker checkbox legend `[ ] [~] [x] [-] [d]` (line 7). **WORK.md** — timestamped bold-prose entries, no checkboxes.

The triggering incident: AUD-35/36/38 shipped in commit `d56e2b8` but their BACKLOG checkboxes
were never flipped to `[x]`. The drift was caught manually this session, not by any tool. AUD-28
asks to (1) unify the status enum, (2) document ADR/plan numbering gaps in `docs/README.md`, and
(3) wire BACKLOG/WORK upkeep into `/chekpoint` + a `/medik` check.

Constraints: this is hygiene infrastructure, not a user feature. Prefer extending existing
machinery (`stale-plans.ts` pattern, the `medik-checks/` registry, `/chekpoint` tier notes) over
new subsystems. Any new check must respect the `/medik` latency posture and needs TDD.

## Decision

**Do not force-merge the enums.** ADR lifecycle (`proposed -> accepted -> deprecated -> superseded`)
and plan lifecycle (`pending -> in_progress -> completed`) are semantically distinct — a decision's
acceptance state versus a work item's completion state. Collapsing them into one vocabulary would be
a worse abstraction. "Unify" here means: canonicalize each enum separately, fix the real drift,
document every surface in one navigational home, and add mechanical enforcement.

Concretely:

1. **Canonical enums (separate, per lifecycle):**
   - ADR: `proposed | accepted | deprecated | superseded` (unchanged).
   - Plan: `pending | in_progress | completed | superseded` — **add `superseded`** (legalize the 2 in-use plans; a plan can legitimately be replaced by a re-planned task) and **fix `in-progress` -> `in_progress`** on plan-036 (a typo, not a new state).
   - Roadmap: keep checkbox + prose; **no frontmatter status is imposed** (milestone narrative docs are the wrong shape for a frontmatter enum).
   - BACKLOG.md / WORK.md: BACKLOG canonicalizes the existing 5-marker legend `[ ] [~] [x] [-] [d]`; WORK.md stays timestamped prose (structurally not checkbox-linted).

2. **Canonical home:** the operational spec for the two frontmatter enums stays **single-sourced in `abra-kdabra.md` "Artifact Format"** (that is where artifacts are born and where arkitect/konstruct read it). `docs/README.md` gains a **"Status conventions"** subsection that (a) describes all four surfaces and points to abra-kdabra.md for the frontmatter enums, (b) documents the BACKLOG legend, and (c) documents the numbering gaps (below). No enum is duplicated in prose — pointer, not copy — to avoid creating a second drift surface.

3. **Enforcement — two layers, neither a hard gate:**
   - **New `/medik` check #15 `docs-status-lint`** (a new module in `scripts/lib/medik-checks/`, registered in `DEFAULT_REGISTRY`, category `knowledge-hygiene`). AUD-28's "Check #10" reference is imprecise — #10 is already `stale-plans`; the new check is **#15**, sibling to #10, not an overload of it. It mechanically verifies: every `status:` in `docs/plans/*.md` and `docs/decisions/*.md` is a member of its canonical enum (**FAIL** on any non-member — this is a deterministic schema violation that downstream tooling, incl. `stale-plans` itself, silently misreads); every checkbox marker in `BACKLOG.md` is in the legal 5-marker set (**WARN** — hygiene, not correctness). Pure file reads + regex, no git calls -> comfortably under the 500ms budget.
   - **`/chekpoint` reminder (advisory NOTE, not a BLOCK).** At the commit step, when the commit body cites an `AUD-xx`/`R-xx` id, emit a NOTE: "if this ships <id>, flip its BACKLOG checkbox to `[x]` and update WORK.md." Tier-agnostic (even `skip` gets the string), zero new gate, no per-commit cost beyond a substring check.

4. **Numbering gaps in `docs/README.md`:** document that ADRs and plans share one monotonic counter, so a number can legitimately be plan-only (Route B), ADR-only, or fully skipped. Current state of 001-037: **023 is the only fully-skipped number** (no artifact of either type — a burned number, not a lost file); Route-B plan-only: 002, 004, 018, 030; ADR-only (no matching plan): 014, 021, 022, 024, 025, 026.

## Alternatives Considered

### Alternative 1: One unified status vocabulary across ADRs + plans + roadmap
- Pros: a single enum to memorize; one validation set; superficially "simpler".
- Cons: conflates two genuinely different lifecycles. `accepted` is meaningless for a work item; `completed` is meaningless for a decision. The roadmap's checkbox+prose model does not map onto any frontmatter enum at all. A merged vocabulary would force every doc to carry inapplicable states.
- Why not: it optimizes for a cosmetic "one list" at the cost of a leaky, lower-fidelity abstraction. The drift we actually have is a typo plus an unlisted-but-valid state — not a symptom of "too many enums".

### Alternative 2: Status quo — document the enums better, rely on manual review
- Pros: zero new code; no latency or maintenance surface.
- Cons: manual review is exactly the process that already failed (AUD-35/36/38 shipped with stale checkboxes; the `in-progress` typo sat un-caught). Documentation without a mechanical check decays the moment attention moves on.
- Why not: the motivating incident proves prose-only conventions do not hold under real velocity.

### Alternative 3: Overload existing check #10 (`stale-plans`) with enum validation
- Pros: no new registry entry; keeps the check count at 14.
- Cons: `stale-plans` has a focused responsibility (pending plans >3d old with recent git activity, WARN) and returns one `CheckResult`. Bolting schema validation onto it mixes two concerns (staleness heuristic vs deterministic enum lint) and two severities (WARN vs FAIL) into one module — violates SRP and the one-module-one-result pattern.
- Why not: a new sibling module (#15) is cleaner and matches the registry design. The two checks may share an extracted `parseFrontmatterStatus` helper (stale-plans already regexes `status:`; note R-15's `utf-8` nit lives there), which is the right kind of reuse.

## Consequences

### Positive
- The `in-progress` typo and the unlisted `superseded` state become a mechanical FAIL/legal-value instead of invisible drift; the check fails loudly on plan-036 until it is corrected.
- One navigational home (`docs/README.md` "Status conventions") describes every surface; the operational enum stays single-sourced in abra-kdabra.md — pointer, not copy.
- The exact AUD-35/36/38 class of drift now has a per-commit reminder (source-side) plus a periodic audit (catch-side) without taxing every commit.
- Numbering gaps stop looking like lost files; readers get an explicit "shared counter, 023 is skipped" note.

### Negative
- One more `/medik` check to maintain (14 -> 15) and one more registry entry.
- The `/chekpoint` NOTE is advisory: a disciplined-but-forgetful commit can still land with a stale checkbox — the periodic check #15 is the backstop, not the commit gate.
- BACKLOG-item <-> commit linkage ("shipped but not flipped") stays **advisory / out of mechanical scope**: reliably proving a commit ships a given AUD-xx needs commit<->item linkage the frontmatter does not encode. The check verifies marker legality and enum membership, not semantic completeness. This limit is stated honestly rather than faked.

### Risks
- **Risk:** check #15 FAILs immediately on the current tree (plan-036 `in-progress`). **Mitigation:** the plan (konstruct) must include a data-fix step — correct plan-036 to `in_progress` and expand the plan enum to include `superseded` — in the same change, so the check is green on landing (validate-before-ship).
- **Risk:** WORK.md's prose structure tempts a future author to add fragile prose-parsing to the check. **Mitigation:** ADR scopes WORK.md as explicitly non-linted; only BACKLOG.md checkboxes and plan/ADR frontmatter are in mechanical scope.
- **Risk:** duplicating the enum into the check code creates a third drift surface. **Mitigation:** the check hardcodes the enum as a const with a comment pointing to abra-kdabra.md as the spec (same convention other checks use for their thresholds); abra-kdabra.md remains authoritative.
- **Review date:** revisit if a fourth working-doc surface is added, or if the advisory `/chekpoint` NOTE proves insufficient and a hard gate becomes warranted (evidence: a second shipped-but-not-flipped incident after this lands).
