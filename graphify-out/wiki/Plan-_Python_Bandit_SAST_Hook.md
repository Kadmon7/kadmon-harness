# Plan: Python Bandit SAST Hook

> 16 nodes

## Key Concepts

- **post-edit-security hook (bandit SAST)** (5 connections) — `docs/plans/plan-027-python-bandit-sast-hook.md`
- **D4 preflight refusal gates (dirty tree / verify red / empty Unreleased / not on main / tag exists)** (3 connections) — `docs/plans/plan-037-release-command.md`
- **planRelease / applyReleaseWrites / commitAndTag phase split** (3 connections) — `docs/plans/plan-037-release-command.md`
- **toolAvailable() platform-branched where/which probe** (2 connections) — `docs/plans/plan-027-python-bandit-sast-hook.md`
- **KADMON_SKIP_BANDIT_CHECK test-env-gated kill switch** (2 connections) — `docs/plans/plan-027-python-bandit-sast-hook.md`
- **Semgrep default SAST via tool-agnostic adapter (OQ-3)** (2 connections) — `docs/plans/plan-036-sentinel-harness-fork.md`
- **/release command (bump + CHANGELOG + BACKLOG prune + tag)** (2 connections) — `docs/plans/plan-037-release-command.md`
- **/release composes /doks at the command layer (TS cannot import a slash command)** (2 connections) — `docs/plans/plan-037-release-command.md`
- **Injected ReleaseDeps (runVerify + now) to keep modules pure and deterministic** (2 connections) — `docs/plans/plan-037-release-command.md`
- **ADR-020 Python toolchain asymmetry (typecheck+lint but no SAST)** (1 connections) — `docs/plans/plan-027-python-bandit-sast-hook.md`
- **Absolute-path resolution before execFileSync (flag-injection defense)** (1 connections) — `docs/plans/plan-027-python-bandit-sast-hook.md`
- **settings.json is source of truth; hooks.json is generated** (1 connections) — `docs/plans/plan-027-python-bandit-sast-hook.md`
- **Extend the existing security base, never rebuild it** (1 connections) — `docs/plans/plan-036-sentinel-harness-fork.md`
- **Idempotent re-run convergence (committed-but-untagged -> tag-only)** (1 connections) — `docs/plans/plan-037-release-command.md`
- **Propose-only status flips (D5) — human keeps semantic judgment** (1 connections) — `docs/plans/plan-037-release-command.md`
- **expectedCounts contract test as the mechanical count-drift gate** (1 connections) — `docs/plans/plan-037-release-command.md`

## Relationships

- No strong cross-community connections detected

## Source Files

- `docs/plans/plan-027-python-bandit-sast-hook.md`
- `docs/plans/plan-036-sentinel-harness-fork.md`
- `docs/plans/plan-037-release-command.md`

## Audit Trail

- EXTRACTED: 28 (93%)
- INFERRED: 2 (7%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*