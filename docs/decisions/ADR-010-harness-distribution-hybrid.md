---
number: 10
title: Harness Distribution via Hybrid Plugin + Bootstrap
date: 2026-04-14
status: accepted
route: A
plan: plan-010-harness-distribution-hybrid.md
supersedes_partial: ADR-003-harness-distribution.md
---

# ADR-010: Harness Distribution via Hybrid Plugin + Bootstrap

> **Deciders**: Ych-Kadmon (architect), arkitect (agent).
> **Scope**: This ADR formalizes a decision that was pre-made by converging evidence. The architecture is not under debate here. The ADR's job is to (a) record the decision against ADR-003's partial supersede, (b) resolve five implementation-level questions (Q1-Q5), and (c) scope Sprint D vs deferred work.
>
> **Parallel session note**: ADR-009 (`kerka` agent + `/research` command) shipped in the same window. Counts of agents, commands, skills, hooks, and tests in this document may drift as other parallel sessions land. Implementation MUST use glob patterns in the copy manifest, never hardcoded counts. See "Implementation Notes" below.

## Context

Kadmon Harness is infrastructure, not a product. It must be built once in `Kadmon-Harness/` and carried to every project (Kadmon-Sports, ToratNetz, KAIRON, COLMILLO-NBA, future targets). ADR-003 (2026-04-08, refreshed 2026-04-14) chose a copy-based bootstrap as the distribution mechanism. That decision's spirit still holds, but its mechanics break on contact with the real targets.

### Eight angles plan-003 did not contemplate

Discovered on 2026-04-14 while preparing to dogfood the harness onto `Kadmon-Sports`:

1. **Kadmon-Sports is Python.** It has `requirements.txt`, no `package.json`. plan-003's `mergePackageJson` step errors immediately with no file to merge into.
2. **COLMILLO-NBA is also Python.** 100% of the user's current real targets are polyglot or non-TypeScript. The "merge into target's package.json" assumption is invalid on day one.
3. **Windows PATH is hardcoded in 21 hook commands.** `.claude/settings.json` prefixes every hook with `PATH="$PATH:/c/Program Files/nodejs"`. A Mac collaborator (Joe, Eden) running a bootstrapped project would get either broken hooks or cosmetically ugly ones, depending on shell behavior.
4. **Three lifecycle hooks import compiled TypeScript via a hardcoded 3-level relative path.** `session-start.js`, `session-end-all.js`, `pre-compact-save.js`, plus `evaluate-patterns-shared.js`, use `new URL("../../../dist/scripts/lib/MODULE.js", import.meta.url)`. `ensure-dist.js:14` centralizes `resolveRootDir(metaUrl)` but also assumes a fixed 3-level walk. Under a plugin-style layout, hooks live in `${CLAUDE_PLUGIN_ROOT}/.claude/hooks/scripts/` while runtime lives in `${CLAUDE_PLUGIN_DATA}/dist/`. The 3-level walk goes to the wrong place.
5. **No install entry point.** There is no documented "how does Joe first obtain the harness on his Mac" step. A collaborator today has to know to clone the repo, `npm install`, understand the tsc build chain, and copy files manually.
6. **No cross-machine update mechanism.** Once installed, there is no way to pull newer harness versions without manual re-bootstrap or rerunning an ad-hoc script.
7. **package.json pollution of target.** plan-003 merges `sql.js`, `zod`, and `typescript` into the target's `package.json`. Python targets have no `package.json` to merge into; TypeScript targets end up with harness-runtime deps mixed into their product-runtime deps.
8. **No `.gitattributes` controlling line endings.** Hook scripts containing `#!/usr/bin/env node` shebangs or bash commands can get corrupted by CRLF conversion when repos move between Windows and macOS.

### Converging evidence for the pre-decided architecture

Four independent sources aligned on the same diagnosis:

- **almanak (Claude Code docs, 2026-04-14)** verified against `docs.claude.com`: plugins still cannot distribute `.claude/rules/**`, merge of `permissions.deny` from plugin to target is ambiguous, lifecycle hook registration from inside a plugin is undocumented. All three blockers from ADR-003 remain.
- **Ralph Loop plugin** demonstrates in production that plugin hooks with `${CLAUDE_PLUGIN_ROOT}` DO work end-to-end (stop-hook.sh pattern). Plugin hook registration is not only possible but already load-bearing for another plugin the user has installed.
- **everything-claude-code (ECC) v1.10.0 by affaan-m**: 38 agents, 156 skills, 72 commands in production. README literal quote: "plugins cannot distribute rules or settings, so install.sh handles that fallback." ECC ships a hybrid `plugin + install.sh + install.ps1` pattern. It is the exact case we are solving, already validated.
- **Three Explorer agents** mapped our own runtime paths on 2026-04-14: 0 `process.platform` branches in code, 21 Windows-only hook commands, hardcoded 3-level relative imports, and `ensure-dist.js` as the sole runtime-root primitive.

