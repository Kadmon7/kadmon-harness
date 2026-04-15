---
number: 3
title: Harness Distribution -- Bootstrap Script
date: 2026-04-08
refreshed: 2026-04-14
status: superseded
superseded_by: plan-010-harness-distribution-hybrid.md
needs_tdd: true
route: A
adr: ADR-003-harness-distribution.md
---

# Plan 003: Harness Distribution -- Bootstrap Script [konstruct]

> **Refreshed 2026-04-14** after Sprint B (/evolve Generate), Sprint C (data-integrity fixes), and Sprint F Tier A+S (24 new skills). Counts, manifest categories, and CLAUDE.md template were updated to reflect v1.1 state. Core architecture (Option A, copy-based bootstrap) is unchanged -- almanak verification 2026-04-14 confirmed Claude Code plugins still do not distribute `rules/` or `permissions.deny`. See ADR-003 "Refresh Note" section.

## Overview

Implement the bootstrap script decided in ADR-003. A single TypeScript file (`scripts/bootstrap.ts`) that copies the Kadmon Harness operative layer to a target project directory, smart-merges `settings.json` and `package.json`, generates a CLAUDE.md template, writes a version marker, and runs the build system. Supports four modes: default (interactive), `--diff` (preview), `--update` (apply changes to existing install), and `--force` (no confirmation).

## Current State (v1.1, 2026-04-14)

- 15 agents, 12 commands (11 active + `/instinct` deprecated alias until 2026-04-20), 46 skills, 19 rules (3 subdirs), 29 hook scripts (21 registered + 8 shared modules), 1 pattern-definitions.json, 4 evolve-generate templates
- 18 TypeScript/SQL/d.ts files in `scripts/lib/` (was 10 in Sprint A)
- `settings.json` contains hooks config (6 event types, 21 hooks) + permissions.deny
- `package.json` has runtime deps (sql.js, zod) + devDependencies (typescript, vitest, eslint, etc.)
- Environment variables: `KADMON_TEST_DB`, `KADMON_DISABLED_HOOKS`, `KADMON_NO_CONTEXT_GUARD`, `KADMON_EVOLVE_WINDOW_DAYS`
- Existing scripts follow pattern: async `main()`, try/catch with `process.exit(1)`, imports from `./lib/*.js`
- 549 tests across 55 files, all passing. Tests use `vitest`, arrange-act-assert, temp dirs with cleanup
- `.claude/contexts/` directory was removed during v1.0 consolidation (previously had 3 files)

## Assumptions

- Validated: Target projects are git repositories with an existing `package.json` (ADR-003 states targets are ToratNetz and KAIRON)
- Validated: The harness source is always `Kadmon-Harness/` at a known location (script uses its own `__dirname` to resolve source)
- Validated: `tsconfig.json` in target must include `scripts/lib/` path for compilation (ADR-003 Implementation Notes)
- Updated: Small team with mixed OS -- Windows (Abraham, Ych-Kadmon) and Mac (Joe, Eden). Hook commands must work cross-platform.
- Needs confirmation: Whether `enabledPlugins` from settings.json should be merged or skipped (plan assumes merge/preserve, matching ADR-003 description)

## Phase 0: Research (complete, refreshed 2026-04-14)

- [x] Read ADR-003-harness-distribution.md -- full distribution surface, merge strategies, version tracking
- [x] Read existing scripts (dashboard.ts, db-health-check.ts) -- async main(), import patterns, error handling
- [x] Read settings.json -- 6 hook event types, deny rules, enabled plugins
- [x] Read package.json -- runtime deps, build script, postinstall
- [x] Read tsconfig.json -- ES2022 target, Node16 resolution, include paths
- [x] Count distributable files (v1.1): 15 agents + 12 commands + 46 skills + 19 rules + 29 hooks + 1 pattern-definitions.json + 18 scripts/lib files + 4 evolve-generate templates + 3 scripts-entry + 2 config-files + 1 test-infra = **150 direct files** + settings.json (generated) + CLAUDE.md (generated) + .kadmon-version (generated) + .gitignore (generated) + README.md (generated) = **155 managed artifacts**
- [x] Read test patterns (utils.test.ts) -- vitest, describe/it, temp dir cleanup in afterEach
- [x] Verified 2026-04-14 with almanak: Claude Code plugin system still does not support distributing `.claude/rules/**` or `permissions.deny` -- Option A bootstrap remains the only viable approach for v1.1

## Phase 1: Core Types and Manifest (S, ~11 tests)

The foundation: define what gets copied and the data structures the script operates on.

