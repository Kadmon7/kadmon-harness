---
number: 021
title: install.allow merge, cross-platform paths, and .gitattributes distribution
date: 2026-04-21
status: accepted
route: A
plan: antes-de-comentarte-quiero-witty-emerson.md
supersedes_partially: ADR-010 Q4
---

# ADR-021: install.allow merge, cross-platform paths, and .gitattributes distribution

**Deciders**: Ych-Kadmon (arkitect proposal)

## Context

Sprint D shipped `install.sh` / `install.ps1` and delegated permissions merging to `scripts/lib/install-apply.ts` via `mergePermissionsDeny()` in `scripts/lib/install-helpers.ts`. ADR-010 Q4 codified **deny-only** as the merge strategy; `permissions.allow` was not decided — it was omitted.

Dogfooding against Kadmon-Sports (2026-04-20) and preparing onboarding for macOS + Windows collaborators surfaced three gaps:

1. The harness's 63 `permissions.allow` entries never reach targets. Targets installing fresh hit permission prompts for routine tools (`Bash(git:*)`, `Bash(npm:*)`, `Skill(*:*)`) that the harness itself considers standard.
2. `CANONICAL_DENY_RULES` contains `Read(/c/Users/kadmo/.ssh/**)` — a Git-Bash absolute path hardcoded to the maintainer's Windows home. On Mac it's a no-op (harmless) but it's identity contamination: the string announces "kadmo" inside every collaborator's settings.json. This was flagged as Sprint E scope but never closed.
3. `.gitattributes` in the harness root encodes symlink preservation for ADR-019 canonical root symlinks. ADR-010 mentions distribution as a future item but no decision was taken. Targets that don't use ADR-019 symlinks don't need it — but the question has to be answered explicitly.

## Decision

### Q1 — Merge a CORE subset of `permissions.allow` (Option B)

Implement `mergePermissionsAllow()` in `install-helpers.ts` with the same shape as `mergePermissionsDeny()` (union, dedup, harness-first order, same `MergeResult`-style return). Harness contribution is a curated **CORE subset of 9 items**, not the full 63:

```ts
export const CANONICAL_ALLOW_RULES = [
  "Bash(git:*)",
  "Bash(npm:*)",
  "Bash(npx:*)",
  "Bash(node:*)",
  "Bash(cd:*)",
  "Bash(ls:*)",
  "Bash(pwd:*)",
  "Bash(which:*)",
  "Skill(*:*)",
] as const;
```

