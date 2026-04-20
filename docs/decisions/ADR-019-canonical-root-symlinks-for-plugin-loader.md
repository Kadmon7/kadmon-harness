---
number: 19
title: Canonical Root Symlinks for Plugin Loader
date: 2026-04-20
status: accepted
route: A
plan: plan-019-canonical-root-symlinks-for-plugin-loader.md
supersedes_partial: ADR-010-harness-distribution-hybrid.md
---

# ADR-019: Canonical Root Symlinks for Plugin Loader

**Deciders**: Ych-Kadmon (architect), arkitect (agent).

> **Scope note**: This ADR partially supersedes ADR-010. Specifically, it supersedes the `install.sh` fallback-copy strategy for runtime components (agents/skills/commands). The rest of ADR-010 — the hybrid plugin + bootstrap philosophy, the `KADMON_RUNTIME_ROOT` primitive, the husky pre-commit policy, the `extraKnownMarketplaces` install strategy, plugin manifest schema decisions — remains authoritative.

## Context

The Kadmon Harness ships as a hybrid Claude Code plugin + bootstrap installer (ADR-010, plan-010). The plugin half is expected to deliver the runtime catalog (16 agents, 46 skills, 11 commands, 21 hooks) via Claude Code's native plugin system; the `install.sh` / `install.ps1` half delivers the gap (rules, `permissions.deny` merge, `settings.local.json` template, `.kadmon-version` marker).

During the Step 2.5 mini-dogfood on 2026-04-20 — installing the plugin against a clean target via `/plugin install` — three bugs surfaced that broke the plugin half's delivery:

1. **Bug 1 — `agents` field rejected entirely**: Claude Code's plugin manifest validator refuses the `agents` field in `plugin.json` when it points at a directory or a glob. The validator expects an array of explicit file paths, per the reference fetched 2026-04-20.
2. **Bug 2 — `skills` partial-load**: only 12 of 46 skills loaded. The remaining 34 were silently dropped by the loader's subdirectory traversal.
3. **Bug 3 — SessionStart banner silent in plugin mode**: the session-start banner did not render when the hook ran from inside `${CLAUDE_PLUGIN_ROOT}`. This is a separate Sprint E issue — it requires Claude Code to support `env` blocks in `hooks.json` — and is **not addressed by this ADR**.

### Pre-compact working hypothesis (Decision B, now rejected)

Before the 2026-04-20 research sprint, the locked hypothesis was that Bugs 1 and 2 had no plugin-level fix. The proposed workaround (Decision B) was to extend `install.sh` to copy `.claude/agents/**/*.md` and `.claude/skills/**/SKILL.md` directly into the target project, bypassing the plugin loader entirely. That path would have worked mechanically but would have made the "plugin" half carry only hooks and commands — a ~70% gutting of the plugin's raison d'être.

### Research evidence (four convergent agents, 2026-04-20)

Four parallel research agents, spawned from the same brief, converged on the same root cause and the same fix shape:

- **Explore agent (local audit)**. Walked `~/.claude/plugins/cache/kadmon-harness/kadmon-harness/1.1.0/.claude/` and confirmed that all 16 agents + 46 skills + 11 commands transport correctly into the plugin cache. **The files arrive intact; the loader does not find them at the paths it searches.**
- **Almanak agent (Context7 live docs)**. Fetched the plugin loader spec and confirmed that Claude Code's plugin loader expects components at canonical paths — `./agents/`, `./skills/`, `./commands/`, `./hooks/` — at the plugin root, not inside `.claude-plugin/` or `.claude/`. When these paths are absent, the loader silently loads nothing for that type (or, in the `agents` case, the validator rejects a directory-string and nulls the whole field).
- **claude-code-guide agent (official spec cross-check)**. Verified against the plugins-reference doc that symlinks are preserved end-to-end in the plugin cache. Quoted verbatim from `docs.claude.com/docs/en/plugins-reference`: *"Symlinks are preserved in the cache rather than dereferenced, and they resolve to their target at runtime."* This is the enabling fact — a symlink at the plugin root resolves at load time to the real `.claude/<type>/` directory.
- **Skavenger agent (deep research, confidence 0.895)**. Surfaced [GitHub issue #46786](https://github.com/anthropics/claude-code/issues/46786) documenting the `plugin.json` validator strictness. The `agents` field requires an array of explicit file paths, never a directory string. The `skills` field accepts directories but dotfile subdirectory traversal (`.claude/skills/...`) is unreliable — the loader walks into non-dotfile directories only. This explains both Bug 1 (validator-level rejection of `agents: ".claude/agents"`) and Bug 2 (subdirectory traversal into a dotfile path silently dropping entries).

### Constraints

- **Self-use must not break.** When working *on* the Kadmon-Harness repo directly (not via the plugin), Claude Code reads `.claude/<type>/` by convention. Any reorganization that moves agents/skills/commands out of `.claude/` forces ~50 internal reference updates plus test adjustments (609 tests currently passing, 59 test files).
- **Cross-platform.** Joe and Eden work on macOS; Ych-Kadmon and Abraham on Windows. The distribution mechanism must work on both. Mac symlink support is native and invisible. Windows requires Developer Mode ON plus `git config --global core.symlinks true` — a known one-time setup cost.
- **Fork semantics.** The harness is infrastructure, carried to every project via bootstrap (ADR-010). Whatever layout the root repo ships, forks inherit mechanically.
- **No new MCPs, no new plugins.** The project stays lean. Enforcement must be in-process code, not external tooling.

### User framing

The pre-research default (Decision B — install.sh copy fallback) optimized for *friction minimization*: skip the plugin loader, solve the bug with shell scripts, ship. The user explicitly rejected that framing when presented with the research evidence, via AskUserQuestion on 2026-04-20: **"lo q quiero es q funcione mi plugin entiendes???"** — plugin-first correctness over friction minimization. That rejection is the architectural signal anchoring this ADR's decision.

## Options Considered

### Option A — Physical reorganization (Ruta X)

Move `.claude/agents/` → `./agents/`, `.claude/skills/` → `./skills/`, `.claude/commands/` → `./commands/` at the repo root. Update every internal reference (tests, rules, hooks, ADRs, plans, commands) to point at the new paths. Plugin loader finds everything by convention; no symlinks needed.

- **Pros**:
  - 100% cross-platform. No symlink semantics anywhere, no Windows Developer Mode requirement, no `git config` one-time setup.
  - Matches Claude Code plugin conventions literally, not by symlink indirection. Zero trust in "symlinks are preserved at runtime" continuing to be true.
  - Fork bootstrap copies the canonical layout directly; no resolve-at-runtime surprises.
- **Cons**:
  - **Breaks harness self-use.** When Claude Code is invoked on the Kadmon-Harness repo directly (the author's daily workflow), it reads `.claude/<type>/` by convention. If those directories are moved, self-use is broken until a `.claude/` stub layer is maintained — and maintaining that stub layer reintroduces a symlink-class problem anyway.
  - ~50 internal references to update across tests, rules, hooks, ADRs, plans, and commands. Every `.claude/agents/` string in the codebase becomes a find-and-replace liability.
  - Test churn is non-trivial. The 59-file Vitest suite includes multiple test fixtures that assert on `.claude/<type>/` paths. Every one requires an update; some are snapshots that must be regenerated.
  - Forks that updated to the new repo expect the old `.claude/<type>/` layout during transition — breaking change without a migration.
  - **Plugin-first architecture achieved by brute force, not by design.** Solves Bug 1 and Bug 2 but invalidates the historical `.claude/<type>/` convention the harness has taught to every skill, rule, and ADR.

### Option B — Canonical root symlinks (Ruta Y) — CHOSEN

Create three symlinks at the repo root:

```
./agents    -> .claude/agents
./skills    -> .claude/skills
./commands  -> .claude/commands
```

Omit custom path fields from `plugin.json` so the Claude Code plugin loader falls back to its default lookup (`./agents/`, `./skills/`, `./commands/`) at the plugin root. Symlinks resolve to the real `.claude/<type>/` directories at load time, per the verbatim-confirmed claim in `plugins-reference`. Self-use layout is unchanged; plugin-use layout is also satisfied.

- **Pros**:
  - **Zero disruption to self-use.** The `.claude/<type>/` convention continues to work when Claude Code is invoked on the Kadmon-Harness repo directly. 609 passing tests remain untouched.
  - **Zero test churn.** No test file asserts on the symlinks; they are pure distribution plumbing.
  - **Plugin-first architecture correct by design.** The plugin ships the canonical layout the loader wants; bootstrap handles only the gap (rules + `permissions.deny`).
  - **`install.sh` scope narrows dramatically.** Current plan-010 scope for `install.sh` includes agents + skills + commands + rules + `permissions.deny` + `.kadmon-version`. New scope is rules + `permissions.deny` + `.kadmon-version` only — a ~60% reduction in script complexity and a proportional reduction in surface area for cross-platform bugs (install.ps1 mirror shrinks similarly).
  - **Architecture aligns with Claude Code conventions.** Plugin-reference docs are authoritative; symlink preservation is explicitly documented.
  - **ADR-010 remains ~80% accepted.** Only one section of ADR-010 is superseded (the install.sh fallback-copy strategy for runtime components). Hybrid plugin + bootstrap philosophy, `KADMON_RUNTIME_ROOT`, husky pre-commit policy, `extraKnownMarketplaces` — all retained. Minimal ADR-graph disruption.
- **Cons**:
  - **Windows requires one-time setup** (Developer Mode ON + `git config --global core.symlinks true`). Mitigated by: (a) documenting the setup in README, (b) `install.sh` / `install.ps1` detecting unresolved symlinks and aborting with a clear setup instruction that points at the exact Windows settings toggle and the exact git config command.
  - **Exposure if Claude Code ever changes symlink handling.** If the plugin cache starts dereferencing symlinks (materializing their targets as copies) or strips them entirely, this scheme breaks silently. Mitigated by: (a) the plugins-reference documentation explicitly commits to preservation — a breaking change there would be a Claude Code regression, not our design flaw; (b) the harness `/medik` health check can grow a "verify plugin distribution" step in Sprint E that reads the plugin cache and asserts the symlinks resolved.
  - **Symlink creation on a fresh clone** requires git to have `core.symlinks = true`. Git defaults to `true` on macOS/Linux and `false` on Windows. Abraham (Windows collaborator) needs the one-time global config. Mitigated by `install.sh` gate with clear error message.
  - **Session-start banner silent bug (Bug 3) is NOT addressed.** That fix requires Claude Code to support `env` blocks in `hooks.json`, which is a Sprint E dependency tracked separately.

### Option C — install.sh fallback-copy (Ruta Z) — REJECTED (this was the pre-research Decision B)

Extend `install.sh` (and mirror in `install.ps1`) to copy `.claude/agents/**/*.md` and `.claude/skills/**/SKILL.md` from the plugin cache into the target project's `.claude/` directory at install time. The plugin still ships the files, but the plugin loader is bypassed entirely for agents and skills; only hooks and commands run through the plugin.

- **Pros**:
  - **No Windows setup friction.** Works on stock Windows git without Developer Mode or `core.symlinks` config.
  - **Simplest to ship.** A shell loop over a glob pattern, already partially built in plan-010's install.sh draft.
  - **No dependency on symlink preservation semantics** in the plugin cache.
- **Cons**:
  - **Bypasses the plugin system.** The plugin becomes a shell for hooks + commands only; agents and skills are delivered via shell scripts. This hollows out the plugin value proposition.
  - **Double source of truth.** Agents and skills live both in the plugin cache (where Claude Code's plugin machinery can see them but doesn't load them) AND in the target's `.claude/` (where they're actually read). Update mechanics require syncing both sides, or inventing rules for which one wins.
  - **Fights Claude Code architecture.** The plugin loader IS the extension mechanism. Writing install scripts that bypass it sets a pattern ("when something is broken at the plugin level, copy around it") that bifurcates every future harness feature.
  - **Cross-platform burden doubles.** install.sh and install.ps1 now carry the full runtime catalog copy logic, plus the runtime directories' directory-layout assumptions, plus file-by-file error handling for each copy target.
  - **Falsifies the plugin-first framing in ADR-010.** ADR-010 explicitly chose the plugin as the primary carrier for agents/skills/commands; reducing it to a carrier for only hooks + commands is a retreat.
  - **Explicitly rejected by the user.** Plugin-first correctness is the architectural preference; Ruta Z optimizes the wrong axis.

### Option D — Hybrid X+Z (reorganize + copy fallback)

Physically reorganize to `./agents/`, `./skills/`, `./commands/` AT the root AND keep install.sh copy fallback for safety. Rejected without extended analysis:

- **Cons**:
  - Complexity multiplier: all the test churn and self-use disruption of Option A, plus all the double-source-of-truth cost of Option C, without the correctness win of either.
  - No architectural gain over Option B. If symlinks work (they do, per verbatim plugins-reference), Option B achieves plugin-first correctness at strictly lower cost.

## Decision

**Option B — Canonical root symlinks.**

Specifically:

1. **Create three symlinks at the repo root** committed as symlink entries in the git tree:
   - `./agents` → `.claude/agents`
   - `./skills` → `.claude/skills`
   - `./commands` → `.claude/commands`
2. **Omit custom path fields** (`agents`, `skills`, `commands`) from `plugin.json`. The Claude Code plugin loader defaults to `./agents/`, `./skills/`, `./commands/` at the plugin root — the symlinks satisfy those defaults.
3. **Narrow `install.sh` / `install.ps1` scope** to three responsibilities only:
   - Merge `permissions.deny` block from the harness's `.claude/settings.json` into the target's `.claude/settings.json` (existing logic, unchanged).
   - Copy the `.claude/rules/` tree into the target (`rules` is not a supported plugin type; bootstrap carries it).
   - Write the `.kadmon-version` marker file for update detection (existing logic, unchanged).
4. **Gate install.sh / install.ps1 on symlink validity**: at the start of install, verify the three symlinks resolve. If any resolve to a non-existent target (the Windows "git didn't materialize the symlink" case), abort with:
   - The exact Windows setting to toggle (Developer Mode ON).
   - The exact git command to run (`git config --global core.symlinks true`).
   - A pointer to the README section with screenshot or equivalent visual aid.
5. **Document the Windows setup** in README under an "Installing on Windows" subsection. One-time setup, ~30 seconds of wall-clock time for a new collaborator.

### Rationale

Option B wins on the constraints:

- **Self-use preserved.** The `.claude/<type>/` convention is untouched; zero test churn; zero internal reference rewrites.
- **Plugin-first correctness.** The plugin loader sees the canonical layout it expects; agents, skills, and commands all distribute through the same mechanism. No bypass, no double source of truth.
- **Minimum ADR-graph disruption.** ADR-010's core decisions (hybrid philosophy, `KADMON_RUNTIME_ROOT`, husky, `extraKnownMarketplaces`) remain authoritative. This ADR is a surgical replacement of one ADR-010 subsection.
- **Cross-platform cost is bounded and documented.** Windows one-time setup is the only friction, and it is observable at install time (the script gate prevents silent failure).
- **Evidence-driven.** Four independent research paths converged on the same root cause and the same fix. The plugins-reference doc is the authoritative source and the verbatim quote on symlink preservation is explicit.
- **User-aligned.** "lo q quiero es q funcione mi plugin" — the plugin must carry its runtime catalog, not cede that responsibility to shell scripts.

### Principle alignment

- **Modularity**: symlinks are a single-purpose plumbing layer with zero business logic.
- **Maintainability**: reduces install.sh scope by ~60%, shrinking the cross-platform surface area.
- **Security**: no new execution paths; the symlinks point into the repo's own `.claude/` subtree, never outside.
- **Defense in depth**: install-time symlink validation catches the Windows case before it manifests as silent breakage.
- **Immutability**: the symlinks themselves are immutable distribution primitives — created once at repo setup, never mutated at runtime.
- **No Big Ball of Mud**: clear boundary — plugin carries agents/skills/commands/hooks, bootstrap carries rules + permissions + version marker.
- **No Golden Hammer**: symlinks are used for the specific problem they solve (loader expects paths at root), not reached for elsewhere.

### Scope of ADR-010 superseded

**Superseded** (replaced by this ADR):

- ADR-010 §"Fallback: install.sh copies agents/skills/commands" — **REPLACED** by symlink-based distribution via the plugin.
- ADR-010 any reference to `install.sh` carrying runtime components (agents, skills, commands) — **NARROWED** to rules + `permissions.deny` + `.kadmon-version` only.

**Retained** (ADR-010 continues to govern):

- Hybrid plugin + bootstrap philosophy.
- Plugin manifest schema decisions (`plugin.json` structure, `hooks.json` registration shape).
- `KADMON_RUNTIME_ROOT` primitive design for lifecycle hooks locating compiled TypeScript.
- Husky pre-commit policy for shipping `dist/`.
- `extraKnownMarketplaces` install strategy.
- `settings.local.json` template policy (user-owned, gitignored, never distributed).
- First-session latency rationale (Q1 — ship compiled `dist/`).

## Consequences

### What changes

- **Three symlinks at the repo root**: `./agents`, `./skills`, `./commands`, each pointing at its `.claude/<type>/` counterpart. Committed to git as symlink tree entries.
- **`plugin.json` edit**: remove `agents`, `skills`, and `commands` custom path fields if present. Leave `hooks` pointing at `.claude-plugin/hooks.json`.
- **`install.sh` and `install.ps1`**: drop the agents/skills/commands copy blocks. Add the symlink-resolution gate at the start. Update user-facing messages to describe the narrower scope.
- **README addition**: an "Installing on Windows" section documenting Developer Mode + `core.symlinks`.
- **`.gitattributes` check**: verify existing `.gitattributes` (if any) does not contain directives that would corrupt symlink handling (e.g. `text=auto` is fine; symlinks are mode 120000 in the git object db regardless).
- **`/medik` health check (Sprint E)**: a new optional check that verifies the plugin cache's symlinks resolve end-to-end when the plugin is installed. Not part of this ADR's rollout; tracked for the Sprint E backlog.

### Migration path

- **Phase 1 — create symlinks and prune `plugin.json`**. One commit. Verify on a fresh clone (Windows with `core.symlinks` enabled and Developer Mode ON) that the plugin loads all 16 agents + 46 skills + 11 commands.
- **Phase 2 — narrow install.sh / install.ps1**. Delete the runtime-component copy blocks; add the symlink-resolution gate; update error messages.
- **Phase 3 — Windows documentation**. README "Installing on Windows" section with exact commands and settings paths.
- **Phase 4 — dogfood against a fresh target**. Re-run the Step 2.5 mini-dogfood (same as the one that surfaced Bugs 1 + 2) and confirm all three bugs are resolved at the plugin level — except Bug 3 (session-start banner), which is Sprint E dependency and out of scope here.
- **Phase 5 — supersede marker in ADR-010**. Add `superseded_partial_by: ADR-019-canonical-root-symlinks-for-plugin-loader.md` to ADR-010's frontmatter. Do NOT edit ADR-010's body (ADRs are append-only per `architecture-decision-records` skill).

Backward compatibility: total for self-use. Plugin-distribution compatibility: the old install.sh behavior (copy agents/skills/commands) is replaced, not deprecated-with-overlap. Forks installed before this ADR carry a stale install layout; they re-run install.sh to re-sync, and the new scope does no harm on a target that already has agents/skills/commands in `.claude/` (those files live in the plugin cache, not copied to the target anymore — the target's `.claude/` keeps what install.sh wrote previously but it is inert against the plugin loader).

### Risks

- **Windows symlink setup friction for new collaborators.** Mitigated by: (a) README documentation; (b) `install.sh` / `install.ps1` gate that halts with a clear setup instruction rather than failing silently; (c) Mac collaborators (Joe, Eden) bypass this entirely — their setup is zero-config; (d) the one-time nature of the setup means every affected developer only pays the cost once.
- **Claude Code changes symlink handling in plugin cache.** Low-probability because plugins-reference documents preservation explicitly, and breaking it would regress many plugins beyond ours. Mitigations: (a) monitor plugins-reference for changes at the 2026-10-20 review date; (b) file a GitHub issue against anthropics/claude-code if stripping is observed in the wild, citing this ADR's dependency on the current behavior; (c) Sprint E `/medik` health check can detect the regression at install time, giving an early signal.
- **Symlink creation on CI or fresh clone fails silently.** Mitigated by the install.sh gate — the first line of defense. Secondary mitigation: add a `/medik` assertion that the three root symlinks resolve; emit a clear failure if not.
- **Bug 3 (session-start banner) remains open.** Not addressed by this ADR by design. Tracked as Sprint E dependency on Claude Code supporting `env` blocks in `hooks.json`. Acceptable because Bug 3 has a clean workaround today (the banner is a nice-to-have, not load-bearing for functionality) and the fix is external.
- **Git tooling quirks on Windows.** Git Bash handles symlinks correctly when `core.symlinks = true`. Native PowerShell git.exe also handles them when Developer Mode is ON. The only known failure mode is `core.symlinks = false` — which the gate catches.

### Review date

**2026-10-20** — 6 months. Evaluate:

1. Did any new collaborator (Mac or Windows) hit a setup snag the README didn't cover? If yes, strengthen the docs.
2. Did Claude Code change symlink handling in the plugin cache (reading the plugins-reference changelog)? If yes, plan migration.
3. Did install.sh / install.ps1 scope stay narrow? If it grew back toward carrying runtime components, investigate why and consider a successor ADR.
4. Did `/medik` get a plugin-distribution health check in Sprint E? Is it catching regressions?
5. Bug 3 status — did Claude Code ship `env` block support for `hooks.json`? If yes, fold into a separate ADR or patch.

If symlink preservation proves unreliable OR the Windows setup burden turns out to block more than ~10% of Windows collaborators, evaluate fallback to Option A (physical reorganization) as a successor ADR. If stable, Option B stands.