- [ ] Step 1.1: Create `scripts/lib/bootstrap-manifest.ts` with copy manifest (S)
  - File: `scripts/lib/bootstrap-manifest.ts`
  - Define `CopyCategory` interface: `{ name: string; sourceRelative: string; targetRelative: string; glob: string }`
  - Define `COPY_MANIFEST` as `readonly CopyCategory[]` with all 11 categories:
    1. agents: `.claude/agents/*.md` (15 files)
    2. commands: `.claude/commands/*.md` (12 files -- includes `/instinct` deprecated alias through 2026-04-20)
    3. skills: `.claude/skills/*.md` (46 files -- Sprint F Tier A+S shipped 24 new skills)
    4. rules: `.claude/rules/**/*.md` (19 files, preserves subdirectory structure)
    5. hook-scripts: `.claude/hooks/scripts/*.js` (29 files -- 21 registered + 8 shared modules; `agent-metadata-sync.js` added Sprint B)
    6. pattern-definitions: `.claude/hooks/pattern-definitions.json` (1 file)
    7. scripts-lib: `scripts/lib/*.{ts,sql,d.ts}` (18 files -- excludes `evolve-generate-templates/` which is its own category). Includes Sprint B additions: `evolve-generate.ts`, `evolve-report-reader.ts`, `forge-pipeline.ts`, `forge-report-writer.ts`.
    8. evolve-templates: `scripts/lib/evolve-generate-templates/*.md` (4 files: agent/command/rule/skill templates). NEW category -- these markdown templates are read at runtime by `evolve-generate.ts` and must ship alongside the TypeScript.
    9. scripts-entry: `scripts/dashboard.ts`, `scripts/db-health-check.ts`, `scripts/cleanup-test-sessions.ts` (3 files -- dashboard.ts runs `/kadmon-harness`, db-health-check.ts is used by `/medik`, cleanup-test-sessions.ts is test infra). **NOTE:** migration scripts (`migrate-v0.3.ts`, `migrate-v0.4.ts`, `migrate-archive-hygiene-instincts.ts`, `migrate-fix-session-inversion.ts`) are intentionally EXCLUDED -- fresh installs start at current schema, shared `~/.kadmon/kadmon.db` means migrations have already run on the user's machine during harness development.
    10. config-files: `vitest.config.ts`, `eslint.config.js` (2 files -- test and lint configuration)
    11. test-infra: `tests/global-teardown.ts` (1 file -- referenced by vitest.config.ts globalTeardown)
  - Define `SKIP_PATTERNS` as readonly string array: `settings.local.json`, `agent-memory/`, `dist/`, `node_modules/`, `tests/` (except global-teardown.ts), `docs/`, `scripts/migrate-*.ts`, `scripts/lib/evolve-generate-templates/` (handled by its own category, not by scripts-lib recursion)
  - Define `BootstrapMode` type: `'install' | 'diff' | 'update' | 'force'`
  - Define `BootstrapResult` interface: `{ copied: string[]; skipped: string[]; conflicts: string[]; errors: string[] }`
  - Define `VersionMarker` interface matching ADR-003 spec: `{ version: string; bootstrapDate: string; sourceCommit: string; files: number }`
  - Verify: `npx tsc --noEmit` compiles; unit test imports and checks all 11 categories exist, SKIP_PATTERNS length, type assertions
  - Depends on: none
  - Risk: Low

- [ ] Step 1.2: Write tests for bootstrap-manifest (S)
  - File: `tests/lib/bootstrap-manifest.test.ts`
  - Tests (~12):
    - COPY_MANIFEST has exactly 11 categories
    - Each category has non-empty name, sourceRelative, targetRelative, glob
    - No category sourceRelative overlaps with SKIP_PATTERNS
    - SKIP_PATTERNS contains all expected entries (including `scripts/migrate-*.ts` and `evolve-generate-templates/`)
    - BootstrapMode type accepts valid modes (type-level, expectTypeOf)
    - All category names are unique
    - rules category glob uses `**/*.md` pattern (recursive)
    - scripts-lib category glob captures .ts, .sql, .d.ts extensions but NOT the templates subdirectory
    - scripts-entry category includes dashboard.ts, db-health-check.ts, cleanup-test-sessions.ts (exactly these 3, no migrations)
    - evolve-templates category includes 4 .md files (agent, command, rule, skill)
    - config-files category includes vitest.config.ts and eslint.config.js
    - test-infra category includes global-teardown.ts
  - Verify: `npx vitest run tests/lib/bootstrap-manifest.test.ts` -- all pass
  - Depends on: 1.1
  - Risk: Low

## Phase 2: File Operations Engine (M, ~14 tests)

Pure functions for copying, diffing, and resolving file lists. No side effects on the target yet -- this phase builds the engine that Phase 3 will drive.

