---
number: 10
title: Harness Distribution via Hybrid Plugin + Bootstrap
date: 2026-04-14
status: pending
needs_tdd: true
route: A
adr: ADR-010-harness-distribution-hybrid.md
supersedes_partial: plan-003-harness-distribution.md
---

## Plan: Harness Distribution via Hybrid Plugin + Bootstrap [konstruct]

### Overview

Sprint D delivers the minimum viable distribution path for Kadmon Harness: a hybrid Claude Code plugin (`.claude-plugin/plugin.json` + `hooks.json`) that ships agents, commands, skills, and hooks natively, plus an `install.sh` / `install.ps1` bootstrap that fills the gaps the plugin system cannot cover (rules copy, `permissions.deny` merge, cross-platform hook command rewriting). The load-bearing engineering work is a refactor of five hook/shared files onto a new `KADMON_RUNTIME_ROOT` env var so lifecycle hooks can find compiled TypeScript at `${CLAUDE_PLUGIN_DATA}/dist/` instead of a hardcoded 3-level relative walk.

Everything else in the sprint is file-copy plumbing around that primitive. The plan sequences the refactor first (with a dedicated TDD gate) because the plugin cannot load its runtime if the primitive is wrong. Plan-010 supersedes plan-003 in mechanics (not in spirit), resolves Q1-Q5 per ADR-010, and closes with an end-to-end dogfood on `Kadmon-Sports` and a documented Q5 verification step for private-repo `/plugin install` on Windows.

### Current state (glob-based, never hardcoded)

- Agents: `.claude/agents/*.md` (16+ at planning time, may grow)
- Commands: `.claude/commands/*.md` (12+ at planning time, may grow)
- Skills: `.claude/skills/*.md` (46, stable)
- Rules: `.claude/rules/**/*.md` (19, stable)
- Hook scripts: `.claude/hooks/scripts/*.js` (29+, may grow)
- Tests: 627 passing across 60 files (baseline 2026-04-17, post plan-015 skavenger ULTIMATE; 7 DB tables including `research_reports`; `docs/research/` added as auto-write output dir)
- Runtime primitive: `ensure-dist.js:14 resolveRootDir()` — does a 3-level relative walk from hook's `import.meta.url`
- Lifecycle hooks that hardcode `new URL("../../../dist/scripts/lib/X.js", import.meta.url)`: 5 files (counted below in Phase 1)
- Distribution: none. No install entry point, no plugin manifest, no `.gitattributes`
- ADR reference: `docs/decisions/ADR-010-harness-distribution-hybrid.md` (accepted 2026-04-14)

### Assumptions

**Validated**:
- ADR-010 accepted (read at `docs/decisions/ADR-010-harness-distribution-hybrid.md`, 2026-04-14)
- Five hook files confirmed by Read of each: `ensure-dist.js`, `session-start.js` (imports at 77-84 and 155-160), `session-end-all.js` (imports at 46-50, 171-179, 265-270, 309-312), `pre-compact-save.js` (imports at 77-80), `evaluate-patterns-shared.js` (imports at 57-66)
- `settings.json` currently has 21 hook entries with hardcoded `PATH="$PATH:/c/Program Files/nodejs"` prefix
- `package.json` is ESM (`"type": "module"`) — all new `.ts` files use `.js` extension imports
- No existing pre-commit hook infrastructure — plan-010 installs husky (or equivalent) fresh
- plan-003 still exists at `docs/plans/plan-003-harness-distribution.md` and will be marked `superseded_by: plan-010`
- `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` are Claude Code native plugin vars (confirmed by Ralph Loop plugin pattern per ADR-010)
- Ralph Loop plugin in production demonstrates plugin hooks with `${CLAUDE_PLUGIN_ROOT}` work end-to-end

**Pending (confirmed during implementation)**:
- Q5 verification: does `/plugin install Kadmon7/kadmon-harness` work on a private repo when `gh auth` is configured? Answer recorded during Phase 8.
- ECC clone availability at `/tmp/research-clones/everything-claude-code/` — ADR-010 allows adapting concepts from reference material; if clone is unavailable, implementation reads ADR-010's inline examples instead. **Not a blocker.**
- Husky vs native Git hook: both work; plan-010 defaults to husky for discoverability but allows swap if the project already has a preference.

### Phase 0: Research (complete)

ADR-010 investigation is the research artifact. Plan-010 uses it as the single source of truth for Q1-Q5 and the architecture diagram. The parallel `/abra-kdabra` session that shipped plan-009 (deep-research) was independent and landed in the same window; plan-010 does not depend on plan-009 but must not clash with it on agent/command count assumptions — hence glob-based manifests throughout.

- [x] Read `docs/decisions/ADR-010-harness-distribution-hybrid.md`
- [x] Read `docs/decisions/ADR-003-harness-distribution.md` (for supersede context)
- [x] Read five hook files listed under "Files that must be refactored" in ADR-010
- [x] Read `.claude/settings.json` hook entries (21 confirmed)
- [x] Read `package.json` (ESM, no husky yet)
- [x] Read `docs/plans/plan-003-harness-distribution.md` (for supersede footer)

### Phase 1: KADMON_RUNTIME_ROOT primitive refactor (~6 hours)

**Load-bearing. Blocks every other phase. Ship with TDD gate before any plugin manifest work.**

- [ ] Step 1.1: Write failing test `tests/hooks/runtime-root.test.ts` (M)
  - File: `tests/hooks/runtime-root.test.ts` (NEW)
  - Cases (minimum 8):
    1. `resolveRootDir(metaUrl)` returns env var value when `KADMON_RUNTIME_ROOT` is set to an absolute path
    2. `resolveRootDir(metaUrl)` resolves env var to absolute (handles relative input via `path.resolve`)
    3. `resolveRootDir(metaUrl)` falls back to 3-level walk when env var unset (preserves current behavior)
    4. `resolveRootDir(metaUrl)` falls back to 3-level walk when env var is empty string
    5. `session-start.js` dynamic imports succeed when `KADMON_RUNTIME_ROOT` points at a fixture `${CLAUDE_PLUGIN_DATA}`-shaped directory with `dist/scripts/lib/state-store.js`
    6. `session-end-all.js` dynamic imports succeed under same fixture
    7. `pre-compact-save.js` dynamic import succeeds under same fixture
    8. `evaluate-patterns-shared.js` three dynamic imports succeed under same fixture
  - Fixture setup: `tests/fixtures/plugin-data-root/dist/scripts/lib/` with minimal stub modules exporting empty `openDb`, `startSession`, etc. (vitest `beforeEach` creates via `fs.mkdtempSync`, `afterEach` removes)
  - Verify: `npx vitest run tests/hooks/runtime-root.test.ts` — all 8 tests FAIL (red)
  - Depends on: none
  - Risk: Low — pure test scaffolding

- [ ] Step 1.2: Refactor `ensure-dist.js` `resolveRootDir` to consult env var (S)
  - File: `.claude/hooks/scripts/ensure-dist.js` line 13-15
  - Change: function body becomes the snippet from ADR-010 "Refactor target" block (env var first with `path.resolve`, fallback to existing `path.resolve(fileURLToPath(new URL(".", metaUrl)), "..", "..", "..")`)
  - Preserve: `isDistStale` and `ensureDist` unchanged (they take `rootDir` as argument; primitive refactor is isolated)
  - Verify: tests 1-4 pass, tests 5-8 still fail (they depend on Step 1.3+)
  - Depends on: 1.1
  - Risk: Low — 3-line change, central primitive, unit tests cover both paths