**Rationale**: allow rules are additive permission surface — every entry reduces a security prompt that would otherwise default-deny. The 63-item set contains project-specific grants (`yt-dlp` is /skavenger-only, `WebFetch(domain:elevenlabs.io)` is KAIRON-only, `mcp__plugin_context7_*` is harness-only because Context7 isn't guaranteed to be installed in every target). Copying all 63 violates least-privilege for projects that will never use those tools.

The 9-item CORE is the **intersection of "used by every harness-based project"** (git/npm/node toolchain + shell navigation + Skill dispatch for plugins). Targets add project-specific allows themselves. Option A (all 63) bleeds harness identity into every target; Option C (documented manual) defeats the purpose of the bootstrap.

### Q2 — ELIMINATE the SSH deny rule (Option C)

Remove `Read(/c/Users/kadmo/.ssh/**)` from `CANONICAL_DENY_RULES` entirely. Do not replace with `Read(~/.ssh/**)`, do not add platform variants.

**Rationale**: Claude Code's permission system defaults to **ask** for `Read()` outside the project root. `~/.ssh/**` is outside every project by definition, so without an explicit allow it's already gated — the deny rule is redundant guardrail, not load-bearing. Keeping it requires solving tilde expansion semantics (unverified as of this ADR — arkitect did not confirm whether Claude Code expands `~` in permission strings) AND maintaining per-user paths. The simplest safe choice is removal: zero code, zero platform matrix, zero identity leak. If a future audit shows explicit deny is desirable, a follow-up ADR can add it once tilde semantics are verified via docs.claude.com.

spektr may revisit during /chekpoint — if blocking explicit deny is required, the conservative path is Option D (both `Read(~/.ssh/**)` AND platform-specific forms) after verifying Claude Code expansion rules. Deferred until verified.

### Q3 — DO NOT distribute `.gitattributes` (Option C)

The harness `.gitattributes` encodes ADR-019 canonical root symlinks (`agents`, `skills`, `commands` as mode 120000). Targets installed via the plugin+bootstrap model **do not have those symlinks** — the plugin loader distributes agents/skills/commands through the plugin cache, not through canonical root symlinks in the target repo. Copying `.gitattributes` to targets would configure symlink preservation for files that don't exist.

**Rationale**: `.gitattributes` is harness-build config, not harness-use config. Targets that adopt ADR-019 symlinks (none today) would need a purpose-built `.gitattributes` fragment — not a wholesale copy. If a target's own repo needs `.gitattributes` for unrelated reasons (e.g. line endings), the harness must not overwrite it.

## Alternatives Considered

### Q1 Alternative A — Merge all 63 allow rules
- Pros: zero permission prompts on first use; maximal ergonomics
- Cons: blanket allow for tools many targets never use (yt-dlp, ElevenLabs WebFetch); violates least-privilege; bloats target settings.json
- Why not: allow rules are additive security surface — ergonomics doesn't justify distributing 54 unused grants.

### Q1 Alternative C — No merge, manual in post-install checklist
- Pros: zero install surface change; user opts in per rule
- Cons: defeats the purpose of the bootstrap; every new project re-types the same 9 core tools; friction for collaborator onboarding
- Why not: a 9-item core is objectively universal to any Kadmon-based project; making users retype it is bootstrap failure.

### Q2 Alternative A — Replace with `Read(~/.ssh/**)`
- Pros: portable syntax; keeps explicit deny
- Cons: unverified whether Claude Code expands `~` in permission strings; if it doesn't, the rule is silently dead
- Why not: requires evidence from docs.claude.com before adoption. Deferred.

### Q2 Alternative D — Both platform forms
- Pros: explicit, belt-and-suspenders
- Cons: still leaks `/c/Users/kadmo` identity; double the maintenance
- Why not: if removal is safe (default-deny), doubling is overkill.

### Q3 Alternative A — Copy `.gitattributes` idempotently
- Pros: harness-identical target setup
- Cons: config mismatch — targets don't have the symlinks the file configures; may conflict with target's own .gitattributes
- Why not: config without matching artifacts is noise.

## Consequences

### Positive
- Fresh installs hit zero permission prompts for core toolchain (git/npm/node/shell/Skill) — collaborator onboarding smoother.
- `permissions.allow` merge logic has test parity with deny (same shape, same return type, same harness-first ordering) — ~15 min to implement.
- Removing `Read(/c/Users/kadmo/.ssh/**)` eliminates per-maintainer path leakage; no target settings.json carries "kadmo" anymore.
- `.gitattributes` decision is explicit and documented — future audits won't re-debate it.

### Negative
- `mergePermissionsAllow()` adds one new export + one new constant (`CANONICAL_ALLOW_RULES`) to maintain in sync with `.claude/settings.json` (same drift risk as existing deny sync).
- The 9-item core may need expansion later as harness scope grows; each addition is an ADR amendment.
- SSH deny removal depends on Claude Code's default-deny behavior for paths outside the project root. If that behavior changes, the guardrail has to be rebuilt.

### Risks
- **Risk**: CORE allow list becomes stale vs harness settings.json (same drift risk as deny, but no verify script exists today to catch it).
  **Mitigation**: Sprint E candidate — add `scripts/verify-permissions-sync.ts` that compares both arrays against live `.claude/settings.json`.
- **Risk**: A target had a conflicting allow rule (unlikely — strings are identical; dedup handles it).
  **Mitigation**: `mergePermissionsAllow` dedup + unit test covering the overlap case.
- **Risk**: Claude Code adds allow/deny semantics we didn't anticipate (e.g. regex, negation).
  **Mitigation**: strings are opaque to the merger; merger is future-proof as long as rules remain string-equality-dedupable.

## Compatibility

- **Partially supersedes ADR-010 Q4**: permissions merge extended from deny-only to **deny + allow**. ADR-010 Q4's deny merge semantics are unchanged; allow merge is additive with the same shape.
- **Cross-references ADR-019**: confirms canonical root symlinks are harness-internal; targets do not inherit them, so no `.gitattributes` distribution.
- **Backward compatible**: existing target settings.json files are read-then-merged; no destructive rewrite. Targets without a `permissions.allow` block get one created.

## Implementation plan

1. Add `CANONICAL_ALLOW_RULES` to `scripts/lib/install-manifest.ts` with the 9-item core. Mirror the "edit policy" JSDoc from the deny block so drift is flagged.
2. Remove `Read(/c/Users/kadmo/.ssh/**)` from `CANONICAL_DENY_RULES` in `install-manifest.ts`. Update the "Path note" JSDoc to reflect Q2 decision.
3. Delete the matching line from `.claude/settings.json` to keep harness-target parity.
4. In `scripts/lib/install-helpers.ts`, add `mergePermissionsAllow(harness, target)` with **identical shape** to `mergePermissionsDeny()`: same return interface (rename `MergeDenyResult` → `MergePermissionsResult` for symmetry), same harness-first ordering, same dedup semantics. Export both functions from same module.
5. Extend `mergeSettingsJson()` in `install-apply.ts` to merge `permissions.allow` alongside `permissions.deny` — both use the same interface.
6. Update `install-apply.ts` to surface the allow merge report in the post-install summary: "Added N new allow rules, deduped M".
7. Add vitest coverage in `tests/lib/install-helpers.test.ts`: (a) empty target, (b) target with overlapping allows, (c) target with disjoint allows, (d) dedup exact-string match, (e) prototype pollution defense (reuse existing `safeAssign` tests).
8. **Deferred to Sprint E**: create `scripts/verify-permissions-sync.ts` to compare both `CANONICAL_ALLOW_RULES` vs `.claude/settings.json` allow block AND `CANONICAL_DENY_RULES` vs deny block. Out of scope for this ADR.

## Red flags

- **Red flag 1 — Target-first ordering for allow**. Some would argue `permissions.allow` should list target rules FIRST (target owns its workspace; harness contributions go last). **Rejected**: harness-first is stable, semantically equivalent (allow is a set, order doesn't gate anything), and symmetric with `mergePermissionsDeny`. Asymmetry for asymmetry's sake is a maintenance hazard.
- **Red flag 2 — Skipping dedup "because they're unique anyway"**. A target that previously ran install will already have `Bash(git:*)`. Without dedup the merged array contains duplicates. **Rejected**: dedup is the whole point; use the existing `seen: Set<string>` pattern.
- **Red flag 3 — Divergent return shape (`MergeDenyResult` vs `MergeAllowResult`)**. Proposed by developer ergonomics — "allows have different metadata". **Rejected**: both merges compute the same three values (merged, added, dedupedCount). Rename to `MergePermissionsResult` and reuse.