- [ ] Step 2.1: Create `scripts/lib/bootstrap-files.ts` with file resolution and copy logic (M)
  - File: `scripts/lib/bootstrap-files.ts`
  - Functions:
    - `resolveSourceFiles(harnessRoot: string, category: CopyCategory): string[]` -- uses `fs.readdirSync` / `fs.globSync` (Node 22) or manual recursive walk to expand the glob into absolute source paths. If Node version lacks `fs.globSync`, use a simple recursive readdir that matches the glob pattern.
    - `resolveTargetPath(sourceFile: string, harnessRoot: string, targetRoot: string, category: CopyCategory): string` -- maps source path to target path preserving relative structure
    - `diffFile(sourcePath: string, targetPath: string): { status: 'new' | 'identical' | 'modified'; sourcePath: string; targetPath: string }` -- compares file content via hash. Returns 'new' if target does not exist.
    - `copyFile(sourcePath: string, targetPath: string): void` -- creates parent dirs, copies file. Uses `fs.mkdirSync({ recursive: true })` + `fs.copyFileSync`.
    - `resolveAllFiles(harnessRoot: string, manifest: readonly CopyCategory[]): Array<{ category: string; sourcePath: string; targetRelative: string }>` -- flat list of all files across all categories
  - All functions are pure or have minimal side effects (only `copyFile` touches the filesystem).
  - Verify: `npx tsc --noEmit` compiles
  - Depends on: 1.1
  - Risk: Low

- [ ] Step 2.2: Write tests for bootstrap-files (M)
  - File: `tests/lib/bootstrap-files.test.ts`
  - Tests (~14):
    - `resolveSourceFiles` finds .md files in a temp category dir
    - `resolveSourceFiles` returns empty array for empty dir
    - `resolveSourceFiles` recurses subdirectories for `**/*.md` glob (rules)
    - `resolveTargetPath` maps source to correct target path
    - `resolveTargetPath` preserves subdirectory structure (e.g., rules/common/agents.md)
    - `diffFile` returns 'new' when target does not exist
    - `diffFile` returns 'identical' when content matches
    - `diffFile` returns 'modified' when content differs
    - `copyFile` creates parent directories
    - `copyFile` copies content correctly
    - `copyFile` overwrites existing file
    - `resolveAllFiles` aggregates files from multiple categories
    - `resolveAllFiles` returns empty for empty manifest
    - `resolveAllFiles` includes category name in each entry
  - All tests use temp directories with afterEach cleanup.
  - Verify: `npx vitest run tests/lib/bootstrap-files.test.ts` -- all pass
  - Depends on: 2.1
  - Risk: Low

## Phase 3: Merge Logic (M, ~21 tests)

The most delicate part: merging settings.json and package.json without losing target-specific configuration.

- [ ] Step 3.1: Create `scripts/lib/bootstrap-merge.ts` with settings.json merge (M)
  - File: `scripts/lib/bootstrap-merge.ts`
  - Functions:
    - `generateHookCommand(scriptName: string, options?: { platform?: NodeJS.Platform }): string` -- generates a hook command string for settings.json. Default behavior (no options or `options.platform` unset): uses the universal Windows-compatible format `cd "$(git rev-parse --show-toplevel)" && PATH="$PATH:/c/Program Files/nodejs" node .claude/hooks/scripts/[SCRIPT].js` -- this works on both Windows (where the PATH prefix is required) and Mac/Linux (where the PATH prefix is a harmless no-op, because `/c/Program Files/nodejs` does not exist). When `options.platform` is explicitly set to a non-win32 value, emits the clean format without the PATH prefix: `cd "$(git rev-parse --show-toplevel)" && node .claude/hooks/scripts/[SCRIPT].js`. This opt-in allows Mac-only projects to have cleaner settings if desired. The `options` parameter also enables testability without mocking `process.platform`.
    - `mergeSettings(harnessSettings: Record<string, unknown>, targetSettings: Record<string, unknown>): Record<string, unknown>` -- implements ADR-003 algorithm:
      1. **hooks**: Replace entire `hooks` section with harness hooks. Hook command strings are generated via `generateHookCommand()` using the universal cross-platform format by default (canonical source of truth).
      2. **permissions.deny**: Union of harness deny rules + target deny rules (deduplicate). Generalize user-specific paths (e.g., `/c/Users/kadmo/.ssh/**` becomes `~/.ssh/**`) so deny rules are portable across collaborators and platforms.
      3. **permissions.allow**: Union of harness allow rules + target allow rules (deduplicate). Added 2026-04-14 when the harness started committing 55 generic `allow` rules (Bash utilities, public docs WebFetch, Skill, WebSearch, MCP context7) to `.claude/settings.json` so collaborators receive them automatically. Target-specific allows (user-added post-bootstrap) are preserved. Machine-specific allow rules (absolute user paths, platform-only commands) stay in the user's `~/.claude/settings.json`, never in the project file.
      4. **enabledPlugins**: Preserve target plugins, add harness defaults if not present
      5. All other top-level keys in target: preserve as-is
    - `mergePackageJson(harnessPackage: Record<string, unknown>, targetPackage: Record<string, unknown>): { merged: Record<string, unknown>; warnings: string[] }` -- implements ADR-003 algorithm:
      1. Add `sql.js` and `zod@^4.0.1` to `dependencies` (warn if target has different version range). Zod v4 is pinned because plan-003 starts new projects with a clean slate -- no migration cost, and v4 delivers 100x fewer tsc instantiations than v3 per the upstream changelog.
      2. Add `typescript` to `devDependencies` (warn if target has different version range)
      3. Add/merge `build` script that includes the `tsc && cpSync` pattern
      4. Add `postinstall` script if not present (warn if exists and differs)
      5. Never override existing version ranges -- warn on conflicts, use target's version
      6. Return warnings array for user review
    - `mergeTsconfig(harnessTsconfig: Record<string, unknown>, targetTsconfig: Record<string, unknown>): Record<string, unknown>` -- ensures `scripts/lib/` is in the `include` array. Preserves all target settings.
  - Verify: `npx tsc --noEmit` compiles
  - Depends on: none (standalone module)
  - Risk: Medium -- merge edge cases (missing keys, malformed JSON, conflicting versions)

