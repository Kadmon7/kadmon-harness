---
name: python-testing
description: Python testing patterns with pytest — fixtures (scopes, autouse, parameterized), async testing (pytest-asyncio), advanced mocking (autospec, PropertyMock, context managers), side effects (tmp_path), and coverage. Companion to rules/python/testing.md.
---

# Python Testing Patterns

Advanced pytest patterns for robust test suites. For basics (markers, parametrize, assertions) see `rules/python/testing.md`.

## When to Use

- Writing Python tests (ToratNetz, KAIRON backend, embedding pipelines)
- Reviewing Python test quality via python-reviewer agent
- Setting up pytest infrastructure for new Python projects

## Fixtures

### Scopes

```python
# Function scope (default) — runs for each test
@pytest.fixture
def temp_file():
    with open("temp.txt", "w") as f:
        yield f
    os.remove("temp.txt")

# Module scope — runs once per module
@pytest.fixture(scope="module")
def module_db():
    db = Database(":memory:")
    db.create_tables()
    yield db
    db.close()

# Session scope — runs once per entire test session
@pytest.fixture(scope="session")
def shared_resource():
    resource = ExpensiveResource()
    yield resource
    resource.cleanup()
```

### Parameterized Fixtures

```python
@pytest.fixture(params=["sqlite", "postgresql"])
def db(request):
    """Test runs once per database backend."""
    if request.param == "sqlite":
        return Database(":memory:")
    elif request.param == "postgresql":
        return Database("postgresql://localhost/test")
```

### Autouse Fixtures

```python
@pytest.fixture(autouse=True)
def reset_config():
    """Automatically runs before every test in this module."""
    Config.reset()
    yield
    Config.cleanup()
```

### Conftest.py for Shared Fixtures

```python
# tests/conftest.py
@pytest.fixture
def client():
    app = create_app(testing=True)
    with app.test_client() as client:
        yield client

@pytest.fixture
def auth_headers(client):
    response = client.post("/api/login", json={
        "username": "test", "password": "test"
    })
    token = response.json["token"]
    return {"Authorization": f"Bearer {token}"}
```

## Mocking

### Autospec (catches API misuse)

```python
@patch("mypackage.DBConnection", autospec=True)
def test_autospec(db_mock):
    """Fails if DBConnection doesn't actually have the called method."""
    db = db_mock.return_value
    db.query("SELECT * FROM users")
    db_mock.assert_called_once()
```

### PropertyMock

```python
@pytest.fixture
def mock_config():
    config = Mock()
    type(config).debug = PropertyMock(return_value=True)
    type(config).api_key = PropertyMock(return_value="test-key")
    return config

def test_with_mock_config(mock_config):
    assert mock_config.debug is True
    assert mock_config.api_key == "test-key"
```

### Mocking Context Managers

```python
from unittest.mock import mock_open

@patch("builtins.open", new_callable=mock_open)
def test_file_reading(mock_file):
    mock_file.return_value.read.return_value = "file content"
    result = read_file("test.txt")
    mock_file.assert_called_once_with("test.txt", "r")
    assert result == "file content"
```

### Mocking Exceptions

```python
@patch("mypackage.api_call")
def test_api_error_handling(api_call_mock):
    api_call_mock.side_effect = ConnectionError("Network error")
    with pytest.raises(ConnectionError):
        api_call()
    api_call_mock.assert_called_once()
```

## Async Testing

### pytest-asyncio

```python
import pytest

@pytest.mark.asyncio
async def test_async_function():
    result = await async_fetch_embedding("hello world")
    assert len(result) == 1536

@pytest.mark.asyncio
async def test_async_with_fixture(async_client):
    response = await async_client.get("/api/embeddings")
    assert response.status_code == 200
```

### Async Fixtures

```python
@pytest.fixture
async def async_client():
    app = create_app()
    async with app.test_client() as client:
        yield client
```

### Mocking Async Functions

```python
@pytest.mark.asyncio
@patch("mypackage.async_api_call")
async def test_async_mock(api_call_mock):
    api_call_mock.return_value = {"status": "ok"}
    result = await my_async_function()
    api_call_mock.assert_awaited_once()
    assert result["status"] == "ok"
```

## Testing Side Effects

### tmp_path (preferred)

```python
def test_with_tmp_path(tmp_path):
    test_file = tmp_path / "test.txt"
    test_file.write_text("hello world")

    result = process_file(str(test_file))
    assert result == "hello world"
    # tmp_path automatically cleaned up by pytest
```

### Testing Exception Attributes

```python
def test_exception_with_details():
    with pytest.raises(CustomError) as exc_info:
        raise CustomError("error", code=400)

    assert exc_info.value.code == 400
    assert "error" in str(exc_info.value)
```

## DO / DON'T

| DO | DON'T |
|----|-------|
| Follow TDD: red-green-refactor | Test implementation details |
| Test one behavior per test | Use complex conditionals in tests |
| Use descriptive names: `test_user_login_with_invalid_credentials_fails` | Ignore test failures |
| Use fixtures to eliminate duplication | Share mutable state between tests |
| Mock external dependencies only | Test third-party library internals |
| Test edge cases: None, empty, boundary | Catch exceptions in tests (use `pytest.raises`) |
| Aim for 80%+ coverage on critical paths | Write overly brittle assertions |
| Keep tests fast; mark slow tests | Use `print()` for debugging (use `pytest -s` or assertions) |

## Quick Reference

| Pattern | Usage |
|---------|-------|
| `pytest.raises(ValueError, match="msg")` | Test expected exceptions |
| `@pytest.fixture(scope="module")` | Control fixture lifecycle |
| `@pytest.fixture(params=[...])` | Run fixture with multiple values |
| `@pytest.fixture(autouse=True)` | Auto-run without explicit request |
| `@patch("module.Class", autospec=True)` | Mock with API safety |
| `PropertyMock` | Mock class properties |
| `tmp_path` fixture | Automatic temp directory |
| `@pytest.mark.asyncio` | Test async functions |
| `assert_awaited_once()` | Verify async mock was awaited |

## Integration

- **Agent**: python-reviewer (review), feniks (TDD execution on Python projects)
- **Rules**: `rules/python/testing.md` (basics: markers, parametrize, coverage)
- **Companion skill**: `python-patterns.md` for coding patterns

## no_context Application

Before writing tests, reads the existing code to understand actual interfaces. Never tests against imagined APIs. When reviewing unfamiliar test libraries, uses almanak + Context7 for current documentation.