- [ ] Step 1.3: Refactor `session-start.js` dynamic imports (M)
  - File: `.claude/hooks/scripts/session-start.js`
  - Changes at lines 77-84 (state-store.js, session-manager.js) and 155-160 (instinct-manager.js):
    ```javascript
    import path from "node:path";
    import { pathToFileURL } from "node:url";
    // ... existing imports
    const rootDir = resolveRootDir(import.meta.url); // already computed at line 52
    const stateStoreUrl = pathToFileURL(
      path.join(rootDir, "dist", "scripts", "lib", "state-store.js"),
    ).href;
    const { openDb, getRecentSessions, /* ... */ } = await import(stateStoreUrl);
    ```
  - Reuse the `rootDir` variable already computed at line 52 for `ensureDist` — avoids double resolution
  - Add `path` and `pathToFileURL` to existing imports at top of file (`path` may already be imported; verify)
  - Verify: test 5 passes; `node .claude/hooks/scripts/session-start.js < test-input.json` still produces session-start output in local dev (env var unset path)
  - Depends on: 1.2
  - Risk: Medium — 3 dynamic imports to rewrite; pathToFileURL escaping on Windows is subtle (CLAUDE.md pitfall: "`new URL().pathname` encodes spaces as `%20`")

- [ ] Step 1.4: Refactor `session-end-all.js` dynamic imports (M)
  - File: `.claude/hooks/scripts/session-end-all.js`
  - Changes at lines 46-50 (cost-calculator.js), 171-179 (state-store.js, session-manager.js), 265-270 (cost-calculator.js), 309-312 (state-store.js again)
  - Same pattern as 1.3: reuse `rootDir` from line 147, build path via `path.join` + `pathToFileURL`
  - Note: the helper function `estimateTokensFromTranscript` at line 46 runs BEFORE `main()` computes rootDir, so it must call `resolveRootDir(import.meta.url)` itself or accept rootDir as a parameter. **Preferred: inline `resolveRootDir(import.meta.url)` at the top of `estimateTokensFromTranscript`** (cheap, idempotent, preserves function signature)
  - Verify: test 6 passes; `npx vitest run tests/hooks/session-end-all.test.ts` still green (existing coverage)
  - Depends on: 1.2
  - Risk: Medium — 5 imports, and the helper-function scope is a subtle trap

- [ ] Step 1.5: Refactor `pre-compact-save.js` dynamic import (S)
  - File: `.claude/hooks/scripts/pre-compact-save.js` line 77-80
  - Change: reuse `rootDir` from line 64, build state-store path via `path.join` + `pathToFileURL`
  - Verify: test 7 passes
  - Depends on: 1.2
  - Risk: Low — single import, smallest refactor

- [ ] Step 1.6: Refactor `evaluate-patterns-shared.js` dynamic imports (M)
  - File: `.claude/hooks/scripts/evaluate-patterns-shared.js` lines 57-66
  - Changes: state-store.js, instinct-manager.js, pattern-engine.js — three dynamic imports
  - Also line 68-69: `new URL("../pattern-definitions.json", import.meta.url)` — this is NOT under dist/, it's a sibling file in `.claude/hooks/pattern-definitions.json`. Under plugin layout, `pattern-definitions.json` ships with hooks (same `${CLAUDE_PLUGIN_ROOT}/.claude/hooks/` directory). Keep the relative URL; it's correct in both local-dev and plugin mode because `pattern-definitions.json` is co-located with the hook script, not under `dist/`. **Flag in code comment** so future maintainers don't "fix" it.
  - Compute `resolveRootDir(import.meta.url)` at top of `evaluateAndApplyPatterns` (inline, same pattern as session-end-all helper)
  - Verify: test 8 passes; all 8 runtime-root tests GREEN
  - Depends on: 1.2
  - Risk: Medium — 3 imports + a subtle "don't break me" relative path that co-ships

- [ ] Step 1.7: Full regression sweep after Phase 1 (S)
  - Files: no edits
  - Verify: `npx vitest run` — all 627 existing + 8 new tests pass (635 total minimum)
  - Verify: `npm run build` clean
  - Verify: Manual session roundtrip — start a fresh `claude` session in Kadmon-Harness, confirm session-start hook output is unchanged, session ends cleanly with `session-end-all` persisting to `~/.kadmon/kadmon.db`
  - Depends on: 1.3, 1.4, 1.5, 1.6
  - Risk: Medium — this is the "did we break local dev?" gate

**Phase 1 verification**: `npx vitest run tests/hooks/runtime-root.test.ts && npx vitest run` and a clean local-dev session roundtrip. If either fails, STOP — do not proceed to Phase 2.

### Phase 2: Plugin manifests (~4 hours)

Runs in parallel with Phase 3 (install-helpers.ts). Depends on Phase 1 semantic guarantees but does not touch the refactored code.

- [ ] Step 2.1: Write failing test `tests/plugin/manifest-schema.test.ts` (M)
  - File: `tests/plugin/manifest-schema.test.ts` (NEW)
  - Cases:
    1. `plugin.json` exists and parses as valid JSON
    2. `plugin.json` has required fields: `name`, `version`, `description`, `components`
    3. `plugin.json.components.agents` glob matches at least 15 files under `.claude/agents/*.md` (lower bound, not equal)
    4. `plugin.json.components.commands` glob matches at least 11 files
    5. `plugin.json.components.skills` glob matches at least 40 files
    6. Every `.claude/agents/*.md` file is discoverable by the agent glob (no agent orphaned)
    7. `hooks.json` parses and contains entries for `SessionStart`, `Stop`, `PreCompact` at minimum
    8. `hooks.json` commands contain the `${HOOK_CMD_PREFIX}` placeholder (verified via regex) — install.sh will rewrite this
    9. `hooks.json` command env blocks contain `KADMON_RUNTIME_ROOT: ${CLAUDE_PLUGIN_DATA}` for the three lifecycle hooks
  - Verify: `npx vitest run tests/plugin/manifest-schema.test.ts` — all cases FAIL (red)
  - Depends on: none
  - Risk: Low

- [ ] Step 2.2: Create `.claude-plugin/plugin.json` (S)
  - File: `.claude-plugin/plugin.json` (NEW)
  - Content: minimal v1.0.0 from ADR-010 "Plugin manifest structure" block with `version: "1.1.0"` (matches current harness version) and `components` globs for agents/commands/skills/hooks
  - Verify: tests 1-6 pass
  - Depends on: 2.1
  - Risk: Low

