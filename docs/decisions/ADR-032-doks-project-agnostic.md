---
number: 32
title: /doks project-agnostic via runtime profile detection
date: 2026-04-26
status: proposed
route: A
plan: plan-032-doks-project-agnostic.md
---

# ADR-032: /doks project-agnostic via runtime profile detection

**Deciders**: Ych-Kadmon (architect), arkitect (proposer)

**Supersedes**: original 2026-04-26 ADR-032 draft (same file, replaced in-place because the ADR was never accepted). Reason for in-place rewrite — original draft was based on an incorrect premise about consumer `.claude/{agents,skills,commands}` being symlinked into the harness plugin cache. Empirical investigation 2026-04-26 invalidated that premise; the corrected design no longer needs symlink protection.

## Context

`/doks` is the Kadmon Harness 4-layer documentation sync command shipped at `.claude/commands/doks.md` (v1.3.0):

- Layer 1 — `CLAUDE.md`, `README.md` (project root)
- Layer 2 — `.claude/rules/common/{hooks,agents,development-workflow}.md`
- Layer 3 — `.claude/commands/*.md`
- Layer 4 — `.claude/agents/*.md`, `.claude/skills/*/SKILL.md`

Per the project-agnostic mandate driving ADR-031 (skanner) and ADR-033 (medik, planned), `/doks` MUST work safely in consumer projects (Kadmon-Sports, ToratNetz, KAIRON), not only inside the harness self-repo. Its current body hard-codes harness assumptions — Step 2 ground-truth uses `ls .claude/agents/*.md | wc -l` and the agent table cites the harness counts (16 agents, 46 skills, 11 commands, 22 hooks). Invoked from a consumer cwd, `/doks` would rewrite the consumer's `CLAUDE.md` with **harness** counts and component descriptions, semantically corrupting consumer docs.

### Empirical correction (the original ADR-032 premise was wrong)

The earlier draft assumed consumer projects' `.claude/{agents,skills,commands}` are symlinks into `~/.claude/plugins/cache/kadmon-harness/...` and therefore that `/doks` running in a consumer would silently corrupt the shared plugin cache. Verification 2026-04-26 falsifies that assumption:

1. **`install.sh` line 4 header**: "Does NOT copy agents/skills/commands — those ship via the plugin's canonical root symlinks (ADR-019 Ruta Y)." The installer copies only `.claude/rules/`, writes `permissions.deny`, `.gitignore` entries, `.kadmon-version`, and a `settings.local.json` template. It never creates `.claude/{agents,skills,commands}` in consumer projects.
2. **ADR-019 canonical root symlinks** live at the **harness repo root** (`Kadmon-Harness/agents -> .claude/agents`, etc.) so the Claude Code plugin loader can discover components from the plugin cache directory. They are NOT replicated into consumer projects.
3. **Kadmon-Sports `.claude/` actual contents** (verified 2026-04-26): `rules/`, `agent-memory/`, `settings.json`, `settings.local.json`. There is no `agents/`, `skills/`, or `commands/` directory at all.
4. **Plugin cache** at `~/.claude/plugins/cache/kadmon-harness/kadmon-harness/1.2.3/` contains a full clone of the harness repo. Claude Code resolves plugin components from THAT path, not from the consumer cwd. `/doks` running in a consumer cwd has no logic to traverse to the plugin cache and would not reach it via relative paths.
5. **Anthropic plugin docs** (verified via claude-code-guide agent 2026-04-26): when a project has both a plugin-provided component and a project-local `.claude/<type>/foo.md` of the same name, the plugin version wins. With unique names, both load. Consumers can therefore safely add project-local components in `.claude/{agents,skills,commands}/` without colliding with the plugin.

The "catastrophic plugin-cache corruption via symlink resolution" risk is therefore a **false premise**. No `isSymlink()` helper is needed; no per-layer symlink protection is needed. The real problem is purely semantic: `/doks` enumerates harness components even when run from a consumer cwd whose CLAUDE.md should describe the consumer's own work.

