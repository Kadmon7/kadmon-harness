# Changelog

All notable changes to Kadmon Harness are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/) applied to the `.claude-plugin/plugin.json` version. `package.json` tracks the same version for consistency.

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