- [ ] Step 2.3: Create `scripts/generate-plugin-hooks.ts` (M)
  - File: `scripts/generate-plugin-hooks.ts` (NEW)
  - Purpose: build-time helper that reads `.claude/settings.json`, extracts the 21 hook entries, and emits `.claude-plugin/hooks.json` with `${HOOK_CMD_PREFIX}` placeholder and `${CLAUDE_PLUGIN_ROOT}` paths
  - Logic: for each matcher group (PreToolUse.Bash, PreToolUse.Edit|Write, PostToolUse.Edit|Write, etc.), emit a hooks.json entry with:
    - `name`: extracted from the script's filename
    - `command`: `${HOOK_CMD_PREFIX} ${CLAUDE_PLUGIN_ROOT}/.claude/hooks/scripts/<name>.js`
    - `env`: `{ KADMON_RUNTIME_ROOT: "${CLAUDE_PLUGIN_DATA}" }` (set on ALL hooks, not just lifecycle — harmless on non-lifecycle hooks, and it future-proofs if any hook adds a dynamic import later)
    - `matchers`: preserved from settings.json
  - Script is idempotent: running it twice produces byte-identical output
  - Verify: `npx tsx scripts/generate-plugin-hooks.ts` writes `.claude-plugin/hooks.json`; tests 7-9 pass
  - Depends on: 2.1, 2.2
  - Risk: Medium — settings.json has nested matcher structure that the generator must walk correctly; test exactness matters

- [ ] Step 2.4: Run generator and commit `hooks.json` (S)
  - File: `.claude-plugin/hooks.json` (NEW, generated)
  - Verify: `.claude-plugin/hooks.json` has entries for all 21 settings.json hooks, each with `${HOOK_CMD_PREFIX}` placeholder
  - Verify: `tests/plugin/manifest-schema.test.ts` all green
  - Depends on: 2.3
  - Risk: Low

- [ ] Step 2.5: Mini-dogfood — install plugin in Kadmon-Harness itself (S, ~30 min, MANUAL)
  - Purpose: verify Claude Code ACCEPTS the generated `hooks.json` before writing install.sh. Catches schema drift / field naming bugs 6h earlier than Phase 8 (late-failure insurance).
  - Steps:
    1. From another directory (not the harness repo), run `claude /plugin install /c/Command-Center/Kadmon-Harness` (local-path install to bypass private-repo Q5 gate). If `/plugin install` local-path syntax doesn't work, manually copy `.claude-plugin/` contents into `~/.claude/plugins/kadmon-harness-local/` per Claude Code docs.
    2. Restart Claude Code (new session).
    3. Verify: session-start banner appears normally (21 hooks fire, no "hooks.json schema rejected" errors in stderr).
    4. Verify: trigger 1 hook manually — edit a `.ts` file, confirm `post-edit-typecheck` hook runs (check session tmp dir for observation).
  - If any failure: STOP. Fix `generate-plugin-hooks.ts` BEFORE proceeding to Phase 3+.
  - Cleanup: uninstall the local plugin copy after verification.
  - Depends on: 2.4
  - Risk: Medium — this is deliberately early-binding to catch Claude Code acceptance issues cheaply.

**Phase 2 verification**: `npx vitest run tests/plugin/ && ls .claude-plugin/` + manual mini-dogfood per Step 2.5.

### Phase 3: install-helpers.ts pure library (~5 hours)

Runs in parallel with Phase 2. Pure TypeScript, testable in isolation before any shell script work.

- [ ] Step 3.1: Write failing test `tests/lib/install-helpers.test.ts` (M)
  - File: `tests/lib/install-helpers.test.ts` (NEW)
  - Cases (minimum 18):
    - `detectPlatform()`: returns `'win32' | 'darwin' | 'linux'` based on `process.platform` (mockable via spy)
    - `generateHookCommand('session-start.js', { platform: 'win32', usesGitBash: true })`: exact string `PATH="$PATH:/c/Program Files/nodejs" node ${CLAUDE_PLUGIN_ROOT}/.claude/hooks/scripts/session-start.js`
    - `generateHookCommand('session-start.js', { platform: 'win32', usesGitBash: false })`: `node ${CLAUDE_PLUGIN_ROOT}/.claude/hooks/scripts/session-start.js`
    - `generateHookCommand('session-start.js', { platform: 'darwin', usesGitBash: false })`: same as above (plain `node`)
    - `generateHookCommand('session-start.js', { platform: 'linux', usesGitBash: false })`: same
    - `mergePermissionsDeny([], [])`: empty output, 0 added, 0 deduped
    - `mergePermissionsDeny(['a', 'b'], [])`: output `['a', 'b']`, 2 added
    - `mergePermissionsDeny(['a'], ['b'])`: union `['a', 'b']`, 1 added, target 'b' preserved
    - `mergePermissionsDeny(['a', 'b'], ['a', 'c'])`: union `['a', 'b', 'c']`, 1 added, 1 deduped
    - `mergePermissionsDeny` preserves order: harness rules first, then target-only rules (predictable diff)
    - `mergeSettingsJson({ permissions: { deny: ['a'] } }, { hooks: {...}, permissions: { deny: ['b'] } })`: preserves target's `hooks`, merges `permissions.deny` to `['a', 'b']`, preserves any other top-level keys
    - `mergeSettingsJson` never touches `settings.local.json` (tested by asserting function only accepts `settings.json` path, not local)
    - `resolveTargetPaths('/tmp/fake-target')`: returns `{ rules: '/tmp/fake-target/.claude/rules', settings: '/tmp/fake-target/.claude/settings.json', settingsLocal: '/tmp/fake-target/.claude/settings.local.json' }`
    - `resolveTargetPaths` rejects empty/null cwd with a clear error
    - `generateHookCommand` throws on unknown platform (defensive)
    - Windows path separator: `generateHookCommand` output NEVER contains backslashes (plugin vars are always forward-slash)
  - Verify: `npx vitest run tests/lib/install-helpers.test.ts` — all FAIL (red)
  - Depends on: none
  - Risk: Low

- [ ] Step 3.2: Create `scripts/lib/install-helpers.ts` (M)
  - File: `scripts/lib/install-helpers.ts` (NEW)
  - Exports:
    - `detectPlatform(): 'win32' | 'darwin' | 'linux'` — reads `process.platform`, maps unknown to error
    - `generateHookCommand(scriptName: string, opts: { platform: NodeJS.Platform; usesGitBash: boolean }): string` — the ADR-010 pseudocode function
    - `mergePermissionsDeny(harness: readonly string[], target: readonly string[]): { merged: string[]; added: string[]; dedupedCount: number }` — union with stable order
    - `mergeSettingsJson(harness: Record<string, unknown>, target: Record<string, unknown>, options?: { forceDenySync?: boolean }): Record<string, unknown>` — deep merge only `permissions.deny`, preserve all other keys
    - `resolveTargetPaths(cwd: string): { rules: string; settings: string; settingsLocal: string }` — path construction + validation
  - All inputs validated with Zod where they cross the boundary from shell args or JSON parsing
  - All exported functions have explicit return types (per `rules/typescript/coding-style.md`)
  - No `any`, no non-null assertions without justification
  - Immutable: never mutates inputs; always returns new objects/arrays
  - Verify: `npx vitest run tests/lib/install-helpers.test.ts` — all GREEN
  - Depends on: 3.1
  - Risk: Medium — 5 exports, each with edge cases

- [ ] Step 3.3: Create `scripts/lib/install-manifest.ts` (S)
  - File: `scripts/lib/install-manifest.ts` (NEW)
  - Exports:
    - `COPY_MANIFEST`: the exact glob-based object from ADR-010 "Glob-based copy manifest" block
    - `CANONICAL_DENY_RULES`: extracted from current `.claude/settings.json` `permissions.deny` array (copy as `as const`)
  - Verify: `npx tsx -e "import('./scripts/lib/install-manifest.js').then(m => console.log(m.COPY_MANIFEST))"` — prints the manifest object (or use a test harness since `-e` is broken on Windows per CLAUDE.md pitfall; prefer a temp script)
  - Verify: small test `tests/lib/install-manifest.test.ts` asserts `CANONICAL_DENY_RULES` is non-empty and every entry is a string
  - Depends on: none
  - Risk: Low

