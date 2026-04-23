# Changelog

All notable changes to Kadmon Harness are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/) applied to the `.claude-plugin/plugin.json` version. `package.json` tracks the same version for consistency. Release cadence policy: [ADR-025](docs/decisions/ADR-025-versioning-policy.md) — MINOR bumps for narrative features, PATCH only for post-release hotfixes.

## [1.2.3] — 2026-04-23

### Added
- **Install Health Telemetry** — [ADR-024](docs/decisions/ADR-024-install-health-telemetry.md). Passive diagnostic channel surfacing the recurring Windows symlink-clone bug (2 of 5 collaborators hit it in 2026-04-22 dogfood).
  - `scripts/lib/install-health.ts` — pure diagnostic with tri-state symlink detection (`symlink_ok | junction_ok | broken_target | text_file | regular_dir | missing`) using `realpath` divergence as the discriminator per arkitect review.
  - `scripts/lib/install-remediation.ts` — adaptive banner renderer (PowerShell `New-Item -ItemType SymbolicLink` fix for plugin-cache paths; `git checkout` fix for dev-clone paths). PowerShell interpolation sanitizer guards against command injection via malicious `rootDir`.
  - `scripts/lib/rotating-jsonl-log.ts` — shared rotation helper (100 KB / 50 lines). Extracted from `hook-logger.js` so both it and the new `install-diagnostic.js` share one source of truth.
  - `.claude/hooks/scripts/install-diagnostic.js` — writes every session's `InstallHealthReport` to `~/.kadmon/install-diagnostic.log`. Test-env guard redirects to stderr so vitest never pollutes the production log.
  - `session-start.js` — emits a non-blocking banner when `report.ok === false`, always persists to the log.
  - `/medik` Check #9 — health check row with JSON output + exit code signaling (`0` when `ok`, `1` otherwise). mekanik analyzes anomalies in Phase 2 and suggests matching remediation.
- **TROUBLESHOOTING.md** (`docs/onboarding/TROUBLESHOOTING.md`) — documents the 3 bugs from the 5-collaborator dogfood (symlinks as text files, `PreToolUse:Agent hook error — bash.exe skipping`, `/reload-plugins` required post-install) with copy-paste remediation and a "How to report" section.
- **CLAUDE.md onboarding template** (`docs/onboarding/CLAUDE.template.md`) — cross-project reusable template that points to `reference_kadmon_harness.md` memory catalog instead of duplicating the harness surface.

### Changed
- **ADR-020 flipped `proposed` → `accepted`** — Windows (Ych-Kadmon) + Mac (Joe, Eden) dogfood complete; runtime language detection is now the permanent contract.
- **`CLAUDE.md` trim 211 → 167 lines** — restored full 16-row Agents table, link-outs for Skills catalog, hard-cap comment above Status to keep future edits disciplined.
- **`hook-logger.js` refactored** to delegate rotation to `rotating-jsonl-log.ts`. All 12 existing tests preserved; stack-trace truncation, test-env guard, and stderr shape unchanged.
- **`session-start.js` install health integration** — 3 new integration tests (silent when healthy, banner when broken, diagnostic log written via stderr under VITEST).
- **ADR-024 split** — on arkitect review, `install-health.ts` (pure diagnostic) separated from `install-remediation.ts` (presentation) to align with the `db-health.ts` SRP pattern.
- **`/kadmon-harness` command renamed to `/nexus`** — shorter invocation, keeps the command namespace distinct from the plugin name itself. No functional change; dashboard behavior identical. CLAUDE.md Commands catalog updated accordingly.

### Fixed
- **`/kompact` tmpdir resolution regression (Bug 3)** — the v1.2.2 Node `os.tmpdir()` approach returned Windows `C:\...` paths that got mangled by `xargs` + MSYS forward-slash conversion on Git Bash. Replaced with env-var chain `TMPROOT="${TMPDIR:-${TEMP:-/tmp}}"` that coincides with Node's actual write location on every shell that can run bash pipelines.
- **Latent grep regex bug in `/kompact`** — regex searched `'"file_path":"..."'` but `observations.jsonl` uses camelCase `"filePath"` since schema standardization. Opportunistic fix.
- **`/instinct` deprecation alias removed** — sunset 2026-04-20 per plan-005 §Cleanup. `resolveAliasCommand` deleted along with its single test.
- **`createRequire` of ESM `dist/` modules** — replaced in `hook-logger.js`, `install-diagnostic.js`, and `install-health.ts` with top-level-await dynamic `import()` via `pathToFileURL`. Required because project engine floor is `>=18` and `require()` of ESM throws `ERR_REQUIRE_ESM` on Node 18 and 20. Caught by typescript-reviewer during `/chekpoint` full tier.
- **Windows path corruption in banner** — `lastIndexOf("/")` returned `-1` on backslash paths, corrupting `rootDir` derivation in PowerShell remediation. Replaced with `path.dirname`. Caught by typescript-reviewer.
- **PowerShell command-injection vector** — unescaped `rootDir` interpolation in `renderPluginCacheRemediation`. Added `escapePwshDoubleQuoted` (backtick + dollar + quote escaping). Caught by spektr.