### Relationship to ADR-003

ADR-003's **conceptual decision** (Option A: copy-based bootstrap) survives. We still copy files to targets for the parts Claude Code's plugin system cannot ship.

ADR-003's **mechanics** are superseded:

| ADR-003 mechanic | Replaced by |
|---|---|
| Single-script bootstrap that copies everything | Hybrid: plugin for agents/commands/skills/hooks, install.sh/install.ps1 for rules + permissions |
| Merge harness deps into target's `package.json` | Node runtime lives in `${CLAUDE_PLUGIN_DATA}/`; zero target pollution |
| Hardcoded Windows PATH prefix in generated hook commands | `generateHookCommand(script, { platform })` emits OS-appropriate commands |
| Lifecycle hooks find `dist/` via 3-level relative walk | `KADMON_RUNTIME_ROOT` env var, with fallback to current walk for local dev |
| Implicit "re-run bootstrap to update" | Still re-run install.sh; Sprint E will add incremental update |
| `settings.local.json` unaware of install state | Unchanged — still user-owned, gitignored, never distributed |

ADR-003 status changes from `accepted` to `superseded_by: ADR-010` (partial). plan-003 status changes to `superseded_by: plan-010`.

## Decision

**Ship the harness as a hybrid Claude Code plugin + bootstrap installer, modeled on ECC v1.10.0.** The plugin (`.claude-plugin/plugin.json` + `.claude-plugin/hooks.json`) distributes everything the native plugin system supports: agents, commands, skills, and hooks. A bootstrap script (`install.sh` for bash / Git Bash, `install.ps1` for native PowerShell) distributes the rules-and-permissions gap, merges `permissions.deny` into the target's `.claude/settings.json`, and writes a `settings.local.json` template. Node runtime dependencies (`sql.js`, `zod`, `typescript`) live once in `${CLAUDE_PLUGIN_DATA}/` and are shared across all target projects — zero pollution of target `package.json` files. Lifecycle hooks locate compiled TypeScript via a new `KADMON_RUNTIME_ROOT` env var whose fallback preserves current local-dev behavior.

## Q1 — Ship compiled `dist/` or compile at install time?

**Decision: Option A. Ship compiled `dist/` in the plugin repo, enforced by a pre-commit hook.**

**Rationale.** First-session latency is the main UX pressure point. Users running `claude` for the first time after install should get a hot, responsive session, not a 10-second tsc warmup. Committing `dist/scripts/lib/*.js` makes the plugin self-contained — no toolchain assumptions about the target machine, no tsc binary required to exist at install time, no risk of compile failures during onboarding.

The cost is drift: `.ts` sources and `dist/*.js` can disagree if a developer forgets to rebuild before committing. We mitigate this with a hard pre-commit contract.

**Pre-commit hook contract** (enforced by `.husky/pre-commit` or equivalent; must be installed by `install.sh` on the harness repo itself, not on targets):

1. **Trigger**: Any staged file matching `scripts/lib/**/*.ts` or `scripts/lib/**/*.d.ts`.
2. **Action**: Run `npm run build`. On success, stage the resulting `dist/scripts/lib/**/*.js` files automatically so the commit includes both source and build output atomically.
3. **Failure mode**: If tsc exits non-zero, abort the commit with a clear error pointing at the first type error. Never commit half-built `dist/`.
4. **Developer escape hatch**: None. `--no-verify` is already blocked by the `block-no-verify` hook at the Claude Code layer. A developer who truly needs to bypass must do so via `git commit --no-verify` outside Claude Code, and that bypass surface is deliberately uncomfortable.
5. **CI safety net** (Sprint E): Add a GitHub Action that runs `npm run build` on every PR and fails if `git diff --name-only` shows any `dist/**` changes not present in the PR's committed tree. This catches the case where a developer committed `.ts` changes without rebuilding (e.g., on a fresh clone where the hook is not installed yet).

**Dev workflow after decision**:
- Local edit of `scripts/lib/foo.ts` → `git add scripts/lib/foo.ts` → `git commit -m "..."` → pre-commit runs tsc → pre-commit stages `dist/scripts/lib/foo.js` → commit finalizes with both files.
- Cloning the harness fresh: `git clone && ./install.sh --dev` installs the pre-commit hook. Without `--dev`, the hook is not installed (target collaborators never run the pre-commit hook; they consume pre-built `dist/`).

