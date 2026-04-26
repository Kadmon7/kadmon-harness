---
number: 32
title: /doks project-agnostic via runtime profile detection + symlink protection
date: 2026-04-26
status: proposed
route: A
plan: plan-032-doks-project-agnostic.md
---

# ADR-032: /doks project-agnostic via runtime profile detection + symlink protection

**Deciders**: Ych-Kadmon (architect), arkitect (proposer)

## Context

`/doks` is the Kadmon Harness 4-layer documentation sync command shipped at `.claude/commands/doks.md` (v1.3.0):

- Layer 1 — `CLAUDE.md`, `README.md` (project root, consumer-local always)
- Layer 2 — `.claude/rules/common/{hooks,agents,development-workflow}.md`
- Layer 3 — `.claude/commands/*.md` (command specs)
- Layer 4 — `.claude/skills/*/SKILL.md` (skill content)

Per `CLAUDE.md` Project Overview, harness commands MUST work in consumer projects (Kadmon-Sports, ToratNetz, KAIRON), not just inside the harness self-repo. User feedback 2026-04-26 explicitly rejected the harness-only command anti-pattern (same call that drove ADR-031 / ADR-033).

When the user installs the harness in a consumer project via plugin (ADR-010 + ADR-019), the consumer's `.claude/{agents,skills,commands}` directories are **canonical root symlinks pointing back at the harness install** — that's how the Claude Code plugin loader discovers components (ADR-019 dogfood 2026-04-20).

If `/doks` follows current behavior in a consumer project:

1. Reads layer 2-4 files via the symlink, resolves to `~/.claude/plugins/cache/kadmon-harness/...`
2. Modifies the actual harness files in the plugin cache
3. Every consumer project shares the same symlink target → cross-project corruption
4. Harness-side `/chekpoint` reviews subsequently fail because consumer-side `/doks` rewrote them

This is **catastrophic for the ADR-010 plugin distribution model**. The bug is currently latent only because the user has not yet dogfooded `/doks` outside the harness. The first invocation of `/doks` in ToratNetz would corrupt harness state for every consumer.

