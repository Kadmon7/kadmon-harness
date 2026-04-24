# Changelog

All notable changes to Kadmon Harness are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/) applied to the `.claude-plugin/plugin.json` version. `package.json` tracks the same version for consistency. Release cadence policy: [ADR-025](docs/decisions/ADR-025-versioning-policy.md) — MINOR bumps for narrative features, PATCH only for post-release hotfixes.

## [Unreleased]

### Docs
- `/evolve` Generate step 6 promoted from EXPERIMENTAL to accepted (observation window ended 2026-04-24). CLAUDE.md + reference docs updated. ADR-008 was already accepted; the EXPERIMENTAL tag was a post-ship uncertainty marker that has been resolved.
- v1.3.1 performance + quality roadmap published at `docs/roadmap/v1.3.1-performance-and-quality.md` — 15 deferred hygiene items catalogued (arkonte perf + kurator quality + mekanik integration + 4 LOW/feature items) with effort sizing and implementation order.
- `/abra-kdabra` command cleanup: dropped redundant Step 5 (kody review) because command produces a PLAN not code; kody runs automatically in `/chekpoint` Phase 2b when implementation ships. Added Spanish + visual Approval Gate TL;DR block (Decisión / Por qué / Alcance / Riesgo / Esfuerzo / Tests) so user decides approve/reject in seconds without opening the ADR/plan files. 2 rules tables synced (`rules/common/agents.md`, `rules/common/development-workflow.md`). See plan-030 Phase B.
- `.gitignore` now excludes `.claude/scheduled_tasks.lock` (per-session scheduler lock file created by `/schedule` + `/loop` skills).

## [1.3.0] — 2026-04-24

### Added
- **`/medik` expansion 9 → 14 checks** — [plan-028](docs/plans/plan-028-v1.3-medik-expansion-release.md), [ADR-028](docs/decisions/ADR-028-v1.3-medik-expansion-release.md), [plan-029](docs/plans/plan-029-medik-check-14-capability-alignment.md), [ADR-029](docs/decisions/ADR-029-medik-check-14-capability-alignment.md). Five new checks regrouped under 4 categories (Core / Runtime / Code-hygiene / Knowledge-hygiene):
  - **Check #10 stale-plans** (knowledge-hygiene) — flags pending plans in `docs/plans/` older than 3 days with recent git activity.
  - **Check #11 hook-health-24h** (runtime) — surfaces hooks with high block-rate or latency over the last 24h, joining `hook_events` and `sessions` by project hash. Per-hook latency budgets respected (observe-pre/post=50ms, no-context-guard=100ms, default=500ms).
  - **Check #12 instinct-decay-candidates** (knowledge-hygiene) — read-only SELECT of the 10 lowest-confidence instincts by `confidence ASC, last_observed_at ASC`, flagging decay candidates without mutating them.
  - **Check #13 skill-creator-probe** (runtime) — probes 3 candidate paths (plugin cache, project skills, global skills) for the `skill-creator` plugin; warns when missing because `/evolve` step 6 Generate depends on it.
  - **Check #14 capability-alignment** (code-hygiene, ADR-029, plan-029) — compares each skill's `requires_tools:` frontmatter against its owner agent's `tools:` field. Mismatches emit FAIL (silently unexecutable skill, e.g. council pre-2026-04-23). Heuristic body-scan fallback emits WARN. Seed adopters: `council` (`[Task]`), `deep-research` (`[Task, WebFetch, WebSearch]`).
  - Module-per-check subsystem at `scripts/lib/medik-checks/` (ADR-028 §D1) keeps each check ~80 lines with shared `types.ts`.