### Notes
- **First release under [ADR-025](docs/decisions/ADR-025-versioning-policy.md) versioning policy.** Consolidated 9 commits of 2026-04-22/23 into one MINOR bump instead of the noisy 1-per-commit PATCH cadence that produced v1.2.0/1/2 over 2 days. Going forward, PATCH bumps are reserved for post-release hotfixes only.
- **Deferred to v1.2.4** (per `docs/roadmap/v1.2.4-export-and-diagnostics.md`): `/medik --export` shareable-diagnostic file, schema `_v: 1` field on `install-diagnostic.log` entries, typed reader wrapper. Both orakle MEDIUMs from the v1.2.3 `/chekpoint`.
- **Deferred to Sprint E**: root-cause of `PreToolUse:Agent hook error — bash.exe skipping` (cousin bug, documented in TROUBLESHOOTING.md). Symlink fixes have resolved it indirectly in every field case to date.
- **Metrics**: **934 tests passing** (75 files, +47 tests / +4 test files vs 1.2.2) · 21 hooks · 16 agents · 46 skills · 11 commands · 19 rules · 7 DB tables.
- **Chain invoked**: `/abra-kdabra` (arkitect + konstruct) → TDD → `/chekpoint` full tier (typescript-reviewer + spektr + orakle + kody) → 3 BLOCK findings fixed pre-merge → PR #4 merged via rebase.

## [1.2.2] — 2026-04-22

### Fixed
- `/kompact` cross-platform tmpdir resolution (first attempt; regressed on Git Bash and corrected in 1.2.3).
- `commit-format-guard` hook false-positive on multi-line conventional commit bodies.

### Notes
- Retained as historical reference under the policy superseded by [ADR-025](docs/decisions/ADR-025-versioning-policy.md); equivalent work would ship as part of the next MINOR under the new policy.

## [1.2.1] — 2026-04-22

### Fixed
- `hook_events` and `agent_invocations` tables gained `ON CONFLICT DO NOTHING` dedup guards (prevents duplicate inserts when lifecycle hooks fire twice for the same event).
- Orphan recovery staleness guard (ADR-022) — session-start no longer pisa live sessions in other terminals; `isOrphanStale` threshold via `KADMON_ORPHAN_STALE_MS`.
- `endSession` cross-project guard assert on `project_hash` mismatch.

### Notes
- Retained as historical reference under the policy superseded by [ADR-025](docs/decisions/ADR-025-versioning-policy.md).

## [1.2.0] — 2026-04-21

### Added
- **Runtime language detection** (`scripts/lib/detect-project-language.ts`) — [ADR-020](docs/decisions/ADR-020-runtime-language-detection.md), plan-020 Phase A.
- **`KADMON_PROJECT_LANGUAGE`** env var to override detection (`typescript | python | mixed | unknown`). Normalized (trim + lowercase) before whitelist check.
- **Python toolchain support** across 6 hooks (plan-020 Phase B):
  - `post-edit-typecheck` — `.py` runs mypy → pyright → `python -m py_compile` (first installed).
  - `quality-gate` — `.py` runs `ruff check`.
  - `ts-review-reminder` — counts `.py` edits toward the 5-edit threshold; `python-reviewer` invocation resets the counter.
  - `deps-change-reminder` — triggers on `pyproject.toml` and `requirements.txt` alongside `package.json`.
  - `console-log-warn` — warns about `print()` in `.py` production code (closes `rules/python/hooks.md` mandate).
  - `commit-quality` — blocks commits staging `print()` / `breakpoint()` in `.py` production code.
- **Python branches in 3 commands**: `/chekpoint`, `/medik`, `/abra-kdabra` — plan-020 Phase C.
- **Python awareness in 4 agents**: feniks, mekanik, kartograf, arkonte (body updates; frontmatter untouched) — plan-020 Phase D.
- **3 Python pattern definitions** (`types.py`, `models.py`, `pyproject.toml`) in `pattern-definitions.json`.
- **5 test fixtures** under `tests/fixtures/lang-{ts,py,mixed,unknown}/` for language-detection coverage.

### Changed
- `/chekpoint` tier matrix routes reviewers by file extension (`.ts/.tsx/.js/.jsx` → typescript-reviewer, `.py` → python-reviewer, mixed → both in parallel).
- 5 skills touched for language-agnostic examples (`verification-loop`, `tdd-workflow`, `ai-regression-testing`, `coding-standards`, `e2e-testing`).
- README and CLAUDE.md matured from "any project" to "TypeScript or Python projects" — honest promise.
- `plugin.json` description updated to reflect polyglot support.
- `package.json` version aligned with plugin version (1.0.0 → 1.2.0).
- `rules/common/hooks.md` catalog rows describe per-language branching for the 6 updated hooks.

### Fixed
- `session-start.js` now emits a visible "no git remote — session tracking disabled" log line when the target repo has no `git remote origin` (previously a silent early-exit that looked like a plugin bug). Investigated and closed 2026-04-21.

### Notes
- ADR-020 remains `status: proposed` until Kadmon-Sports dogfood (Joe/Eden on macOS) flips it to `accepted`. No code change required for the flip — doc-only bump.
- Metrics: **870 tests passing** (70 files) · 21 hooks · 16 agents · 46 skills · 11 commands · 19 rules · 7 DB tables.

## [1.1.0] — 2026-04-20

### Added
- **Hybrid distribution model** — [ADR-010](docs/decisions/ADR-010-harness-distribution-hybrid.md). Claude Code plugin distributes agents/skills/commands/hooks; `install.sh` / `install.ps1` bootstrap rules + `permissions.deny` + `.kadmon-version`.
- **Canonical root symlinks** (`./agents`, `./skills`, `./commands`) per [ADR-019](docs/decisions/ADR-019-canonical-root-symlinks-for-plugin-loader.md). Required on Windows with Developer Mode + `core.symlinks=true` + `MSYS=winsymlinks:nativestrict`.
- End-to-end dogfood against Kadmon-Sports on macOS — cross-project SQLite isolation verified.
- MIT LICENSE for public distribution.

## [1.0.0] — pre-2026-04-20

Initial internal release (plans 001–019 and ADRs 001–019). Shipping history lives in `docs/decisions/` and `git log`.