- [ ] Step 3.2: Write tests for mergeSettings (M)
  - File: `tests/lib/bootstrap-merge.test.ts`
  - Tests (~13):
    - Replaces hooks section entirely with harness hooks
    - Preserves target's non-hook, non-deny settings
    - Unions deny rules from harness + target (no duplicates)
    - Handles target with empty deny array
    - Handles target with no permissions key
    - Preserves target's enabledPlugins
    - Adds harness enabledPlugins when target has none
    - Does not duplicate enabledPlugins already present in target
    - Handles target being empty object `{}`
    - Handles harness settings with all sections populated
    - generateHookCommand with default options includes PATH prefix (universal format)
    - generateHookCommand with explicit non-win32 platform omits the PATH prefix
    - generateHookCommand includes the script name in the command
    - Deny rules generalize user-specific paths (e.g., `/c/Users/kadmo/.ssh/**` becomes `~/.ssh/**`)
  - Verify: `npx vitest run tests/lib/bootstrap-merge.test.ts` -- all pass
  - Depends on: 3.1
  - Risk: Low

- [ ] Step 3.3: Write tests for mergePackageJson and mergeTsconfig (S)
  - File: `tests/lib/bootstrap-merge.test.ts` (append to same file)
  - Tests (~8):
    - Adds sql.js and zod@^4.0.1 to dependencies
    - Adds typescript to devDependencies
    - Warns when target has conflicting version for sql.js
    - Preserves target's existing dependencies untouched
    - Adds build script
    - Warns when target has different build script
    - Adds postinstall script
    - mergeTsconfig adds `scripts/lib/` to include array
    - mergeTsconfig does not duplicate existing include entry
    - mergeTsconfig preserves all other compiler options
  - Verify: `npx vitest run tests/lib/bootstrap-merge.test.ts` -- all pass
  - Depends on: 3.2
  - Risk: Low

## Phase 4: CLAUDE.md Template, Version Marker, and Scaffolding (S, ~12 tests)

Generate project-specific CLAUDE.md and version tracking.

- [ ] Step 4.1: Create `scripts/lib/bootstrap-template.ts` with CLAUDE.md generator (S)
  - File: `scripts/lib/bootstrap-template.ts`
  - Functions:
    - `generateClaudeMd(projectName: string): string` -- generates a CLAUDE.md template based on the harness CLAUDE.md structure. Includes:
      - Quick Start section (npm install + build)
      - Core Principle (no_context)
      - Environment Variables section: `KADMON_TEST_DB`, `KADMON_DISABLED_HOOKS`, `KADMON_NO_CONTEXT_GUARD`, `KADMON_EVOLVE_WINDOW_DAYS`
      - Agent table (15 agents with model tiers) -- hardcoded from manifest
      - Command catalog (11 commands by phase, note `/instinct` is a deprecated alias)
      - Skill catalog (46 skills by domain, grouped per v1.1 CLAUDE.md taxonomy)
      - Hook summary (21 registered + 8 shared modules)
      - Common Pitfalls: DB path, dist/ imports, Windows PATH, Sprint C session-resume fix (clearSessionEndState + merged object durationMs), cross-project isolation (`/evolve` Generate filters by projectHash), `file_sequence` pattern detector dual-branch (Bash + Skill metadata), `fileURLToPath` on Windows, Stop hooks only fire on clean termination
      - Placeholder sections: `## Stack`, `## MCPs`, `## Project-Specific Pitfalls` with `<!-- TODO: fill in -->` markers
    - `generateVersionMarker(harnessRoot: string, fileCount: number): VersionMarker` -- reads git commit hash from `harnessRoot`, assembles marker object
    - `writeVersionMarker(targetRoot: string, marker: VersionMarker): void` -- writes `.claude/.kadmon-version` as JSON
  - Verify: `npx tsc --noEmit` compiles
  - Depends on: 1.1 (VersionMarker type)
  - Risk: Low