User additionally stated 2026-04-26 that `.claude/rules/` is "general for any project" — rules are harness-owned single source of truth. Consumer copies (created by `install.sh`) MUST NOT be edited by `/doks` from a consumer cwd. Updates to rules happen only from harness self-`/doks`; `install.sh` re-run resyncs consumer copies.

Reusable infrastructure exists from plan-031 (commit `a3b3d75`): `scripts/lib/detect-project-language.ts` exports `detectSkannerProfile(cwd, explicitArg)`. Plan-033 (planned) wants the same detector renamed to `detectProjectProfile`. Plan-032 ships that rename now; plan-033 inherits via alias.

## Decision

Adopt **runtime profile detection with per-layer eligibility** for `/doks`.

**HARNESS PROFILE** (markers: `scripts/lib/state-store.ts`, `.claude-plugin/plugin.json`, `.claude/hooks/scripts/observe-pre.js`):
- Layer 1 (CLAUDE.md, README.md) — writable
- Layer 2 (.claude/rules/) — writable (single source of truth lives here)
- Layer 3 (.claude/commands/) — writable
- Layer 4 (.claude/agents/, .claude/skills/) — writable
- Behavior preserved byte-identical vs current. Snapshot diff is the regression backstop.

**CONSUMER PROFILE** (cwd is not the harness self-repo):
- Layer 1 (CLAUDE.md, README.md) — writable. Describes the consumer project itself.
- Layer 2 (.claude/rules/) — **READ-ONLY**. `/doks` emits NOTE: "Rules are harness-shared (general for all projects). Update from harness self-/doks; install.sh re-run resyncs the consumer copy."
- Layer 3 (.claude/commands/) — writable IFF the consumer has created project-local commands. Plugin-provided commands are NOT enumerated.
- Layer 4 (.claude/agents/, .claude/skills/) — writable IFF the consumer has created project-local components. Plugin-provided components are NOT enumerated.
- Counts come from `cwd`-relative `ls`, never from plugin-cache traversal.
- Consumer CLAUDE.md output includes a NOTE: "Plugin kadmon-harness provides shared infra (16 agents, 46 skills, 11 commands, rules/) — not enumerated here. See harness self-docs."

**OVERRIDE PRECEDENCE** (consistent with ADR-031 and planned ADR-033):
1. Explicit `/doks harness|consumer` arg
2. `KADMON_DOKS_PROFILE` env var
3. `KADMON_PROJECT_PROFILE` umbrella env var
4. Filesystem markers
5. Fallback — consumer (safer default for unknown projects)

**FUNCTION RENAME** ships here:
- `detectSkannerProfile` → `detectProjectProfile` in `scripts/lib/detect-project-language.ts`
- Backward-compat alias `export const detectSkannerProfile = detectProjectProfile` retained until v1.4 deprecation
- Plan-033 (medik) inherits via the alias

**NO `isSymlink()` HELPER** — the original premise was wrong; consumer projects have no symlinked layer dirs to detect.

## Alternatives Considered

### Alternative 1: Harness-only `/doks` (refuse in consumer with error)
- **Pros**: Simplest possible refactor; zero risk of incorrect consumer behavior
- **Cons**: Layer 1 sync (`CLAUDE.md`, `README.md`) is genuinely useful in consumer projects and has no semantic risk; users lose that benefit
- **Why not**: Same user feedback (2026-04-26) that drove ADR-031 and planned ADR-033 explicitly rejects harness-only commands

### Alternative 2: Per-project layer-dual model — `.claude/{agents,skills,commands}-local/` writable + `.claude/{agents,skills,commands}/` symlinked from harness
- **Pros**: Explicit shared-vs-local separation; consumer can edit shared components by forking
- **Cons**: Doubles the `.claude/` surface; requires plugin-loader extension to discover the `-local/` dirs (ADR-010 amendment); user has not asked for forkability
- **Why not**: Out of scope for plan-032; defer to v1.4 if forkability becomes a real need