**install.sh does NOT run tsc.** The install script is pure copy + merge. Build tooling is a harness-developer concern, not a target-collaborator concern.

## Q2 — Manifest-driven profiles or single profile for Sprint D?

**Decision: Option B. Single "install everything" profile for Sprint D. Manifest-driven profiles deferred to Sprint E.**

**Rationale.** Sprint D is 4-5 days and its only hard-gating outcome is "unblock `Kadmon-Sports` dogfood end-to-end". Profile selection (`minimal`, `typescript`, `python`, `full`) is a legitimate Sprint E enhancement but adds manifest parsing, a CLI flag surface, a test matrix (4 profiles x 2 platforms = 8 combinations), and a UX layer around "which profile should I pick?". None of that is needed to ship Kadmon-Sports.

The single profile delivers the entire harness — 16 agents, 12 commands, 46 skills, 21 hooks, 19 rules — to every target. For Python targets like Kadmon-Sports and COLMILLO-NBA, the TypeScript-specific rules (`rules/typescript/**`) are still copied but are context-loaded only on TypeScript file edits; they carry no runtime cost when the target is Python. The inverse is true for Python rules on a TypeScript target.

**Deferred to Sprint E**: `manifests/minimal.json`, `manifests/typescript.json`, `manifests/python.json`, `manifests/full.json`, plus an `--install-plan` subcommand that shows what would be copied for a given profile.

## Q3 — Rules distribution: copy or symlink?

**Decision: Option A. Copy `.claude/rules/**` into the target as a frozen snapshot. Updates via re-running `install.sh`.**

**Rationale.** Symlinks are non-portable across the platforms the harness must support:

- **Windows native** (no Git Bash): creating symlinks requires either Developer Mode enabled or Administrator privileges. Silently downgrading to hard copy on permission failure hides the UX problem; failing hard on first install is worse.
- **FAT32 / exFAT / network drives**: symlinks are either unsupported or have unpredictable semantics.
- **Git interaction**: a symlinked `.claude/rules/` in the target repo would get committed as a symlink, which is a portability landmine for the collaborators who clone the target project afterwards.
- **Mental model**: collaborators reading `target/.claude/rules/common/agents.md` should see actual content, not a redirect. Debugging a symlink-walk is extra friction.

Copy-based distribution is slightly staler (updates require `./install.sh /path/to/target` re-run), but that operation is cheap and explicit. Sprint E's incremental update mechanism will make this friction-free by diffing source vs target and applying only changed files.

## Q4 — `permissions.deny` merge strategy?

**Decision: Option A. `install.sh` merges `permissions.deny` into the target's `.claude/settings.json` once at install time. Re-merge is opt-in via `./install.sh --force-permissions-sync /path/to/target`.**

**Rationale.** The alternative (SessionStart hook that re-verifies and re-merges every session) adds startup latency and creates a runtime failure surface: a hook that modifies `settings.json` during SessionStart can race with Claude Code's own settings read on other platforms. `permissions.deny` rules change infrequently — maybe once per sprint when the harness adds a new category of forbidden operations. An explicit `--force-permissions-sync` flag is the right affordance for that rare, deliberate event.

**Merge algorithm** (executed by `install.sh` / `install.ps1`):

1. Read target's existing `.claude/settings.json` (or start with `{}` if the file does not exist).
2. Read the canonical `permissions.deny` list from the harness source (`scripts/lib/install-manifest.ts` exports `CANONICAL_DENY_RULES`).
3. Union the two lists. Deduplicate. Preserve any target-specific deny rules that are not in the canonical list.
4. Write back to `.claude/settings.json` preserving unrelated keys (hooks, plugins, mcpServers) untouched.
5. Never touch `.claude/settings.local.json`. Ever.

**Drift detection** (documented, not enforced at runtime): Sprint E will add `npx tsx scripts/verify-deny-sync.ts /path/to/target` as a manual diagnostic. Sprint D collaborators must know to re-run install with `--force-permissions-sync` when the harness release notes call for it.

## Q5 — Private repo distribution strategy

**Decision (user-made, recorded here): Keep `Kadmon7/kadmon-harness` PRIVATE. Collaborators install via `gh auth login` (one-time, ~10-15 min) + `git clone https://github.com/Kadmon7/kadmon-harness.git` + `./install.sh /path/to/target`. Native `/plugin install` entry point is DEFERRED to Sprint E or Sprint F.**