- [ ] Step 4.2: Write tests for template generation (S)
  - File: `tests/lib/bootstrap-template.test.ts`
  - Tests (~8):
    - generateClaudeMd includes project name in title
    - generateClaudeMd includes Quick Start section
    - generateClaudeMd includes Agent table with 15 entries
    - generateClaudeMd includes all 4 env vars (KADMON_TEST_DB, KADMON_DISABLED_HOOKS, KADMON_NO_CONTEXT_GUARD, KADMON_EVOLVE_WINDOW_DAYS)
    - generateClaudeMd includes Sprint C pitfall about session-resume
    - generateClaudeMd includes placeholder sections with TODO markers
    - generateVersionMarker produces valid ISO date
    - writeVersionMarker creates .kadmon-version file with correct JSON structure
  - Verify: `npx vitest run tests/lib/bootstrap-template.test.ts` -- all pass
  - Depends on: 4.1
  - Risk: Low

- [ ] Step 4.3: Create project scaffolding logic in `scripts/lib/bootstrap-scaffold.ts` (S)
  - File: `scripts/lib/bootstrap-scaffold.ts`
  - Functions:
    - `scaffoldDirectories(targetRoot: string): string[]` -- creates empty directories the harness expects to exist in a target project:
      - `src/` -- user's project code
      - `tests/` -- user's project tests
      - `docs/decisions/` -- `/abra-kdabra` writes ADRs here
      - `docs/plans/` -- `/abra-kdabra` writes plans here
      - `docs/diagnostics/` -- `/medik` writes diagnostic reports here
      Uses `fs.mkdirSync({ recursive: true })`. Returns list of dirs created (skips existing). Idempotent.
    - `generateGitignore(targetRoot: string): void` -- writes `.gitignore` if it does not exist. Includes: `node_modules/`, `dist/`, `.env`, `.env.*`, `*.db`, `.claude/settings.local.json`, `.claude/agent-memory/`
    - `generateReadme(targetRoot: string, projectName: string): void` -- writes `README.md` if it does not exist. Basic template with project name as heading and a placeholder description section.
  - Verify: `npx tsc --noEmit` compiles
  - Depends on: none (standalone module)
  - Risk: Low

- [ ] Step 4.4: Write tests for project scaffolding (S)
  - File: `tests/lib/bootstrap-scaffold.test.ts`
  - Tests (~6):
    - scaffoldDirectories creates all 5 expected directories
    - scaffoldDirectories is idempotent (second call does not error)
    - scaffoldDirectories returns only newly created dirs (not existing ones)
    - generateGitignore creates .gitignore with expected entries (node_modules, dist, .env, *.db, agent-memory)
    - generateGitignore skips if .gitignore already exists
    - generateReadme creates README.md containing the project name
  - All tests use temp directories with afterEach cleanup.
  - Verify: `npx vitest run tests/lib/bootstrap-scaffold.test.ts` -- all pass
  - Depends on: 4.3
  - Risk: Low

## Phase 5: Bootstrap Orchestrator (L, ~16 tests)

The main script that ties everything together: argument parsing, mode dispatch, user confirmation, and post-bootstrap actions.