**Phase 3 verification**: `npx vitest run tests/lib/install-helpers.test.ts tests/lib/install-manifest.test.ts`.

### Phase 4: install.sh bash bootstrap (~6 hours)

Depends on Phase 2 (manifests) + Phase 3 (helpers) + **plan-019 (canonical root symlinks)**. This is where the shell scripting risk lives.

> **Scope update 2026-04-20 (plan-019)**: install.sh does NOT copy agents/skills/commands — those ship via the plugin (ADR-019 Ruta Y, symlinks at plugin root). install.sh handles ONLY: rules copy, permissions.deny merge, `.gitignore`, `.kadmon-version`, HOOK_CMD_PREFIX rewrite in target's plugin hooks.json.
>
> **NEW requirement from plan-019 Phase B dogfood**: install.sh MUST also write `extraKnownMarketplaces` + `enabledPlugins` entries into target user's `~/.claude/settings.json` (user scope, not project scope) so the plugin is registered + enabled automatically. This replaces the non-existent `/plugin install <path>` syntax we originally planned. See `memory/project_plan_010_dogfood_findings.md` for workflow evidence.

- [ ] Step 4.1: Write failing integration test `tests/install/install-sh.test.ts` (L)
  - File: `tests/install/install-sh.test.ts` (NEW)
  - Strategy: use `fs.mkdtempSync` to create a simulated Python target (no `package.json`, empty `.claude/`), invoke `install.sh` via `execFileSync`, assert filesystem state after
  - Cases (minimum 10):
    1. `install.sh --dry-run /tmp/fake-target` prints file diff without touching filesystem
    2. `install.sh /tmp/fake-target` creates `/tmp/fake-target/.claude/rules/` with all `rules/**/*.md` files copied
    3. `install.sh /tmp/fake-target` creates `/tmp/fake-target/.claude/settings.json` with `permissions.deny` merged from `CANONICAL_DENY_RULES`
    4. `install.sh /tmp/fake-target` preserves target's existing `.claude/settings.json` keys (hooks block, mcpServers block) when merging
    5. `install.sh /tmp/fake-target` creates `/tmp/fake-target/.claude/settings.local.json` template only if it does not exist
    6. `install.sh /tmp/fake-target` NEVER overwrites an existing `settings.local.json` (test by pre-creating one with sentinel content)
    7. `install.sh /tmp/fake-target` writes `/tmp/fake-target/.kadmon-version` with current plugin version
    8. `install.sh --force-permissions-sync /tmp/fake-target` re-merges even when settings.json already has the harness rules
    9. `install.sh /tmp/fake-target` appends to target's `.gitignore` the entries for `.claude/settings.local.json`, `.claude/agent-memory/`, `dist/`, dedup against existing content
    10. `install.sh` rewrites `${HOOK_CMD_PREFIX}` in the plugin's runtime `hooks.json` based on `uname` detection (Git Bash emits PATH prefix, Mac/Linux emits plain `node`)
    11. `install.sh /tmp/fake-target-with spaces/nested` (target path contains literal space) completes without corruption — settings.json merge, rules copy, and hooks.json rewrite all produce valid paths. Protects Abraham-on-Windows scenario where user paths may live under `Documents\` or `OneDrive\` with embedded spaces.
  - Skip condition: if `bash` is not available on the test host, skip with a clear message (Mac/Linux/Git Bash will run it; native PowerShell will skip and rely on Phase 5 test)
  - Verify: all FAIL (red, no `install.sh` exists yet)
  - Depends on: 3.2, 3.3
  - Risk: Medium — integration tests with real filesystem and real shell invocation are fragile on Windows

- [ ] Step 4.2: Create `install.sh` (L)
  - File: `install.sh` (NEW, at repo root)
  - Shebang: `#!/usr/bin/env bash`
  - Strict mode: `set -euo pipefail`
  - Flow (from ADR-010 install.sh flow block):
    1. Parse args: `--force`, `--force-permissions-sync`, `--dry-run`, `--dev`, positional `<target-path>`
    2. Validate target: exists, writable, not the harness repo itself (compare realpath)
    3. Detect OS via `uname -s`: `Linux` / `Darwin` / `MINGW*|MSYS*|CYGWIN*` (Git Bash on Windows)
    4. Compute `HOOK_CMD_PREFIX`: Git Bash -> `PATH="$PATH:/c/Program Files/nodejs" node`, others -> `node`
    5. Node version check: `node --version` >= v20 (fail loudly if missing)
    6. Copy `.claude/rules/**` to `<target>/.claude/rules/` using `rsync -a --delete-after` (Mac/Linux) or `cp -r` (Git Bash fallback)
    7. Call a small Node helper `scripts/lib/install-apply.ts` (new, ~80 lines) via `npx tsx` to run the `mergeSettingsJson` + `mergePermissionsDeny` logic from Phase 3 — keeps merge logic in TypeScript (tested) rather than bash (untestable)
    8. Write `settings.local.json` template if missing
    9. Append `.gitignore` entries (dedup)
    10. Write `.kadmon-version` with `jq -r .version .claude-plugin/plugin.json` (or fallback to a sed extract if jq absent)
    11. Rewrite `${HOOK_CMD_PREFIX}` placeholder in target's plugin `hooks.json` via `sed` with proper escaping (use `|` delimiter since paths contain `/`)
    12. `--dry-run`: print every planned operation to stdout with a `[DRY RUN]` prefix, do NOT execute any writes
    13. `--dev`: install husky pre-commit hook in the harness repo (calls `npm run prepare` after installing husky as devDep)
    14. Print post-install checklist from ADR-010
  - Exit codes: 0 success, 1 validation failure, 2 copy failure, 3 merge failure
  - Verify: tests 1-10 from Step 4.1 pass on a Linux/Mac/Git Bash host
  - Depends on: 4.1
  - Risk: High — shell scripting on Windows is the #1 failure mode; rsync may not exist in Git Bash (fallback to cp -r); jq may not exist (fallback to sed; or require it in the prereq check)

- [ ] Step 4.3: Create `scripts/lib/install-apply.ts` helper (M)
  - File: `scripts/lib/install-apply.ts` (NEW)
  - Purpose: CLI entry point invoked by `install.sh` to perform the TypeScript-backed merge operations (settings.json merge, permissions.deny merge). Keeps shell script thin.
  - Args (Zod-validated): `--target <path>` (required), `--force-permissions-sync` (optional)
  - Behavior: reads `<target>/.claude/settings.json` (or `{}`), reads `CANONICAL_DENY_RULES` from `install-manifest.ts`, calls `mergeSettingsJson` + `mergePermissionsDeny`, writes back
  - Never touches `settings.local.json`
  - Prints JSON summary to stdout: `{ merged: N, added: M, dedupedCount: K }` for install.sh to log
  - Verify: `tests/lib/install-apply.test.ts` with 4 cases (fresh install, re-install dedup, force sync, target has unrelated keys)
  - Depends on: 3.2, 3.3
  - Risk: Low — thin wrapper over tested helpers