**Rationale** (user's stated preference):
- Privacy during the Sprint D dogfood window outweighs the ergonomic cost of manual git clone.
- The harness repo still contains WIP ADRs, incomplete plans, experimental agents, and internal feedback that the user does not want public-indexed until the distribution mechanism itself is validated.
- Collaborator count is 3-4 people total (Ych-Kadmon, Abraham on Windows; Joe, Eden on Mac). A one-time `gh auth` setup per collaborator is tractable at that scale.

**Open uncertainty that MUST be verified during Sprint D implementation**:

Claude Code's `/plugin install` command may or may not support private GitHub repos when `gh auth` is already configured on the host. The docs are ambiguous on this point and almanak did not find a definitive answer on 2026-04-14. The three possible outcomes are:

1. **`/plugin install` supports private repos via gh credentials** — great, we can document the `/plugin install kadmon-harness` path for Sprint E even while keeping the repo private.
2. **`/plugin install` does NOT support private repos** — the only entry points are manual `git clone + install.sh` (Sprint D) and going public later (Sprint F).
3. **`/plugin install` supports private repos but only via a specific token scope / settings incantation** — document the incantation in the collaborator onboarding checklist.

**Concrete Sprint D verification step**: During Sprint D, one collaborator (target: Abraham on Windows, since that exercises the native PowerShell path too) attempts `/plugin install Kadmon7/kadmon-harness` with their `gh auth` already configured. The result is recorded in `docs/diagnostics/2026-04-DD-plugin-install-private-repo.md`. If outcome 1, `plan-010` adds a Sprint E task to document the native entry point. If outcome 2, Sprint F adds "consider making repo public" to the review checklist. If outcome 3, the incantation goes into the README immediately.

**Sprint E reconsideration window**: After Sprint D dogfood succeeds on Kadmon-Sports (target: 2026-04-21), reopen the public-vs-private question. The repo-privacy concern was load-bearing BEFORE the distribution mechanism was validated. After validation, the cost/benefit shifts — a publicly installable plugin is the dominant ergonomics win.

## Architecture details

### Plugin manifest structure

**`.claude-plugin/plugin.json`** (minimal v1.0.0):

```json
{
  "name": "kadmon-harness",
  "version": "1.1.0",
  "description": "Claude Code's operative layer — agents, commands, skills, hooks, rules",
  "author": "Kadmon7",
  "license": "UNLICENSED",
  "engines": {
    "claude-code": ">=1.0.0",
    "node": ">=20.0.0"
  },
  "components": {
    "agents": ".claude/agents/*.md",
    "commands": ".claude/commands/*.md",
    "skills": ".claude/skills/*.md",
    "hooks": ".claude-plugin/hooks.json"
  }
}
```

**`.claude-plugin/hooks.json`** (hook registration with `${CLAUDE_PLUGIN_ROOT}`):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "name": "session-start",
        "command": "${HOOK_CMD_PREFIX} ${CLAUDE_PLUGIN_ROOT}/.claude/hooks/scripts/session-start.js",
        "env": {
          "KADMON_RUNTIME_ROOT": "${CLAUDE_PLUGIN_DATA}"
        }
      }
    ],
    "Stop": [
      {
        "name": "session-end-all",
        "command": "${HOOK_CMD_PREFIX} ${CLAUDE_PLUGIN_ROOT}/.claude/hooks/scripts/session-end-all.js",
        "env": {
          "KADMON_RUNTIME_ROOT": "${CLAUDE_PLUGIN_DATA}"
        }
      }
    ],
    "PreCompact": [
      {
        "name": "pre-compact-save",
        "command": "${HOOK_CMD_PREFIX} ${CLAUDE_PLUGIN_ROOT}/.claude/hooks/scripts/pre-compact-save.js",
        "env": {
          "KADMON_RUNTIME_ROOT": "${CLAUDE_PLUGIN_DATA}"
        }
      }
    ]
  }
}
```

Note: `${HOOK_CMD_PREFIX}` is a placeholder that `install.sh` / `install.ps1` rewrite at install time per host OS (see "Cross-platform hook command generation" below). `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` are Claude Code native plugin variables.

`hooks.json` registers all `PreToolUse` / `PostToolUse` / `PreCompact` / `SessionStart` / `Stop` hooks currently in `.claude/settings.json`, one entry per matcher. The generation of the full `hooks.json` is deterministic from `.claude/settings.json` — Sprint D writes a `scripts/generate-plugin-hooks.ts` helper that reads the canonical settings and emits `hooks.json`, run once during build and committed.

### `KADMON_RUNTIME_ROOT` env var contract

**Purpose**: Decouple lifecycle hooks from the 3-level relative walk that assumes the current repo layout.

**Contract**:

1. If `process.env.KADMON_RUNTIME_ROOT` is set, it is the absolute path to the directory that contains `dist/scripts/lib/*.js` (i.e., `${RUNTIME_ROOT}/dist/scripts/lib/state-store.js` must be the real runtime).
2. If unset, fall back to `resolveRootDir(import.meta.url)` — the current 3-level walk from the hook script's location. This preserves local-dev behavior when running from the harness repo itself.
3. The env var is set by `hooks.json` for plugin-installed hooks, pointing at `${CLAUDE_PLUGIN_DATA}`. Claude Code populates `${CLAUDE_PLUGIN_DATA}` to a stable plugin-private directory where the plugin's files (including `dist/`) live after install.
4. No hook ever reads its own file path to derive the runtime root when `KADMON_RUNTIME_ROOT` is set. The env var wins unconditionally.

**Refactor target — `ensure-dist.js` `resolveRootDir` becomes**:

```javascript
export function resolveRootDir(metaUrl) {
  const envRoot = process.env.KADMON_RUNTIME_ROOT;
  if (envRoot && envRoot.length > 0) {
    return path.resolve(envRoot);
  }
  // Fallback: local dev, 3-level walk from the hook's location
  return path.resolve(fileURLToPath(new URL(".", metaUrl)), "..", "..", "..");
}
```

**Files that must be refactored** (confirmed by grep, 2026-04-14):

1. `.claude/hooks/scripts/ensure-dist.js` — `resolveRootDir` is the central primitive. This is the only semantic change; the other files below continue calling `resolveRootDir(import.meta.url)` and get the env-var behavior for free.
2. `.claude/hooks/scripts/session-start.js` — 3 dynamic imports (`state-store.js`, `session-manager.js`, `instinct-manager.js`) currently build URLs via `new URL("../../../dist/scripts/lib/...", import.meta.url)`. These must switch to building paths relative to the result of `resolveRootDir(import.meta.url)` so they respect `KADMON_RUNTIME_ROOT`.
3. `.claude/hooks/scripts/session-end-all.js` — 5 dynamic imports with the same pattern.
4. `.claude/hooks/scripts/pre-compact-save.js` — 1 dynamic import with the same pattern.
5. `.claude/hooks/scripts/evaluate-patterns-shared.js` — 3 dynamic imports (state-store, instinct-manager, pattern-engine) with the same pattern.

All five files use `new URL("../../../dist/scripts/lib/X.js", import.meta.url).href`. The refactor replaces those with:

```javascript
import { resolveRootDir } from "./ensure-dist.js";
import { pathToFileURL } from "node:url";
import path from "node:path";

const runtimeRoot = resolveRootDir(import.meta.url);
const stateStorePath = path.join(runtimeRoot, "dist", "scripts", "lib", "state-store.js");
const stateStore = await import(pathToFileURL(stateStorePath).href);
```

This preserves ESM dynamic import semantics and is safe on Windows (uses `pathToFileURL` not manual `file://` string concatenation).

**Test coverage for the refactor**: `tests/hooks/runtime-root.test.ts` with two scenarios per hook:
- Local dev: `KADMON_RUNTIME_ROOT` unset, hook runs from repo, falls back to 3-level walk, imports succeed.
- Plugin mode: `KADMON_RUNTIME_ROOT` pointed at a fixture `${CLAUDE_PLUGIN_DATA}` layout, hook runs from a path OTHER than the harness repo, imports succeed via env var.

### `install.sh` flow

```
install.sh [--force] [--force-permissions-sync] [--dry-run] [--dev] <target-path>

1. Detect OS
   - Windows Git Bash:   HOOK_CMD_PREFIX='PATH="$PATH:/c/Program Files/nodejs" node'
   - macOS / Linux:      HOOK_CMD_PREFIX='node'
   - Refuse native PowerShell (user must run install.ps1 instead)

2. Validate target path
   - Must exist, must be writable, must not be the harness repo itself

3. Copy .claude/rules/** to target/.claude/rules/ (frozen snapshot)
   - Uses rsync on Mac/Linux, cp -r + diff on Git Bash Windows
   - Dry-run mode lists files without copying

4. Merge permissions.deny into target/.claude/settings.json
   - Read target settings (or {} if missing)
   - Union with CANONICAL_DENY_RULES from install-manifest.ts
   - Write back, preserving unrelated keys
   - Skipped if file is a symlink or locked (error, never silent failure)

5. Write target/.claude/settings.local.json template (only if not exists)
   - Contains {} by default with a comment pointing at the onboarding doc
   - NEVER overwrite an existing settings.local.json

6. Write target/.gitignore additions
   - Append missing entries: .claude/settings.local.json, .claude/agent-memory/,
     dist/, node_modules/, .env, .env.*, *.db, *.db-journal
   - Deduplicate with existing content

7. Emit post-install checklist
   - "Run 'claude' in target directory"
   - "Verify 21 hooks fire on session-start"
   - "Create your own .claude/settings.local.json for machine-specific allow rules"
   - "If you see 'dist not found' errors, confirm CLAUDE_PLUGIN_DATA is populated"

8. If --dev flag: install pre-commit hook in the HARNESS repo (not target)
```

**`install.ps1` parity scope for Sprint D**: The native PowerShell script must handle steps 1-7 above. It can use simpler primitives than `install.sh` (e.g., PowerShell `Copy-Item -Recurse` instead of rsync) and can skip the `--dry-run` mode in Sprint D. Step 8 (`--dev` pre-commit hook install) is deferred — Windows harness developers use Git Bash for the dev workflow. Sprint E tightens install.ps1 to full parity with install.sh.

### Cross-platform hook command generation

**Problem**: `.claude/settings.json` in the canonical harness currently emits hook commands like:

```
PATH="$PATH:/c/Program Files/nodejs" node .claude/hooks/scripts/session-start.js
```

On macOS / Linux, the `PATH` prefix is harmless (the directory does not exist, so PATH append is a no-op), but it is ugly and confuses Mac collaborators reading their `settings.json`. More importantly, on native Windows (PowerShell / cmd outside Git Bash), the bash-style PATH syntax is invalid.

**Solution**: `install.sh` and `install.ps1` rewrite a placeholder in `hooks.json` at install time.

**Pseudo-code** (`scripts/lib/install-helpers.ts`):

```typescript
interface HookCommandContext {
  platform: NodeJS.Platform;
  usesGitBash: boolean; // true when running install.sh on Windows
}

export function generateHookCommand(
  scriptRelPath: string,
  ctx: HookCommandContext
): string {
  // scriptRelPath: "${CLAUDE_PLUGIN_ROOT}/.claude/hooks/scripts/session-start.js"
  if (ctx.platform === "win32") {
    if (ctx.usesGitBash) {
      // Git Bash on Windows: need the PATH prefix to find Node
      return `PATH="$PATH:/c/Program Files/nodejs" node ${scriptRelPath}`;
    }
    // Native PowerShell: rely on Node being in PATH (install.ps1 verifies this at step 1)
    return `node ${scriptRelPath}`;
  }
  // macOS / Linux: Node is in default PATH
  return `node ${scriptRelPath}`;
}
```

**Concrete examples**:

| Host | Generated command |
|---|---|
| Windows (Git Bash) | `PATH="$PATH:/c/Program Files/nodejs" node ${CLAUDE_PLUGIN_ROOT}/.claude/hooks/scripts/session-start.js` |
| Windows (native PowerShell) | `node ${CLAUDE_PLUGIN_ROOT}/.claude/hooks/scripts/session-start.js` |
| macOS | `node ${CLAUDE_PLUGIN_ROOT}/.claude/hooks/scripts/session-start.js` |
| Linux | `node ${CLAUDE_PLUGIN_ROOT}/.claude/hooks/scripts/session-start.js` |

**Where this runs**: The canonical `hooks.json` committed to the harness repo contains a placeholder `${HOOK_CMD_PREFIX}` token. `install.sh` (or `install.ps1`) reads the placeholder, substitutes it with the OS-appropriate prefix, and writes the result to the plugin's runtime location. This keeps the committed `hooks.json` platform-neutral and defers the platform choice to install time.

**Testability**: `tests/install/cross-platform-hook-gen.test.ts` runs `generateHookCommand` for all four scenarios above and asserts exact-string output. Zero runtime branching in production hook execution.

## Consequences

### Positive

- **Ships to Python targets.** Kadmon-Sports, COLMILLO-NBA, and any other non-Node target can consume the harness without needing a `package.json`. Runtime deps live once in `${CLAUDE_PLUGIN_DATA}`.
- **Zero target pollution.** Target `package.json` (if it even has one) is never touched. Target `.claude/settings.json` is only touched for `permissions.deny` merge.
- **Mac collaborators get clean hook commands.** No more `PATH="$PATH:/c/Program Files/nodejs"` junk in Joe and Eden's `settings.json`.
- **Rules and permissions fully distributed.** The gap that ADR-003 identified is solved by install.sh/install.ps1, not worked around.
- **Native `/plugin update` path exists (Sprint E+).** Once the private-repo question is resolved, collaborators can run `claude plugin update kadmon-harness` for incremental updates instead of re-running install.sh.
- **Future-proof.** If Claude Code eventually ships rules/permissions support in plugins, the bootstrap step can be retired incrementally. The plugin manifest structure is forward-compatible.
- **ECC-proven pattern.** The architecture is a scaled-down version of ECC v1.10.0, which is already running 38 agents / 156 skills / 72 commands in production. We are not inventing.

### Negative

- **Two distribution mechanisms to explain.** Collaborators must understand "the plugin ships X, install.sh ships Y." Mitigated by a single-command invocation (`./install.sh /path/to/target`) that does both.
- **`install.ps1` parity lag.** Sprint D ships a thinner install.ps1 than install.sh. Native Windows (non-Git-Bash) users get slightly degraded install UX in Sprint D. Sprint E closes the gap.
- **Pre-commit hook is mandatory discipline.** A harness developer who commits `.ts` changes without rebuilding ships stale `dist/`. Mitigated by the pre-commit hook + Sprint E CI check.
- **Private repo blocks `/plugin install` native entry point.** The ergonomic hit is real for Sprint D. Manual `gh auth + git clone + ./install.sh` is the documented path. Sprint E/F reopens this.
- **`KADMON_RUNTIME_ROOT` adds one env var to the mental model.** Documented in CLAUDE.md's "Environment Variables" section; surface area is minimal.

### Neutral

- **Build output lives in git.** `dist/scripts/lib/*.js` is committed. This grows the repo slightly (~100KB per lib file x ~18 files). Small cost for the self-contained plugin win.
- **`settings.local.json` behavior unchanged.** Still user-owned, gitignored, never distributed. Each collaborator still creates their own.
- **Agent memory behavior unchanged.** `.claude/agent-memory/` stays empty on new targets. Each target's agents learn project-specific patterns.

## Implementation notes

### Glob-based copy manifest (no hardcoded counts)

A parallel Claude Code session shipped ADR-009 + `/research` command + `kerka` agent in the same window. Other parallel sessions may land more changes during Sprint D. The copy manifest in `plan-010` MUST use glob patterns, not hardcoded counts, so it stays valid regardless of what other sessions add.

**Correct manifest structure** (`scripts/lib/install-manifest.ts`):

```typescript
export const COPY_MANIFEST = {
  // Copied by install.sh (rules gap)
  rules: [".claude/rules/**/*.md"],

  // Shipped by plugin.json components field (not copied by install.sh)
  plugin_components: {
    agents:   ".claude/agents/*.md",
    commands: ".claude/commands/*.md",
    skills:   ".claude/skills/*.md",
    hooks:    [
      ".claude/hooks/scripts/*.js",
      ".claude/hooks/pattern-definitions.json",
    ],
  },

  // Runtime dependencies (shipped via plugin dist/)
  runtime: [
    "dist/scripts/lib/**/*.js",
    "scripts/lib/schema.sql",
    "scripts/lib/evolve-generate-templates/*.md",
  ],

  // Never distributed
  skip: [
    ".claude/settings.local.json",
    ".claude/agent-memory/**",
    "node_modules/**",
    "tests/**",
    "docs/**",
  ],
};
```

**Never write anything like** `copyAgents({ count: 16 })` or `expect(agents.length).toBe(12)`. Tests must use `glob(".claude/agents/*.md").length >= 15` style invariants (lower bound) or validate that specific named agents exist, not exact counts.

### Files the plan MUST touch

**New files**:
- `.claude-plugin/plugin.json`
- `.claude-plugin/hooks.json` (generated from `.claude/settings.json` via `scripts/generate-plugin-hooks.ts`)
- `install.sh`
- `install.ps1`
- `.gitattributes` (forces `*.js text eol=lf`, `*.sh text eol=lf`)
- `scripts/lib/install-manifest.ts` (COPY_MANIFEST, CANONICAL_DENY_RULES)
- `scripts/lib/install-helpers.ts` (OS detection, path generation, settings merge, `generateHookCommand`)
- `scripts/generate-plugin-hooks.ts` (build-time: reads settings.json, emits hooks.json)
- `tests/install/install-manifest.test.ts`
- `tests/install/install-helpers.test.ts`
- `tests/install/cross-platform-hook-gen.test.ts`
- `tests/hooks/runtime-root.test.ts`
- `docs/decisions/ADR-010-harness-distribution-hybrid.md` (this file)
- `docs/plans/plan-010-harness-distribution-hybrid.md` (konstruct output)

**Modified files** (refactor targets for `KADMON_RUNTIME_ROOT`):
- `.claude/hooks/scripts/ensure-dist.js` — update `resolveRootDir` to consult env var
- `.claude/hooks/scripts/session-start.js` — 3 dynamic imports via resolveRootDir
- `.claude/hooks/scripts/session-end-all.js` — 5 dynamic imports via resolveRootDir
- `.claude/hooks/scripts/pre-compact-save.js` — 1 dynamic import via resolveRootDir
- `.claude/hooks/scripts/evaluate-patterns-shared.js` — 3 dynamic imports via resolveRootDir
- `docs/decisions/ADR-003-harness-distribution.md` — status `accepted` → partial `superseded_by: ADR-010`, add supersede note
- `docs/plans/plan-003-harness-distribution.md` — status `pending` → `superseded_by: plan-010`
- `CLAUDE.md` — new "Distribution" section, `KADMON_RUNTIME_ROOT` added to env var list

### Reference material

- **ECC v1.10.0** clone at `/tmp/research-clones/everything-claude-code/` (if available; Explorer agents confirmed contents on 2026-04-14). Read `plugin.json`, `hooks.json`, `install.sh`, `install.ps1`, `scripts/lib/utils.js` (isWindows/isMacOS helpers). Adapt concepts, not syntax — ECC is CommonJS JS, we are TypeScript ESM.
- **Ralph Loop plugin** (user has installed) as a working example of a plugin `stop-hook.sh` with `${CLAUDE_PLUGIN_ROOT}` path. Useful for validating that `hooks.json` registration works end-to-end in the current Claude Code runtime.
- **ADR-003** (partial ancestor) for the original "why copy-based" rationale and the file categorization table.

## Sprint scope

**Sprint D (MVP, 4-5 days) — IN SCOPE**:

1. `.claude-plugin/plugin.json` v1.0.0
2. `.claude-plugin/hooks.json` generated from settings.json
3. `KADMON_RUNTIME_ROOT` refactor: `ensure-dist.js` + 4 lifecycle/shared hooks
4. `install.sh` (bash / Git Bash): steps 1-7 of the install flow, including OS-aware hook command generation
5. `install.ps1` (native PowerShell): steps 1-7 with thinner primitives; dry-run deferred
6. `scripts/lib/install-manifest.ts` and `scripts/lib/install-helpers.ts`
7. Pre-commit hook contract (install via `install.sh --dev` on harness repo)
8. `.gitattributes` forcing LF on `*.js`, `*.sh`, `*.ts`
9. `tests/install/**` and `tests/hooks/runtime-root.test.ts`
10. Glob-based copy manifest (no hardcoded counts anywhere)
11. End-to-end dogfood on Kadmon-Sports: `cd Kadmon-Harness && ./install.sh /c/Command-Center/Kadmon-Sports && cd /c/Command-Center/Kadmon-Sports && claude → /forge → /evolve`
12. Verify cross-project isolation: Kadmon-Harness and Kadmon-Sports have distinct `projectHash` rows in `~/.kadmon/kadmon.db`
13. Verification of `/plugin install Kadmon7/kadmon-harness` against a private repo with `gh auth` (Q5 open question) — documented in `docs/diagnostics/`
14. README.md "INSTALL" section documenting the manual git-clone + install.sh path

**Sprint E (walk) — DEFERRED**:

- Manifest-driven profiles (`minimal`, `typescript`, `python`, `full`)
- `install-plan.ts` + `install-apply.ts` with state tracking and diff preview
- Incremental update mechanism (`./install.sh --update /path/to/target`)
- Mac CI runner (GitHub Actions `macos-latest`) for cross-platform test coverage
- CI job that asserts `dist/` is in sync with `scripts/lib/` (drift detection)
- `install.ps1` full parity with `install.sh` (including `--dry-run`)
- Documentation of whatever outcome Q5 verification produced

**Sprint F (run) — DEFERRED**:

- Public repo OR public `kadmon-harness-dist` fork with sync GitHub Action
- `/plugin install kadmon-harness` as native entry point
- Auto-update notifications via `SessionStart` hook
- Multi-IDE support (Cursor, Codex, OpenCode) if ECC patterns translate
- Plugin marketplace submission (if appropriate for a private-infra-turned-public tool)

## Review date

**Revisit 2026-04-21** (one week post-decision), after Sprint D dogfood on Kadmon-Sports ships. Specifically review:

1. Did the hybrid plugin + install.sh work end-to-end on both Windows (Git Bash) and at least one Mac collaborator machine?
2. Did `KADMON_RUNTIME_ROOT` refactor preserve local-dev behavior without regressions?
3. Did `/plugin install` verification (Q5) resolve to outcome 1, 2, or 3?
4. Is the private-vs-public repo decision still correct, or has the dogfood success changed the cost/benefit?
5. Are there new 9th/10th/... angles that Sprint D dogfood revealed, analogous to the 8 angles that triggered this ADR in the first place?

If all four pass cleanly, promote to Sprint E. If any fail, open `ADR-011` and document the follow-up.
