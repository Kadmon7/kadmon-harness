---
alwaysApply: false
globs: ["**/*.py", "**/*.pyi"]
---
# Python Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with Python-specific content.

## Standards

- MUST follow **PEP 8** conventions
- MUST use **type annotations** on all function signatures
- MUST use **f-strings** over `.format()` or `%` formatting
- NEVER use mutable default arguments (`def f(x=[])`) -- use `def f(x=None)`

## Naming

- MUST use `snake_case` for functions, variables, and module names
- MUST use `PascalCase` for classes and type aliases
- MUST use `UPPER_SNAKE_CASE` for module-level constants
- PREFER leading underscore for private members (`_internal_method`)

## Immutability

PREFER immutable data structures:

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class User:
    name: str
    email: str

from typing import NamedTuple

class Point(NamedTuple):
    x: float
    y: float
```

## Formatting

- **black** for code formatting
- **isort** for import sorting (profile=black)
- **ruff** for linting (replaces flake8, isort, pyupgrade)

## Imports

- MUST follow isort order: stdlib, third-party, local (blank line separators)
- NEVER use `from module import *` -- explicit imports only
- PREFER absolute imports over relative imports
- MUST use `from __future__ import annotations` for forward references

## Enforcement

- python-reviewer agent auto-checks PEP 8, type hints, naming, and import patterns on .py edits
- ruff and black verify formatting compliance
- mypy --strict validates type annotations
