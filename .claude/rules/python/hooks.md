---
alwaysApply: false
globs: ["**/*.py", "**/*.pyi"]
---
# Python Hooks

> This file extends [common/hooks.md](../common/hooks.md) with Python-specific content.

## PostToolUse Hooks

Since plan-020 (ADR-020), the shared harness hooks branch on file extension at runtime and honor the Python toolchain automatically:

- **post-edit-typecheck.js** — `.py` edits run `mypy <file>` (fallback: `pyright <file>` → `python -m py_compile <file>`). Warns and exits 0 if no Python typechecker is installed.
- **quality-gate.js** — `.py` edits run `ruff check <file>`. Skips with a warning if `ruff` is not installed.
- **console-log-warn.js** — detects `print(` in `.py` files and warns to use the `logging` module (closes the "Warnings" mandate below).
- **commit-quality.js** — blocks commits staging `print()` or `breakpoint()` in production `.py` files (exempts `test_*.py`, `*_test.py`, and `tests/` paths).
- **deps-change-reminder.js** — triggers on `pyproject.toml` and `requirements.txt` dependency changes and suggests `/almanak`.
- **ts-review-reminder.js** — counts `.py` edits toward the 10-edit threshold; `python-reviewer` invocation resets the counter.
- **post-edit-security.js** — `.py` edits run `bandit -ll <file>` (ADR-027). Warn-only (exit 1 on findings). Skips with a warning if `bandit` is not installed.

These hooks need no per-project configuration — detection is automatic.

## Warnings

- MUST warn about `print()` statements in edited files (use `logging` module instead) — **implemented 2026-04-21 via `console-log-warn.js` Python branch (plan-020 Phase B)**
- MUST warn about missing type annotations in edited functions

## Enforcement

- python-reviewer agent validates Python code quality on .py edits
- Diagnostic commands (mypy, ruff, bandit) run as part of review workflow