- [ ] Step 4.4: Phase 4 regression sweep (S)
  - Verify: `npx vitest run` — full suite still green (target ~660+ tests at Phase 4 boundary)
  - Verify: Manual `./install.sh --dry-run /tmp/dry-target` on Git Bash, confirm output looks sensible
  - Depends on: 4.2, 4.3
  - Risk: Low

**Phase 4 verification**: `./install.sh --dry-run /tmp/fake-target && npx vitest run tests/install/`.

### Phase 5: install.ps1 native PowerShell bootstrap (~3 hours)

Depends on Phase 3 (helpers) only. Sprint D version is intentionally thinner than install.sh.

- [ ] Step 5.1: Write failing test `tests/install/install-ps1.test.ts` (M)
  - File: `tests/install/install-ps1.test.ts` (NEW)
  - Strategy: test `install.ps1` by parsing its content and asserting structural invariants, plus (where PowerShell is available) execute it against a temp target. Invocation test is skipped if `powershell.exe` / `pwsh` is not on PATH.
  - Cases (minimum 8):
    1. File exists and starts with a valid PowerShell header (CmdletBinding or param block)
    2. File declares `param($TargetPath, $DryRun, $ForcePermissionsSync)` (no `--dev` flag in Sprint D)
    3. File invokes `scripts/lib/install-apply.ts` via `npx tsx` (same helper as install.sh — DRY across shells)
    4. File uses `Copy-Item -Recurse` for rules copy (not rsync)
    5. File checks Node version >= 20 before proceeding
    6. File writes `.kadmon-version` at target
    7. File handles `-ForcePermissionsSync` by passing `--force-permissions-sync` to install-apply.ts
    8. Execution test (skipped if PowerShell missing): `install.ps1 -TargetPath <tmp>` creates the same files as install.sh does
  - Verify: all FAIL
  - Depends on: 3.2, 3.3
  - Risk: Low

- [ ] Step 5.2: Create `install.ps1` (M)
  - File: `install.ps1` (NEW, at repo root)
  - Content: PowerShell equivalent of install.sh steps 1-7 (no `--dev`, no `--dry-run` in Sprint D — ADR-010 defers these to Sprint E)
  - Key differences from install.sh:
    - `Copy-Item -Recurse -Force` instead of rsync
    - `$env:PATH` inspection for Node via `Get-Command node`
    - No sed — uses `(Get-Content hooks.json) -replace '\$\{HOOK_CMD_PREFIX\}', 'node' | Set-Content hooks.json`
    - Native PowerShell ALWAYS emits plain `node` (no Git Bash detection needed; if user wants Git Bash behavior they should run install.sh)
    - Delegates merge to same `scripts/lib/install-apply.ts` via `npx tsx` — zero logic duplication
  - Verify: tests from Step 5.1 pass
  - Depends on: 5.1
  - Risk: Medium — PowerShell quoting differs from bash; less opportunity to dogfood if no Windows-native test host

**Phase 5 verification**: `npx vitest run tests/install/install-ps1.test.ts` (execution test may be skipped on non-Windows).

### Phase 6: Pre-commit hook + `.gitattributes` (~2 hours)

Can run any time after Phase 1. Doesn't depend on Phase 4/5.

- [ ] Step 6.1: Write failing test `tests/build/pre-commit-hook.test.ts` (S)
  - File: `tests/build/pre-commit-hook.test.ts` (NEW)
  - Cases:
    1. `.husky/pre-commit` exists (or equivalent) and is executable
    2. Pre-commit hook script invokes `npm run build` when any staged file matches `scripts/lib/**/*.ts`
    3. Pre-commit hook stages the resulting `dist/scripts/lib/**/*.js` via `git add` after successful build
    4. Pre-commit hook exits non-zero if `tsc` fails
    5. `.gitattributes` exists at repo root
    6. `.gitattributes` contains `*.js text eol=lf`
    7. `.gitattributes` contains `*.ts text eol=lf`
    8. `.gitattributes` contains `*.sh text eol=lf`
  - Verify: all FAIL (red)
  - Depends on: none
  - Risk: Low

