---
alwaysApply: false
globs: ["**/*.py", "**/*.pyi"]
---
# Python Patterns

> This file extends [common/patterns.md](../common/patterns.md) with Python-specific content.

## Protocol (Duck Typing)

PREFER Protocol over ABC for structural subtyping:

```python
from typing import Protocol

class Repository(Protocol):
    def find_by_id(self, id: str) -> dict | None: ...
    def save(self, entity: dict) -> dict: ...
```

## Dataclasses as DTOs

PREFER dataclasses over plain dicts for structured data:

```python
from dataclasses import dataclass

@dataclass
class CreateUserRequest:
    name: str
    email: str
    age: int | None = None
```

## Context Managers

MUST use context managers (`with` statement) for resource management:

```python
# NEVER: manual resource management
f = open("file.txt")
data = f.read()
f.close()

# ALWAYS: context manager
with open("file.txt") as f:
    data = f.read()
```

## Generators

PREFER generators for lazy evaluation and memory-efficient iteration:

```python
# PREFER: generator for large datasets
def process_records(records):
    for record in records:
        yield transform(record)
```

## Error Handling

- MUST catch specific exceptions, never bare `except:`
- PREFER returning `None` or Result types for expected failures
- MUST use `raise ... from e` to preserve exception chains

```python
# CORRECT: specific exception with context
try:
    result = parse_config(path)
except FileNotFoundError as e:
    raise ConfigError(f"Config not found: {path}") from e
```

## Enforcement

- python-reviewer agent validates pattern compliance on .py edits
- Review checklist covers Pythonic Patterns (HIGH) and Error Handling (CRITICAL)
