---
alwaysApply: false
globs: ["**/*.py", "**/*.pyi"]
---
# Python Hooks

> This file extends [common/hooks.md](../common/hooks.md) with Python-specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json` when Python projects are active:

- **black/ruff**: Auto-format `.py` files after edit
- **mypy/pyright**: Run type checking after editing `.py` files

## Warnings

- MUST warn about `print()` statements in edited files (use `logging` module instead)
- MUST warn about missing type annotations in edited functions

## Enforcement

- python-reviewer agent validates Python code quality on .py edits
- Diagnostic commands (mypy, ruff, bandit) run as part of review workflow