- [ ] Step 5.1: Create `scripts/bootstrap.ts` main script (L)
  - File: `scripts/bootstrap.ts`
  - Structure (following dashboard.ts / migrate-v0.4.ts patterns):
    ```
    async function main(): Promise<void>
    main().catch(err => { process.exit(1) })
    ```
  - Functions:
    - `parseArgs(argv: string[]): { targetPath: string; mode: BootstrapMode }` -- parse process.argv. Validate target path exists and is a directory. Validate mode flag. Print usage on error.
    - `confirmAction(message: string): Promise<boolean>` -- readline-based yes/no prompt. Skipped in `--force` mode.
    - `runInstall(targetRoot: string, mode: BootstrapMode): Promise<BootstrapResult>` -- orchestrates fresh install:
      1. Scaffold project directories (src/, tests/, docs/decisions/, docs/plans/, docs/diagnostics/)
      2. Generate .gitignore and README.md (only if not exists)
      3. Resolve all source files from manifest (10 categories)
      4. Copy all files to target (create dirs as needed)
      5. Smart-merge settings.json (with universal cross-platform hook commands)
      6. Merge package.json
      7. Merge tsconfig.json
      8. Generate CLAUDE.md (only if not exists)
      9. Write .kadmon-version
      10. Return result with counts
    - `runDiff(harnessRoot: string, targetRoot: string): Promise<void>` -- preview mode:
      1. Resolve all source files
      2. For each: compute diff status (new/identical/modified)
      3. Print summary grouped by category
      4. Print settings.json diff preview
      5. Print package.json diff preview
      6. Exit without modifying anything
    - `runUpdate(harnessRoot: string, targetRoot: string, force: boolean): Promise<BootstrapResult>` -- update mode:
      1. Verify .kadmon-version exists (error if not bootstrapped)
      2. Resolve all source files
      3. Compute diffs
      4. Show summary of changes (unless force)
      5. Prompt for confirmation (unless force)
      6. Apply only changed files
      7. Re-merge settings.json and package.json
      8. Update .kadmon-version
    - `runPostBootstrap(targetRoot: string): Promise<void>` -- runs `npm install` (which triggers postinstall -> npm run build) via `execSync` in target directory. Prints output.
    - `printSummary(result: BootstrapResult): void` -- formatted output of what was done
  - Main flow:
    1. Parse args -> determine mode
    2. Resolve harness root from script location (`path.resolve(__dirname, '..')` or `import.meta.url`)
    3. Dispatch to install/diff/update based on mode
    4. Run post-bootstrap (npm install) for install/update modes
    5. Print summary and next steps
  - Verify: `npx tsc --noEmit` compiles; manual test with a temp target directory
  - Depends on: 1.1, 2.1, 3.1, 4.1, 4.3
  - Risk: Medium -- integration of all modules, process.argv parsing, readline interaction

- [ ] Step 5.2: Write tests for parseArgs (S)
  - File: `tests/lib/bootstrap.test.ts`
  - Tests (~4):
    - parseArgs extracts target path from argv
    - parseArgs defaults to 'install' mode
    - parseArgs recognizes --diff flag
    - parseArgs recognizes --update and --force flags
    - parseArgs throws on missing target path
    - parseArgs throws on non-existent target directory
  - Verify: `npx vitest run tests/lib/bootstrap.test.ts` -- all pass
  - Depends on: 5.1
  - Risk: Low

- [ ] Step 5.3: Write integration tests for bootstrap orchestration (L)
  - File: `tests/lib/bootstrap-integration.test.ts`
  - Tests (~12):
    - **Install mode:**
      - Copies all 10 categories to empty target dir
      - Creates .claude/agents/ directory structure in target
      - Creates .claude/rules/common/ and .claude/rules/typescript/ and .claude/rules/python/ subdirs
      - Creates scripts/lib/ directory in target
      - Copies scripts-entry files (dashboard.ts, etc.) to scripts/
      - Copies config-files (vitest.config.ts, eslint.config.js) to target root
      - Copies test-infra (global-teardown.ts) to tests/
      - Scaffolds project directories (src/, tests/, docs/decisions/, docs/plans/, docs/diagnostics/)
      - Generates .gitignore with expected entries
      - Generates README.md with project name
      - Generates settings.json with universal cross-platform hook commands and portable deny rules
      - Merges into existing target package.json
      - Generates CLAUDE.md when not present
      - Skips CLAUDE.md when already present in target
      - Writes .kadmon-version marker
    - **Diff mode:**
      - Does not modify any files in target
      - Reports 'new' status for files not in target
      - Reports 'identical' for unchanged files
      - Reports 'modified' for changed files
    - **Update mode:**
      - Errors when .kadmon-version is missing (not bootstrapped)
      - Only copies modified files (skips identical)
      - Updates .kadmon-version after update
    - **Force mode:**
      - Does not prompt for confirmation (verified by not mocking readline)
  - All tests use temp directories for both source and target, with full cleanup.
  - Note: Tests mock `execSync` for `npm install` to avoid actually running npm.
  - Verify: `npx vitest run tests/lib/bootstrap-integration.test.ts` -- all pass
  - Depends on: 5.1, 5.2
  - Risk: High -- integration test complexity, temp directory setup, mocking npm install

## Phase 6: Edge Cases and Hardening (S, ~8 tests)

Handle error scenarios, validation, and boundary conditions.