Reusable infrastructure already exists from plan-031 (commit `a3b3d75`): `scripts/lib/detect-project-language.ts` exports `detectSkannerProfile(cwd, explicitArg)` returning `'harness' | 'web' | 'cli'`. ADR-033 (medik refactor, planned-but-not-shipped) also calls for renaming this to `detectProjectProfile`. Since `/doks` ships before `/medik` per user choice, the rename ships in plan-032 (this ADR's plan) and plan-033 inherits cleanly.

## Decision

Adopt **runtime profile detection + per-layer symlink protection** for `/doks`:

1. **Harness profile** detected (markers: `scripts/lib/state-store.ts`, `.claude-plugin/plugin.json`, etc.) → 4-layer sync, current behavior unchanged. Harness self-repo writes to its own `.claude/` as today.
2. **Consumer profile + symlink layer** (e.g. `.claude/agents/` resolves as a symlink to harness install) → that layer is read-only. `/doks` describes the layer in its output but does NOT write to it. Emits `WARN: layer X is a symlink to harness install — read-only`.
3. **Consumer profile + forked layer** (consumer created a local non-symlink copy) → sync the local copy. Forking signals project-local intent.
4. **Per-layer detection** — each layer dir checked independently via `isSymlink()`. Consumer might fork some layers but not others.
5. **Layer 1 always writes locally** — `CLAUDE.md` and `README.md` are project-root files, never symlinked into the plugin cache.
6. **Override mechanisms** — `KADMON_DOKS_PROFILE` env var or explicit `/doks harness|consumer` arg force-set the profile.
7. **Function rename ships HERE** — `detectSkannerProfile` → `detectProjectProfile` with deprecated alias `export const detectSkannerProfile = detectProjectProfile`. Plan-033 (medik) inherits the rename.
8. **Symlink helper** — add `isSymlink(path: string): boolean` (thin wrapper over `fs.lstatSync(path).isSymbolicLink()`) to `detect-project-language.ts` or a sibling `path-helpers.ts`.

## Alternatives Considered

### Alternative 1: Detect via `realpath` resolution (resolve to harness install vs consumer cwd)
- **Pros**: Single check, no per-layer scan
- **Cons**: Requires knowing the harness install path; brittle across plugin cache versions; fails when user installs harness from a fork
- **Why not**: Fragile dependency on plugin cache layout, which the Claude Code team owns and may change

### Alternative 2: Symlink-write protection at OS level via `fs.lstat` check before every write (without profile)
- **Pros**: Simple, defends against the catastrophic case
- **Cons**: Loses the harness-vs-consumer narrative in `/doks` output; user can't tell *why* a layer is read-only; no override mechanism
- **Why not**: This IS the chosen approach **inside** the profile model. As a stand-alone solution it's strictly worse — same protection, less context, no overrides

### Alternative 3: Consumer-mode that always forks layers (auto-copy `.claude/skills/*` to local before sync)
- **Pros**: Consumer can edit skill content per-project
- **Cons**: Surprises users (silent fork-on-write), bloats consumer repo, defeats the plugin distribution model that intentionally shares skills
- **Why not**: User explicitly wants symlink read-only protection, not silent fork. Forking should be a deliberate consumer action

### Alternative 4: Skip `/doks` entirely in consumer projects (refuse with error)
- **Pros**: Zero risk of corruption
- **Cons**: Layer 1 sync (`CLAUDE.md`, `README.md`) is genuinely useful in consumer projects and has no symlink risk
- **Why not**: Same user feedback (2026-04-26) that rejected harness-only `/medik` rejects this. Consumers should get the value `/doks` can safely deliver

## Consequences

### Positive
- `/doks` usable in any consumer project via plugin install — Layer 1 always works
- Symlink protection prevents catastrophic harness corruption in the latent ADR-010 bug
- `detectProjectProfile` rename ships here; plan-033 medik inherits cleanly
- `isSymlink()` helper becomes reusable for future commands that traverse `.claude/`
- Acceptance test: harness self-`/doks` produces identical output as today (snapshot-diffable)

### Negative
- Per-layer symlink check adds one `lstatSync` per layer dir — negligible perf cost (microseconds)
- `detectSkannerProfile` rename requires backward-compat alias (already a standard pattern in the codebase)
- `/doks` command spec needs profile-aware wording in the 4-layer model description
- Output verbosity grows when warnings emit per skipped symlinked layer

### Risks
- **Misdetection in monorepo** — a sub-package with both harness-style and consumer-style markers could detect wrong. Mitigation: same as ADR-031/033 — `KADMON_DOKS_PROFILE` env var and `/doks harness|consumer` explicit arg override
- **Harness self-test breakage** — refactor must preserve current behavior in the harness self-repo. Mitigation: snapshot diff harness `/doks` output pre/post refactor; CI test in `tests/commands/doks.test.ts` asserts byte-identical output for the harness profile
- **`lstatSync` Windows behavior** — Windows symlink resolution differs from Unix (Developer Mode requirement, junction-vs-symlink distinction per ADR-019). Mitigation: test the `isSymlink()` helper on both Win11+Git Bash and macOS in plan-032 Phase Test; fall back to `fs.promises.lstat` if sync version misbehaves on Windows junctions
- **Mixed-state layer dirs** — consumer could have a regular dir `.claude/skills/` containing some symlinked sub-files. Decision: treat top-level dir as truth — if `.claude/skills/` is a regular dir, sync as forked even if some children are symlinks. Per-file granular check is overkill for v1.3 and would explode the `WARN` output. Document explicitly in `/doks` command spec
- **Env var namespace** — `KADMON_DOKS_PROFILE` joins `KADMON_SKANNER_PROFILE` (plan-031) and future `KADMON_MEDIK_PROFILE` (plan-033). Distinct envs are fine; possible future unification via `KADMON_PROJECT_PROFILE` umbrella with per-command override. Defer unification to v1.4

## References

- ADR-031 (project-agnostic /skanner stack) — sister refactor, same profile pattern. Source of `detectSkannerProfile` (commit `a3b3d75`)
- ADR-033 (medik project-agnostic, planned) — coordinated rename of `detectProjectProfile`. Plan-032 ships the rename; plan-033 inherits the alias
- ADR-010 (plugin distribution) — symlink protection is the direct consequence of this distribution model
- ADR-019 (canonical root symlinks) — defines the symlinks `/doks` must protect; documents Windows Developer Mode requirement
- ADR-020 (runtime language detection) — this ADR extends the runtime-detection pattern (rename only, no new file markers)
- `.claude/rules/common/agents.md` "Consolidator boundary" — kody exemption rationale (same as ADR-031/033, kody stays opt-out of profile routing)
- `scripts/lib/detect-project-language.ts` — implementation site for the rename + `isSymlink()` helper
- `.claude/commands/doks.md` — current 4-layer model documentation; updates in plan-032

## Plan reference

Implementation plan: `docs/plans/plan-032-doks-project-agnostic.md`