### Alternative 3: Always-writable consumer Layers 2-4 (current behavior, no profile detection)
- **Pros**: Zero refactor cost
- **Cons**: `/doks` from consumer cwd writes harness counts and descriptions into consumer CLAUDE.md; rules edits drift between consumer and harness; semantically broken
- **Why not**: This is the bug being fixed

### Alternative 4 (chosen): Profile detection with per-layer eligibility
- **Pros**: Layer 1 works everywhere; consumer Layer 2 protected from drift; consumer Layers 3-4 describe project-local components only; harness self-`/doks` byte-identical; rename ships cleanly for plan-033
- **Cons**: Output is more verbose (per-layer eligibility lines); consumer counts are cwd-only and require an explicit NOTE explaining plugin-inherited components
- **Why chosen**: Solves the real semantic bug, preserves harness self-doks behavior, and reuses the proven ADR-031 detection pattern

## Consequences

### Positive
- `/doks` produces semantically correct output in any cwd
- Harness self-doks remains byte-identical (regression backstop = snapshot diff)
- `detectProjectProfile` rename ships here; plan-033 inherits via alias
- Consumer Layer 2 (rules) is protected from accidental drift
- Plugin cache is provably untouched (no path in `/doks` traverses to it)

### Negative
- Per-layer eligibility output is more verbose than today (4 lines vs unified status)
- Consumer counts will not include plugin-inherited components without an explicit NOTE
- Future per-project component additions require a deliberate user action (create `.claude/<type>/foo.md` locally) — no auto-fork

### Risks
1. **Misdetection in monorepos** (project nested inside harness clone or vice versa) — mitigation: env-var + explicit-arg override (proven pattern from ADR-031)
2. **Harness self-doks regression** — mitigation: snapshot-diff Phase 4.4 byte-identical gate against pre-refactor output
3. **Consumer dogfood corruption (does `/doks` accidentally write to plugin cache?)** — mitigation: explicit Phase 4.5 stat-mtime check on `~/.claude/plugins/cache/kadmon-harness/...` files pre/post run; harness git-status post-run verification
4. **Layer 2 (rules) drift between harness and consumer** — user-acknowledged: `install.sh` re-run is the resync mechanism; consumer `/doks` never edits rules
5. **User confusion when consumer doks shows "0 agents"** because no project-local agents exist yet — mitigation: explicit NOTE in output explaining plugin-inherited components are not enumerated by design

## References

- ADR-010 (plugin distribution hybrid) — clarifies that plugin cache lives outside consumer cwd
- ADR-019 (canonical root symlinks) — narrowed scope: symlinks at harness repo root only, NOT in consumer projects
- ADR-020 (runtime language detection) — extended pattern; this ADR adds an orthogonal detector reusing the env-var override pattern
- ADR-031 (project-agnostic /skanner stack) — sister refactor, same profile pattern, shipped
- ADR-033 (medik project-agnostic, planned) — coordinated rename inherits via alias
- Anthropic plugin docs — `https://code.claude.com/docs/en/plugins.md`. Confirms plugin-vs-project precedence (plugin wins on name collision; both load when names unique). Verified via claude-code-guide agent 2026-04-26.
- Empirical Kadmon-Sports state at `C:/Command-Center/Kadmon-Sports/.claude/` (verified 2026-04-26): only `rules/`, `agent-memory/`, `settings*.json`. No agents/skills/commands dirs.
- Empirical `install.sh` line 4 header: "Does NOT copy agents/skills/commands"
- Empirical plugin cache layout at `~/.claude/plugins/cache/kadmon-harness/kadmon-harness/1.2.3/`
- `scripts/lib/detect-project-language.ts` — implementation site for the rename
- `.claude/commands/doks.md` — current 4-layer model documentation; updates in plan-032

## Plan reference

Implementation plan: `docs/plans/plan-032-doks-project-agnostic.md` (rewritten in same number — see konstruct phase 2).