- [ ] Step 6.1: Add input validation and error handling (S)
  - File: `scripts/bootstrap.ts` and `scripts/lib/bootstrap-merge.ts`
  - Add:
    - Validate target is a git repo (has `.git/` directory) -- warn if not, but proceed
    - Validate target has `package.json` -- error if not
    - Handle malformed JSON in target's settings.json/package.json -- backup and start fresh
    - Handle read-only files in target -- catch EACCES and report
    - Handle missing source files (harness has been modified) -- warn and skip
    - Add backup of target's settings.json before merge: `settings.json.bak`
    - Add backup of target's package.json before merge: `package.json.bak`
  - Verify: `npx tsc --noEmit` compiles
  - Depends on: Phase 5 complete
  - Risk: Low

- [ ] Step 6.2: Write tests for edge cases (S)
  - File: `tests/lib/bootstrap-edge-cases.test.ts`
  - Tests (~8):
    - Handles target with malformed settings.json (backs up, creates new)
    - Handles target with malformed package.json (backs up, creates new)
    - Warns when target is not a git repo
    - Errors when target has no package.json
    - Backs up settings.json before overwriting
    - Backs up package.json before overwriting
    - Handles source category with zero files (empty dir) gracefully
    - Reports missing source files without crashing
  - Verify: `npx vitest run tests/lib/bootstrap-edge-cases.test.ts` -- all pass
  - Depends on: 6.1
  - Risk: Low

## Testing Strategy

- **Unit tests** (5 files, ~46 tests): bootstrap-manifest (~12), bootstrap-files (~14), bootstrap-merge (~21), bootstrap-template (~8), bootstrap-scaffold (~6) -- each module tested in isolation with temp directories
- **Integration tests** (2 files, ~20 tests): bootstrap.test.ts (parseArgs), bootstrap-integration.test.ts (full orchestration with temp source+target dirs, including scaffolding, .gitignore/.README generation, evolve-templates copying, and universal hook commands)
- **Edge case tests** (1 file, ~8 tests): malformed input, missing files, backup behavior
- **Total: ~74 new tests across 8 test files**, bringing suite from 549 → ~623
- **Not tested**: actual `npm install` execution (mocked in integration tests). Verified manually during first real bootstrap to Kadmon-Sports.
- **Cross-platform**: generateHookCommand tests verify universal format (default) and clean format (explicit non-win32 platform parameter). No need to mock process.platform -- the function accepts platform as an explicit parameter.
- **Evolve-templates integration**: at least one test asserts that after bootstrap the target has `scripts/lib/evolve-generate-templates/` with 4 .md files, so `/evolve` Generate works end-to-end in the target project.

### Test infrastructure notes

- All tests use `os.tmpdir()` based temp directories with `afterEach` cleanup
- Integration tests create a minimal "mock harness" directory structure with representative files in each category (not all 112 files -- just 1-2 per category to verify the pattern)
- Settings merge tests use inline JSON objects, no file I/O needed
- Bootstrap orchestrator tests mock `execSync` for npm commands

## Implementation Notes

### Patterns to follow

- **Script structure**: Follow `scripts/dashboard.ts` -- async `main()`, try/finally for cleanup, `.catch(err => process.exit(1))`
- **Imports**: Use `node:fs`, `node:path`, `node:os`, `node:child_process` with `node:` prefix. Use `.js` extension for local imports (Node16 resolution).
- **Error handling**: Use `catch (error: unknown)` and narrow with `instanceof Error`. Follow `scripts/migrate-v0.4.ts` pattern.
- **Types**: Explicit return types on all exported functions. Use `readonly` for constants. Use `interface` for object shapes.
- **File naming**: kebab-case (`bootstrap-manifest.ts`, `bootstrap-files.ts`, `bootstrap-merge.ts`, `bootstrap-template.ts`, `bootstrap-scaffold.ts`)
- **No console.log in lib modules**: Use `process.stderr.write` for logging (following `utils.ts log()` pattern). Only `bootstrap.ts` (the CLI entry point) uses stdout for user-facing output.

### Pitfalls to avoid

