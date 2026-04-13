---
name: python-patterns
description: Advanced Python patterns beyond PEP 8 basics — modern type hints (3.9+ builtin generics, Protocol, TypeVar, type aliases), error handling with exception chaining, custom context managers, dataclasses with validation, generators for streaming large data, and concurrency (threading vs multiprocessing vs asyncio). Use this skill whenever writing or reviewing Python code for ToratNetz, KAIRON backend, embedding pipelines, or ML workflows; when the user says "Python", "type hints", "protocol", "dataclass", "async", "generator", or "asyncio"; and when python-reviewer agent is about to run. Companion to rules/python/coding-style.md — the rules file has the PEP 8 basics, this skill has the idiomatic patterns that make code reviewable.
---

# Python Development Patterns

Advanced Pythonic patterns for robust, type-safe, and performant code. For PEP 8 basics, naming, imports, and formatting see `rules/python/coding-style.md`.

## When to Use

- Writing new Python modules (ToratNetz, KAIRON backend, embeddings)
- Reviewing Python code via python-reviewer agent
- Designing data models, async pipelines, or ML workflows

## Modern Type Hints (Python 3.9+)

```python
# Use built-in generics (3.9+), not typing module
def process_items(items: list[str]) -> dict[str, int]:
    return {item: len(item) for item in items}

# Union with pipe syntax (3.10+)
def parse(data: str | bytes) -> dict[str, object]:
    ...
```

### TypeVar and Generics

```python
from typing import TypeVar

T = TypeVar('T')

def first(items: list[T]) -> T | None:
    return items[0] if items else None
```

### Protocol-Based Duck Typing

```python
from typing import Protocol

class Repository(Protocol):
    def find_by_id(self, id: str) -> dict | None: ...
    def save(self, entity: dict) -> dict: ...

# Any class implementing these methods satisfies the Protocol
# No inheritance required — structural subtyping
```

### Type Alias for Complex Types

```python
from typing import Union, Any

JSON = Union[dict[str, Any], list[Any], str, int, float, bool, None]
EmbeddingVector = list[float]
BatchResult = list[tuple[str, EmbeddingVector | None]]
```

## Error Handling

### Exception Chaining (preserve traceback)

```python
def load_config(path: str) -> Config:
    try:
        with open(path) as f:
            return Config.from_json(f.read())
    except FileNotFoundError as e:
        raise ConfigError(f"Config not found: {path}") from e
    except json.JSONDecodeError as e:
        raise ConfigError(f"Invalid JSON in config: {path}") from e
```

### Custom Exception Hierarchy

```python
class AppError(Exception):
    """Base exception for all application errors."""

class ValidationError(AppError):
    """Input validation failed."""

class NotFoundError(AppError):
    """Requested resource not found."""
```

## Context Managers

### Custom with contextmanager

```python
from contextlib import contextmanager

@contextmanager
def timer(name: str):
    start = time.perf_counter()
    yield
    elapsed = time.perf_counter() - start
    logging.info(f"{name} took {elapsed:.4f}s")
```

### Class-Based (for resources needing cleanup)

```python
class DatabaseTransaction:
    def __init__(self, connection):
        self.connection = connection

    def __enter__(self):
        self.connection.begin_transaction()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            self.connection.commit()
        else:
            self.connection.rollback()
        return False  # Don't suppress exceptions
```

## Dataclasses

### With Validation

```python
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class EmbeddingRequest:
    text: str
    model: str
    dimensions: int = 1536

    def __post_init__(self):
        if not self.text.strip():
            raise ValueError("Text cannot be empty")
        if self.dimensions not in (256, 1024, 1536):
            raise ValueError(f"Invalid dimensions: {self.dimensions}")
```

### Frozen (Immutable)

```python
@dataclass(frozen=True)
class ChunkMetadata:
    source: str
    page: int
    total_tokens: int
```

## Generators for Large Data

```python
from typing import Iterator

def read_chunks(path: str, chunk_size: int = 1024) -> Iterator[str]:
    """Yield chunks without loading entire file into memory."""
    with open(path) as f:
        while chunk := f.read(chunk_size):
            yield chunk

def batch_embeddings(texts: list[str], batch_size: int = 32) -> Iterator[list[str]]:
    """Yield batches for efficient API calls."""
    for i in range(0, len(texts), batch_size):
        yield texts[i:i + batch_size]
```

## Concurrency Summary

| Pattern | Use When | Module |
|---------|----------|--------|
| `threading` / `ThreadPoolExecutor` | I/O-bound (HTTP, file, DB) | `concurrent.futures` |
| `multiprocessing` / `ProcessPoolExecutor` | CPU-bound (math, parsing) | `concurrent.futures` |
| `asyncio` / `async`+`await` | Many concurrent I/O ops (FastAPI, aiohttp) | `asyncio` |

### Async Pattern

```python
import asyncio

async def fetch_embeddings(texts: list[str]) -> list[list[float]]:
    tasks = [get_embedding(text) for text in texts]
    return await asyncio.gather(*tasks, return_exceptions=True)
```

### ThreadPool for Sync I/O

```python
from concurrent.futures import ThreadPoolExecutor

def fetch_all_pages(urls: list[str]) -> list[str]:
    with ThreadPoolExecutor(max_workers=10) as pool:
        return list(pool.map(fetch_page, urls))
```

## Performance Idioms

| Idiom | Why |
|-------|-----|
| `"".join(parts)` not `+=` in loops | O(n) vs O(n^2) string building |
| `__slots__` on data-heavy classes | Reduces memory per instance |
| Generator expressions over list comprehensions for large data | Lazy evaluation, constant memory |
| `pathlib.Path` over `os.path` | Cleaner API, method chaining |
| `enumerate(items)` not `range(len(items))` | Pythonic index-element iteration |

## Anti-Patterns

| Anti-Pattern | Fix |
|---|---|
| `def f(x=[])` mutable default | `def f(x=None)` then `x = x or []` |
| `type(obj) == list` | `isinstance(obj, list)` |
| `value == None` | `value is None` |
| `from module import *` | Explicit imports only |
| Bare `except: pass` | Catch specific exceptions, log error |
| `eval()` / `exec()` with user input | Never — use safe parsing |

## Integration

- **Agent**: python-reviewer (primary), feniks (Python TDD)
- **Rules**: `rules/python/coding-style.md` (PEP 8 basics), `rules/python/patterns.md` (Protocol, dataclasses, generators)
- **Companion skill**: `python-testing.md` for pytest patterns

## no_context Application

Never assumes Python API signatures or library behavior. When reviewing unfamiliar APIs, uses almanak agent + Context7 to fetch current documentation. Traces all data flows from external input through processing to output.
