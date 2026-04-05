---
alwaysApply: false
globs: ["tests/**/*.py", "**/*test*.py", "**/test_*.py", "**/conftest.py"]
---
# Python Testing

> This file extends [common/testing.md](../common/testing.md) with Python-specific content.

## Framework

MUST use **pytest** as the testing framework. NEVER use unittest directly.

## Coverage

```bash
pytest --cov=src --cov-report=term-missing
```

MUST target 80%+ coverage on new code.

## Test Organization

MUST use `pytest.mark` for test categorization:

```python
import pytest

@pytest.mark.unit
def test_calculate_total():
    ...

@pytest.mark.integration
def test_database_connection():
    ...
```

## Fixtures

- PREFER pytest fixtures over setUp/tearDown methods
- MUST use `conftest.py` for shared fixtures -- NEVER duplicate across test files
- PREFER `tmp_path` fixture over manual temp directory management

## Assertions

- MUST use pytest assertion idioms (`assert x == y`, not `self.assertEqual`)
- MUST use `pytest.raises` for exception testing
- PREFER `pytest.approx` for floating point comparisons

## Parametrize

PREFER `@pytest.mark.parametrize` for testing multiple input variations:

```python
@pytest.mark.parametrize("input,expected", [
    ("hello", "HELLO"),
    ("world", "WORLD"),
])
def test_uppercase(input, expected):
    assert input.upper() == expected
```

## Mocking

- PREFER `unittest.mock.patch` or `pytest-mock` for external dependencies
- MUST mock external APIs, network calls, and file system in unit tests
- PREFER real dependencies in integration tests when practical

## Enforcement

- python-reviewer agent validates test quality on test file edits
- feniks agent enforces red-green-refactor cycle via /ktest command
- pytest coverage reports validate 80%+ target on new code