- [ ] Step 6.2: Install husky and write pre-commit hook (M)
  - File: `package.json` (MODIFIED: add `"husky": "9.1.7"` — EXACT pin, no caret — to devDeps, add `"prepare": "husky"` script. Rationale: harness distributed to N projects; `^9.x` allows divergence between collaborators' husky minors. Pin exact, bump deliberately in Sprint E if needed.)
  - File: `.husky/pre-commit` (NEW)
  - File: `.husky/lib/run-tsc-if-lib-changed.sh` (NEW, extracted for testability)
  - Behavior:
    ```bash
    #!/usr/bin/env bash
    set -euo pipefail
    staged_ts=$(git diff --cached --name-only --diff-filter=ACM | grep -E '^scripts/lib/.*\.ts$' || true)
    if [ -n "$staged_ts" ]; then
      npm run build
      git add dist/scripts/lib
    fi
    ```
  - Verify: tests 1-4 pass
  - Depends on: 6.1
  - Risk: Medium — husky setup in an ESM project can hit `prepare` script ordering issues on fresh clones

- [ ] Step 6.3: Create `.gitattributes` (S)
  - File: `.gitattributes` (NEW)
  - Content:
    ```
    *.js text eol=lf
    *.ts text eol=lf
    *.sh text eol=lf
    *.md text eol=lf
    *.json text eol=lf
    dist/scripts/lib/*.js text eol=lf
    ```
  - Verify: tests 5-8 pass
  - Depends on: none (can run in parallel with 6.2)
  - Risk: Low

- [ ] Step 6.4: Cold-clone pre-commit hook verification (S, ~5 min)
  - Purpose: catch the "works on my machine" case for Joe/Eden/Abraham on fresh clones. Husky `prepare` script in ESM projects can fail silently if npm lifecycle ordering is wrong.
  - Test file: `tests/build/cold-clone.test.ts` (NEW, 2 cases):
    1. Simulated cold clone: create `fs.mkdtempSync` copy of harness repo minus `node_modules/` and `.husky/_/`, run `npm install` via `execFileSync`, assert `.husky/pre-commit` exists and is executable (`fs.accessSync(path, fs.constants.X_OK)`).
    2. Assert `package.json` has `husky` pinned to exact version (no caret/tilde) — defense against future accidental loosening.
  - Skip condition: if network is unavailable (CI offline runs), skip with clear message. npm install needs registry access.
  - Verify: all FAIL (red) before 6.2 lands; GREEN after 6.2 + 6.3.
  - Depends on: 6.2, 6.3
  - Risk: Medium — network-dependent test; quarantine to a separate vitest project if flaky, but start inline.

**Phase 6 verification**: `npx vitest run tests/build/ && git check-attr -a install.sh`.

### Phase 7: Documentation + supersede chain (~2 hours)

All docs-only. No TDD. Runs after code phases land.

- [ ] Step 7.1: Update plan-003 frontmatter with supersede (S)
  - File: `docs/plans/plan-003-harness-distribution.md`
  - Change: frontmatter `status: pending` -> `status: superseded`; add `superseded_by: plan-010-harness-distribution-hybrid.md`
  - Add supersede note at top of body explaining the 8 angles from ADR-010 that triggered the pivot
  - Verify: manual read; `grep -l "superseded_by: plan-010" docs/plans/plan-003-harness-distribution.md`
  - Depends on: Phase 1-6 complete
  - Risk: Low

- [ ] Step 7.2: Update ADR-003 frontmatter with partial supersede (S)
  - File: `docs/decisions/ADR-003-harness-distribution.md`
  - Change: `status: accepted` -> `status: superseded_partial`; add `superseded_by: ADR-010-harness-distribution-hybrid.md`
  - Add supersede note explaining which decisions survived (Option A copy-based spirit) and which were replaced (mechanics)
  - Verify: manual read
  - Depends on: 7.1
  - Risk: Low

- [ ] Step 7.3: Add README.md INSTALL section (M)
  - File: `README.md` (MODIFIED — append new section)
  - Content:
    - Prereq: Node >= 20, `gh` CLI, git
    - Step-by-step for Mac/Linux: `gh auth login` -> `gh repo clone Kadmon7/kadmon-harness` -> `./install.sh /path/to/target` -> `cd target && claude`
    - Step-by-step for Windows (native PowerShell): `gh auth login` -> `gh repo clone Kadmon7/kadmon-harness` -> `.\install.ps1 -TargetPath C:\path\to\target` -> `cd C:\path\to\target; claude`
    - Step-by-step for Windows (Git Bash): use install.sh path
    - Post-install checklist: verify 21 hooks fire, create personal `settings.local.json`, first `/chekpoint` run
    - Q5 NOTE: "Native `/plugin install` is NOT YET supported because the repo is private. Sprint D verifies whether `gh auth` + `/plugin install` works on Windows; result documented in `docs/diagnostics/2026-04-DD-plugin-install-private-repo.md`."
  - Verify: manual read; no TDD
  - Depends on: 7.1
  - Risk: Low

- [ ] Step 7.4: Update CLAUDE.md (S)
  - File: `CLAUDE.md` (MODIFIED)
  - Changes:
    - Add new "Distribution" section near "Common Pitfalls" describing the hybrid plugin + install.sh model
    - Add `KADMON_RUNTIME_ROOT` to the "Environment Variables" list with description: "Absolute path to directory containing `dist/scripts/lib/*.js`. Set by plugin's `hooks.json` for plugin-installed hooks; unset for local dev (falls back to 3-level relative walk)"
    - Confirm `KADMON_RESEARCH_AUTOWRITE` (ADR-015) is already in the env var list. If missing from the post-plan-015 CLAUDE.md refresh, add it with description: "Set to `off` to skip `/research` auto-write of reports to `docs/research/`. Plugin consumers (ToratNetz/KAIRON) may override locally."
    - Bump status line to reference plan-010 shipped (left as a follow-up commit after Phase 8 succeeds — the status line update happens in Phase 8 verification, not here)
  - Verify: `grep -c KADMON_RUNTIME_ROOT CLAUDE.md` >= 1
  - Depends on: none in this phase
  - Risk: Low

**Phase 7 verification**: `grep -l "superseded_by: plan-010" docs/plans/plan-003-harness-distribution.md docs/decisions/ADR-003-harness-distribution.md` and visual review of README + CLAUDE.md additions.

### Phase 8: End-to-end dogfood on Kadmon-Sports + Q5 verification (~4 hours, manual)

Final gate. MANUAL. No automated test — this is the "does it actually work in the wild" verification.

- [ ] Step 8.1: Dry run against Kadmon-Sports (S)
  - Command: `cd /c/Command-Center/Kadmon-Harness && ./install.sh --dry-run /c/Command-Center/Kadmon-Sports`
  - Verify: output enumerates rules files to copy, settings.json merge plan, hooks.json rewrite, gitignore additions
  - Verify: no actual filesystem changes in Kadmon-Sports (confirm via `git status` in Kadmon-Sports)
  - Risk: Medium — first real target exercise, expect surprises

- [ ] Step 8.2: Real install against Kadmon-Sports (M)
  - Command: `./install.sh /c/Command-Center/Kadmon-Sports`
  - Verify:
    - `/c/Command-Center/Kadmon-Sports/.claude/rules/` contains all expected rules
    - `/c/Command-Center/Kadmon-Sports/.claude/settings.json` has `permissions.deny` merged with harness canonical rules AND any Kadmon-Sports-specific pre-existing rules
    - `/c/Command-Center/Kadmon-Sports/.claude/settings.local.json` template created (or preserved if pre-existed)
    - `/c/Command-Center/Kadmon-Sports/.kadmon-version` matches plugin.json version
    - Kadmon-Sports `.gitignore` updated with agent-memory/dist/settings.local.json entries (dedup)
  - Risk: Medium

- [ ] Step 8.3: First Claude session in Kadmon-Sports (M)
  - Command: `cd /c/Command-Center/Kadmon-Sports && claude` (manual session)
  - Verify:
    - session-start hook fires without errors (check session banner for "Kadmon Session Started")
    - 21 hooks activate (observe-pre logs entries to `~/.kadmon/...` or session tmp dir)
    - `KADMON_RUNTIME_ROOT` is populated to `${CLAUDE_PLUGIN_DATA}` (check via `echo $KADMON_RUNTIME_ROOT` from a Bash tool call inside the session)
    - Dynamic imports succeed — no "dist/ missing" or "module not found" errors in session-start output
  - Risk: High — this is where the runtime primitive refactor gets its real-world test

- [ ] Step 8.4: /forge + /evolve round-trip (M)
  - In the Kadmon-Sports claude session, run `/forge` (observes session, writes ClusterReport)
  - Verify: `ls ~/.kadmon/forge-reports/` shows a new cluster report with a `projectHash` matching Kadmon-Sports (not Kadmon-Harness)
  - Run `/evolve` (step 6 Generate, EXPERIMENTAL through 2026-04-28)
  - Verify: /evolve reads the cluster report, proposes artifacts targeted at Kadmon-Sports paths (not Kadmon-Harness), preview gate shows Kadmon-Sports-specific proposals
  - Risk: High — cross-project isolation + ClusterReport pipeline must work through the new runtime root

- [ ] Step 8.5: Cross-project isolation verification (S)
  - Command: `sqlite3 ~/.kadmon/kadmon.db "SELECT DISTINCT project_hash, COUNT(*) FROM sessions GROUP BY project_hash"` (or use `npx tsx scripts/dashboard.ts`)
  - Verify: At least 2 distinct `project_hash` values — one for Kadmon-Harness, one for Kadmon-Sports
  - Verify: No schema regressions (run `npm run db-health-check` or equivalent)
  - Risk: Low

- [ ] Step 8.6: Q5 verification — attempt `/plugin install` on private repo (M)
  - Setup: target machine should be Windows (to exercise PowerShell path); target person should be Abraham per ADR-010 Q5
  - **Mac coordination (2026-04-17 update)**: coordinate with Joe and/or Eden for a 30-min Mac dogfood slot during Phase 8 window. Mac validation is Sprint D scope, not deferred. If both are unavailable during the 4-5 day Sprint D window, fall back to explicit "Mac untested in Sprint D, revalidate Sprint E" note in README + docs/diagnostics.
  - If Abraham is unavailable during Sprint D, user performs the verification themselves on their Windows host
  - Action: with `gh auth login` already configured, attempt `/plugin install Kadmon7/kadmon-harness` from a fresh Claude Code session
  - Record outcome in `docs/diagnostics/2026-04-DD-plugin-install-private-repo.md` (NEW) with: date, host, `gh auth status` output (redact token), full Claude Code response, screenshot if helpful
  - Outcomes (per ADR-010 Q5):
    1. Works -> document the incantation, add Sprint E task to promote `/plugin install` as primary entry point
    2. Fails -> confirm manual `git clone + install.sh` is Sprint D's only path, flag Sprint F revisit
    3. Works with specific token scope -> document the scope in README INSTALL section
  - Verify: diagnostics file exists and has a clear outcome statement
  - Risk: Low (outcome is information, not a gate)

- [ ] Step 8.7: /chekpoint full tier on all changes (S)
  - Run `/chekpoint` full tier covering every Sprint D commit
  - Verify: full reviewer matrix (ts-reviewer + spektr + orakle + kody) passes, no BLOCK findings
  - Update status line in CLAUDE.md to reference plan-010 shipped
  - Commit with `Reviewed: full` footer
  - Risk: Low

**Phase 8 verification**: All manual checkboxes above + a written dogfood summary appended to `docs/diagnostics/2026-04-DD-sprint-d-dogfood.md` recording what worked and what surprised you.

### Testing Strategy

**New test count**: ~73-83 tests across 7 new files (baseline refreshed 2026-04-17).

| Phase | Test file | Count | Coverage |
|---|---|---|---|
| 1 | `tests/hooks/runtime-root.test.ts` | 8+ | env var path, fallback path, all 5 refactored files |
| 2 | `tests/plugin/manifest-schema.test.ts` | 9+ | plugin.json structure, hooks.json structure, glob lower-bound |
| 3 | `tests/lib/install-helpers.test.ts` | 18+ | detectPlatform, generateHookCommand (all platforms), mergePermissionsDeny, mergeSettingsJson, resolveTargetPaths |
| 3 | `tests/lib/install-manifest.test.ts` | 3+ | COPY_MANIFEST structure, CANONICAL_DENY_RULES non-empty |
| 4 | `tests/install/install-sh.test.ts` | 11+ | dry-run, rules copy, settings merge, gitignore, hook command rewrite, version file, target paths with spaces |
| 4 | `tests/lib/install-apply.test.ts` | 4+ | fresh install, dedup, force sync, unrelated keys preserved |
| 5 | `tests/install/install-ps1.test.ts` | 8+ | content invariants + (optional) execution test |
| 6 | `tests/build/pre-commit-hook.test.ts` | 8+ | husky hook structure, tsc trigger, stage behavior, .gitattributes |
| 6 | `tests/build/cold-clone.test.ts` | 2+ | fresh-clone husky install, exact version pin (defense against future loosening) |

**Target**: 627 (baseline 2026-04-17) + ~73 new = ~700 tests minimum.

**Manual-only verification** (no automated test):
- Phase 8 end-to-end dogfood on Kadmon-Sports
- Q5 `/plugin install` private-repo verification on Windows
- Mac collaborator smoke test (deferred to Sprint E if no Mac available in Sprint D)

**Integration testing discipline**:
- `install-helpers.ts` tested with real data, not mocks (per `rules/common/testing.md`)
- `install.sh` tested with `fs.mkdtempSync` temp directories and real file I/O
- SQLite tests use `:memory:` (per existing convention)

### Implementation Notes

**Patterns to follow**:
- All new `.ts` files: explicit return types on exports, `node:` prefix on builtins, `.js` extension on local imports (Node16 ESM resolution)
- `main()` pattern in new scripts: `async function main() { ... } main().catch(err => { console.error(err); process.exit(1); })`
- Zod validation at every boundary where shell args or JSON parsing enters TypeScript
- Immutable data: `mergePermissionsDeny` and `mergeSettingsJson` NEVER mutate inputs; always return new objects
- Testing: arrange-act-assert, `afterEach` cleanup, `mkdtempSync` for temp dirs

**Pitfalls to avoid** (from CLAUDE.md and ADR-010):
- `new URL().pathname` encodes spaces as `%20` — always use `fileURLToPath()` or `pathToFileURL()` for file paths
- `npx tsx -e` produces no output on Windows — use temp script files or proper test runners
- `ensure-dist.js` fallback path MUST still work for local dev after refactor — if `KADMON_RUNTIME_ROOT` is ever set to an empty string in the local env, the fallback must kick in (hence the `envRoot.length > 0` guard in ADR-010 pseudocode)
- CRLF corruption on Windows — `.gitattributes` is mandatory, not optional
- `session-end-all.js` has a helper function (`estimateTokensFromTranscript`) that runs BEFORE `main()` computes rootDir — inline `resolveRootDir(import.meta.url)` inside the helper
- `evaluate-patterns-shared.js` imports `pattern-definitions.json` via a RELATIVE URL that is co-located with the hook script (NOT under dist/) — leave that relative URL alone, add a code comment explaining why
- `settings.json` `hooks` block has nested matcher structure — the `generate-plugin-hooks.ts` walker must handle `PreToolUse.Bash`, `PreToolUse.Edit|Write`, etc. correctly
- `install.sh` on Git Bash: rsync may be absent — fall back to `cp -r`; `jq` may be absent — fall back to sed-based version extraction OR require it in the prereq check (pick one, document)
- PowerShell `install.ps1` string interpolation differs from bash — test with literal `${CLAUDE_PLUGIN_ROOT}` to avoid accidental variable expansion
- `mergeSettingsJson` must NEVER touch `.claude/settings.local.json` (per ADR-010 Q4 final rule)
- The canonical committed `hooks.json` has `${HOOK_CMD_PREFIX}` as a literal string — do NOT pre-expand it; install.sh/install.ps1 does that at install time

**Do NOT do**:
- Do not hardcode agent/command counts anywhere in code or tests — glob patterns only (ADR-010 Implementation Notes)
- Do not mutate inputs in any install-helper function
- Do not pre-expand `${CLAUDE_PLUGIN_ROOT}` in the committed `hooks.json` — that's the plugin loader's job
- Do not make `install.sh` run `tsc` — Q1 decision is committed `dist/`
- Do not merge `package.json` into targets — runtime deps live in `${CLAUDE_PLUGIN_DATA}`
- Do not create symlinks for rules — Q3 decision is copy-based
- Do not invoke agents (feniks, kody, spektr) from within plan-010; `/abra-kdabra` orchestrates them after the approval gate

### Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `KADMON_RUNTIME_ROOT` refactor breaks local dev session-start | Medium | High | Phase 1.7 full regression + manual local session roundtrip BEFORE proceeding to Phase 2; fallback path preserves exact current behavior when env var unset |
| `pathToFileURL` escaping differs on Windows vs Mac/Linux | Medium | Medium | Use `pathToFileURL()` (not manual `file://` string concatenation); test from Windows Git Bash in Phase 1 |
| install.sh fails on Git Bash because rsync/jq missing | High | Medium | Detect in prereq check; fall back to `cp -r` and sed-based JSON extract; document required tools in README INSTALL section |
| install.ps1 quoting differs from bash, corrupts hooks.json rewrite | Medium | Medium | Phase 5.1 test parses content with regex; Phase 5 execution test on real Windows host (manual if no CI runner) |
| Husky pre-commit hook not installed on fresh clone, ships stale dist/ | Medium | High | Document `./install.sh --dev` as mandatory for new harness developers; Sprint E adds CI drift check as safety net |
| Kadmon-Sports dogfood reveals a 9th angle missed by ADR-010 | Medium | High | Phase 8.3 + 8.4 are GATES — if any fail, STOP and open follow-up ADR-011; do not paper over with emergency patches |
| Q5 `/plugin install` on private repo fails silently on Windows | Low | Low | Outcome is informational; fallback is manual `git clone + install.sh`, already the Sprint D primary path |
| Parallel /abra-kdabra sessions landed agents/commands during planning | Medium | Low | All globs in manifest + tests use lower-bound assertions (`>= 15` not `== 16`), per ADR-010 Implementation Notes |
| `generate-plugin-hooks.ts` produces a hooks.json that Claude Code rejects due to schema drift | Low | High | Test 2.1 asserts hooks.json parses and has minimum structure; Ralph Loop's working hooks.json is the reference schema |
| Installing husky touches `package.json` in a way that breaks existing `npm run build` | Low | Medium | Test in a fresh branch first; `prepare` script addition is isolated and well-documented |
| Target's existing `settings.json` has keys `mergeSettingsJson` doesn't anticipate | Medium | Low | Test 3.1 case 11 covers "preserves unrelated top-level keys"; spec is "only touch permissions.deny, preserve everything else" |

### Success Criteria

- [ ] All tests pass (`npx vitest run` — target 700+ tests, up from 627)
- [ ] `npm run build` clean (`npx tsc --noEmit` zero errors)
- [ ] `./install.sh --dry-run /tmp/target` prints diff without modifying filesystem
- [ ] `./install.sh /tmp/target` on Mac/Linux/Git Bash produces complete target layout
- [ ] `./install.ps1 -TargetPath C:\tmp\target` on native Windows produces complete target layout
- [ ] `tests/lib/install-helpers.test.ts`: `generateHookCommand` emits correct strings for all 4 platform x shell combinations
- [ ] `tests/hooks/runtime-root.test.ts`: env var wins, fallback preserves local-dev behavior
- [ ] `.claude-plugin/plugin.json` and `.claude-plugin/hooks.json` exist and validate against expected schema
- [ ] `.gitattributes` enforces LF on `*.js`, `*.ts`, `*.sh`, `*.md`, `*.json`
- [ ] Husky pre-commit hook installed and auto-rebuilds `dist/` on staged `scripts/lib/**/*.ts` changes
- [ ] plan-003 status updated to `superseded` with `superseded_by: plan-010`
- [ ] ADR-003 status updated to `superseded_partial` with `superseded_by: ADR-010`
- [ ] README.md has an "INSTALL" section with Mac/Linux/Windows instructions
- [ ] CLAUDE.md lists `KADMON_RUNTIME_ROOT` in Environment Variables
- [ ] End-to-end Kadmon-Sports dogfood succeeds: session starts, 21 hooks fire, `/forge` writes cluster report with Kadmon-Sports projectHash, `/evolve` reads report and proposes Kadmon-Sports artifacts
- [ ] `~/.kadmon/kadmon.db` shows distinct project_hash rows for Kadmon-Harness and Kadmon-Sports (cross-project isolation preserved)
- [ ] db-health-check reports 0 anomalies
- [ ] Q5 verification documented in `docs/diagnostics/2026-04-DD-plugin-install-private-repo.md` with a clear outcome (works / fails / works-with-incantation)
- [ ] Sprint D dogfood summary recorded in `docs/diagnostics/2026-04-DD-sprint-d-dogfood.md`
- [ ] `/chekpoint` full tier passes across all Sprint D commits with `Reviewed: full` footer

### Time estimate (4-5 days)

| Phase | Hours | Day |
|---|---|---|
| 1: KADMON_RUNTIME_ROOT refactor + TDD | ~6 | Day 1 |
| 2: Plugin manifests + mini-dogfood (Step 2.5) | ~4.5 | Day 2 AM (parallel with 3) |
| 3: install-helpers.ts library | ~5 | Day 2 AM/PM (parallel with 2) |
| 4: install.sh bash bootstrap (+ Windows spaces test) | ~6 | Day 2 PM + Day 3 AM |
| 5: install.ps1 PowerShell bootstrap | ~3 | Day 3 PM |
| 6: Pre-commit hook + .gitattributes + cold-clone test | ~2.25 | Day 3 PM (parallel with 5) |
| 7: Documentation + supersede chain | ~2 | Day 4 AM |
| 8: Dogfood + Q5 + Mac coordination (Joe/Eden) | ~4 | Day 4 PM + Day 5 AM |
| **Total** | **~32.75 hours** | **4-5 days** |

**Deltas from 2026-04-14 baseline (2026-04-17 plan refresh, 7 items applied)**:
1. Baseline test count 549→627 (+78, plan-015 skavenger ULTIMATE)
2. `KADMON_RESEARCH_AUTOWRITE` env var added to Phase 7.4 (ADR-015)
3. Mac coordination with Joe/Eden made explicit in Step 8.6
4. Windows paths with spaces — test case 11 added to Phase 4.1 (~10 min)
5. Step 2.5 new — mini-dogfood of `hooks.json` in Kadmon-Harness (~30 min)
6. Step 6.4 new — cold-clone pre-commit hook verification (~5 min)
7. Husky pinned to exact `9.1.7` (no caret) for distribution determinism

Day 5 reserved for unplanned issues, /chekpoint full, and buffer.

### Gaps flagged (things ADR-010 did not specify that plan-010 had to add)

These are NOT inventions — they are engineering decisions ADR-010 left implicit that plan-010 must make explicit. None change the architecture.

1. **`scripts/lib/install-apply.ts` helper** — ADR-010 specifies merge logic lives in `install-helpers.ts` but does not say HOW `install.sh` calls it. Plan-010 introduces a thin CLI wrapper (`install-apply.ts`) invoked via `npx tsx` so bash/PowerShell both delegate to the same tested TypeScript code. Alternative (reimplement merge in pure bash) was rejected as untestable.
2. **`evaluate-patterns-shared.js` `pattern-definitions.json` relative URL** — ADR-010 lists 3 dynamic imports under dist/ but does not mention line 68-69 which is NOT under dist/ (it's a sibling `.claude/hooks/pattern-definitions.json`). Plan-010 explicitly preserves that relative URL because the JSON ships co-located with the hook script in both local-dev and plugin mode. Flagged with a code comment to prevent future "helpful" refactors.
3. **`estimateTokensFromTranscript` helper in `session-end-all.js`** — this function runs BEFORE `main()` computes `rootDir`, so ADR-010's "reuse rootDir from main" guidance doesn't apply. Plan-010 inlines `resolveRootDir(import.meta.url)` inside the helper itself.
4. **jq / rsync availability on Git Bash** — ADR-010 specifies the install.sh flow but does not address missing tools. Plan-010 requires fallback detection with documented prereqs. This is low-risk but needs an explicit decision point in Step 4.2.
5. **Husky `prepare` script ordering** — ADR-010 specifies a pre-commit hook but doesn't specify husky vs git native or `prepare` script interaction with ESM `"type": "module"`. Plan-010 defaults to husky and tests the setup in Phase 6.
6. **Q5 verification is an information-gathering step, not a gate** — ADR-010 says "document the result" but plan-010 makes it explicit that the outcome does not block Sprint D completion. Sprint D ships with the manual `git clone + install.sh` path regardless; Q5 outcome only affects Sprint E/F planning.