- **`import.meta.url` on Windows**: Use `fileURLToPath()` from `node:url` to convert `import.meta.url` to a file path. `new URL().pathname` encodes spaces as `%20` (documented in CLAUDE.md pitfalls).
- **Path separators**: Use `path.join()` and `path.resolve()` everywhere. Never hardcode `/` or `\`.
- **Recursive directory copy**: Do not use `fs.cpSync` with `{ recursive: true }` -- it copies everything including unwanted files. Walk the glob results explicitly.
- **JSON formatting**: Write settings.json and package.json with `JSON.stringify(data, null, 2)` + trailing newline.
- **Git commit hash**: Use `execSync('git rev-parse --short HEAD')` in the harness root, not the target. Handle failure gracefully (use 'unknown' if not in a git repo).
- **Build script portability**: The current build script uses `require('fs').cpSync(...)` which requires CommonJS. In an ESM project, this might need adjustment. For now, keep the same pattern as the harness package.json.
- **Cross-platform hook commands**: The harness settings.json has `PATH="$PATH:/c/Program Files/nodejs"` in every hook command. This is Windows-specific, but harmless on Mac/Linux (the path simply does not exist, so the PATH append is a no-op). Per ADR-003 recommendation, the default is to use the universal Windows-compatible format in the committed settings.json, because it works everywhere and avoids divergence when collaborators on different OSes share the same repo. `generateHookCommand()` accepts an optional `platform` parameter for Mac-only projects that want cleaner commands.
- **Deny rule portability**: The deny rule `Read(/c/Users/kadmo/.ssh/**)` is Windows-user-specific. Bootstrap generalizes this to `Read(~/.ssh/**)` which works cross-platform. Other deny rules (`.env`, `git push --force`, etc.) are already portable.

### File count by module

| Module | Lines (est.) | Functions |
|--------|-------------|-----------|
| bootstrap-manifest.ts | ~80 | Types + constants (11 categories) |
| bootstrap-files.ts | ~80 | 5 functions |
| bootstrap-merge.ts | ~140 | 4 functions (includes generateHookCommand) |
| bootstrap-template.ts | ~120 | 3 functions (template grew with Sprint C pitfalls + 4 env vars) |
| bootstrap-scaffold.ts | ~60 | 3 functions |
| bootstrap.ts (main) | ~210 | 6 functions + main (includes scaffolding + evolve-templates copy) |
| **Total** | **~690** | **21 functions** |

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Settings merge loses target-specific config | Medium | High | Backup before merge, diff preview mode, union-based deny merge |
| Package.json merge introduces version conflicts | Low | Medium | Never override target versions, warn on conflicts, let target win |
| Build script incompatibility in target (ESM vs CJS) | Low | Medium | Document the `require('fs').cpSync` pattern; provide alternative for ESM targets |
| Integration tests are fragile due to temp dir setup | Medium | Low | Use unique timestamp-based dirs, strict cleanup, small representative file sets |
| CLAUDE.md template becomes stale as harness evolves | Medium | Low | Template is generated from constants in bootstrap-manifest.ts -- update manifest when adding agents/commands |
| File permission issues on Windows | Low | Low | Catch EACCES, report to user, continue with remaining files |
| Cross-platform hook commands break on untested OS | Low | Medium | Default universal format includes Windows PATH prefix which is a no-op on Mac/Linux; opt-in platform parameter for clean Mac-only commands; unit tests cover both code paths |
| Scaffolded dirs conflict with existing project structure | Low | Low | scaffoldDirectories is idempotent (mkdirSync recursive); generateGitignore/generateReadme skip if files exist |

## Success Criteria

- [ ] `npx tsx scripts/bootstrap.ts /tmp/test-target` successfully copies all 11 categories to a fresh temp directory
- [ ] Target has scaffolded directories: `src/`, `tests/`, `docs/decisions/`, `docs/plans/`, `docs/diagnostics/`
- [ ] Target has generated `.gitignore` with node_modules, dist, .env, *.db, agent-memory entries
- [ ] Target has generated `README.md` with project name
- [ ] `settings.json` in target contains all 21 hooks with universal cross-platform commands and all harness deny rules
- [ ] Hook commands use universal format by default (works on both Windows and Mac/Linux)
- [ ] `package.json` in target includes sql.js, zod@^4.0.1 as dependencies and typescript as devDependency
- [ ] `CLAUDE.md` is generated with agent table (15), command catalog (11 active), skill catalog (46), env vars (4 including `KADMON_EVOLVE_WINDOW_DAYS`), and TODO placeholders
- [ ] `.claude/.kadmon-version` is written with correct version (`1.1.0`), date, and commit hash
- [ ] Target has `scripts/lib/evolve-generate-templates/` with 4 .md files so `/evolve` Generate works
- [ ] `--diff` mode shows changes without modifying any target files
- [ ] `--update` mode only copies modified files and updates the version marker
- [ ] `--force` mode skips confirmation prompts
- [ ] All new tests pass: `npx vitest run tests/lib/bootstrap*.test.ts`
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Existing 549 tests remain passing: `npx vitest run`
- [ ] Total new test count: ~74 tests across 8 files, bringing suite to ~623
- [ ] **End-to-end dogfood**: `npx tsx scripts/bootstrap.ts ~/Command-Center/Kadmon-Sports` succeeds; from Kadmon-Sports `/forge` runs, writes ClusterReport to `~/.kadmon/forge-reports/`, `/evolve` Generate reads it back and proposes Kadmon-Sports-specific artifacts. Confirms cross-project isolation via projectHash.