- **`/medik --ALV` diagnostic export** (Attach-Log-Verify) — Phase 0 flag in `/medik` that generates a redacted, shareable diagnostic snapshot to `diagnostic-YYYY-MM-DDTHHmm.txt`. Bundles install-diagnostic entries (last 10), hook-errors (last 10), and a fresh health check. Cross-platform path redaction (Win `C:\Users\<user>`, macOS `/Users/<user>`, Linux `/home/<user>`) with 7-rule ordered pipeline (homedir → caller-supplied roots → OS-specific user paths → cwd → catch-all). Spektr hardening: section-header forge prevention, free-form path harvesting from error/stack fields, Zod-guarded root seeding, O_EXCL atomic file create with EEXIST random-suffix fallback, mode 0o600, containment check (cwd OR `os.tmpdir()`), git timeout 3000ms with stdin=ignore. 26 test cases at `tests/lib/medik-alv.test.ts`.
- **Typed install-diagnostic reader** (`scripts/lib/install-diagnostic-reader.ts`) — exports `VersionedInstallReport extends InstallHealthReport` interface and `readTypedInstallDiagnostics(logDir?, limit?)`. Per-entry Zod validation (`rootDir | symlinks | timestamp`). Legacy entries without `_v` are coerced to `{_v: 0, ...entry}`. Corrupt entries dropped with stderr warn. Closes the v1.2.3 deferred orakle MEDIUM. 10 test cases at `tests/lib/install-diagnostic-reader.test.ts`.
- **`_v: 1` schema field on `install-diagnostic.log` entries** (ADR-028 §D2) — every entry written by `install-diagnostic.js` now carries a forward-compat schema version. Closes the v1.2.3 deferred orakle MEDIUM.
- **Python SAST hook** — [ADR-027](docs/decisions/ADR-027-python-bandit-sast-hook.md). New `post-edit-security.js` (hook #22) runs `bandit -ll <file>` on `.py` edits. Warn-only (exit 1 on findings). Graceful fallback when bandit is not installed. Skips test files, fixtures, and dep paths. Respects `KADMON_DISABLED_HOOKS`. Hook count 21 → 22. 11 new test cases at `tests/hooks/post-edit-security.test.ts`.
- **Graphify adoption** — [ADR-026](docs/decisions/ADR-026-graphify-adoption.md). External knowledge-graph layer ([safishamsi/graphify](https://github.com/safishamsi/graphify), MIT, Python 3.10+, 33k stars) shipped as the v1.3 roadmap item 7. Harness-side scope strictly limited to `.graphifyignore`, `.gitignore` entries, README "Using graphify" subsection, ADR-026, roadmap entry. Zero internal TS code. Single-commit reversible. **Sprint E measurement gate PASSED** with **8.11× avg token reduction** (Method C, total session cost across 10 queries) — see Notes.

### Changed
- **`/medik` frontmatter description** "8 health checks" → "14 health checks". Categories regrouped (Core / Runtime / Code-hygiene / Knowledge-hygiene). Phase 0 `--ALV` block added before Phase 1.
- **Skill capability declaration via `requires_tools:` frontmatter** (ADR-029, plan-029) — opt-in YAML field in skill SKILL.md frontmatter that declares tools the skill invokes outside its owner agent's default grant. Backed by Check #14. Seed adopters: `council`, `deep-research`.
- **`ts-review-reminder` hook threshold** raised 5 → 10 edits without code review. DB history showed 0 fires historically; 5 was a guess, 10 better matches a single feature or ~5 TDD cycles.

### Fixed
- **`/medik` Check #6 .d.ts docstring drift** — Check #6 (TypeScript compilation) excludes `*.d.ts` declaration files since they don't compile. Spec in `.claude/commands/medik.md` now matches runtime behavior in `ensure-dist.js:43`.

### Docs
- Privacy scrub — replaced collaborator personal names with generic roles (`collaborator`, `macOS collaborator`, `Windows collaborator`) across 16 docs + 3 test-comment files. Platform kept as technical fact where it matters. Ych-Kadmon + Kadmon7 handles retained (already public). Git history intentionally not rewritten.

### Notes
- **Sprint E graphify benchmark (PASS, 8.11×)** — 10-query benchmark on this repo. Method C (total session cost, GRAPH_REPORT amortized once + wikis per query): **8.11×** avg ratio. Method B (per-query, GRAPH amortized): **20.07×**. Method A literal (GRAPH counted per query): 1.77× — formula flaw flagged: GRAPH_REPORT.md is a navigation index loaded once per session, not per query. Below creator's 71.5× claim but well above 3.0× threshold. ADR-026 stays accepted. Promotion to first-class `/medik graphify` subcommand deferred to v1.4. Full table at `docs/roadmap/v1.3-medik-expansion.md` item 7.
- **Release strategy: 4-chunk `/chekpoint`** — plan-028 phases consolidated into 4 commits (Chunk A: Phase 3 lite TS-only; Chunk B: Phases 4+5 full; Chunk C: Phase 6 full spektr-MANDATORY for redaction; Chunk D: Phases 7+8 doc + release). Reduced from 8 per-phase chekpoints to 4. Spektr cross-chunk findings (HIGH-1 path harvesting from free-form errors, HIGH-2 section-header forge prevention) caught only because Chunk C bundled the security-sensitive surface.
- **Chain invoked**: `/abra-kdabra` (arkitect + konstruct) → TDD via feniks → `/chekpoint` full tier per chunk (typescript-reviewer + spektr + orakle + kody) → BLOCK findings resolved pre-merge.
- **Metrics**: **1053+ tests passing** (85+ test files) · 22 hooks · 16 agents · 46 skills · 11 commands · 19 rules · 7 DB tables · 14 `/medik` checks.
- **Deferred to v1.3.1 backlog**: ts-reviewer WARN on `install-diagnostic-reader` plugin-mode path resolution. Promotion of graphify to `/medik graphify` subcommand. Nexus badge for graph freshness.

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
- **ADR-020 flipped `proposed` → `accepted`** — Windows (Ych-Kadmon) + macOS collaborators dogfood complete; runtime language detection is now the permanent contract.
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
- **Deferred to v1.3** (per `docs/roadmap/v1.3-medik-expansion.md`): `/medik --export` shareable-diagnostic file, schema `_v: 1` field on `install-diagnostic.log` entries, typed reader wrapper. Both orakle MEDIUMs from the v1.2.3 `/chekpoint`. Originally scoped as `v1.2.4` but renamed 2026-04-23 to align with ADR-025 — a new feature (`--export`) + expanded `/medik` checks is a MINOR narrative, not a PATCH hotfix. See v1.3-medik-expansion.md for the full scope (7 items including promoted v2.0 hygiene and the new `graphify` feature).
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
- ADR-020 remains `status: proposed` until Kadmon-Sports dogfood (macOS collaborators) flips it to `accepted`. No code change required for the flip — doc-only bump.
- Metrics: **870 tests passing** (70 files) · 21 hooks · 16 agents · 46 skills · 11 commands · 19 rules · 7 DB tables.

## [1.1.0] — 2026-04-20

### Added
- **Hybrid distribution model** — [ADR-010](docs/decisions/ADR-010-harness-distribution-hybrid.md). Claude Code plugin distributes agents/skills/commands/hooks; `install.sh` / `install.ps1` bootstrap rules + `permissions.deny` + `.kadmon-version`.
- **Canonical root symlinks** (`./agents`, `./skills`, `./commands`) per [ADR-019](docs/decisions/ADR-019-canonical-root-symlinks-for-plugin-loader.md). Required on Windows with Developer Mode + `core.symlinks=true` + `MSYS=winsymlinks:nativestrict`.
- End-to-end dogfood against Kadmon-Sports on macOS — cross-project SQLite isolation verified.
- MIT LICENSE for public distribution.

## [1.0.0] — pre-2026-04-20

Initial internal release (plans 001–019 and ADRs 001–019). Shipping history lives in `docs/decisions/` and `git log`.
