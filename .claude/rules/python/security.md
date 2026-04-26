---
alwaysApply: false
globs: ["**/*.py", "**/*.pyi"]
---
# Python Security

> This file extends [common/security.md](../common/security.md) with Python-specific content.

## Secret Management

MUST use environment variables for all credentials:

```python
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ["API_KEY"]  # Raises KeyError if missing
```

NEVER hardcode secrets in source code. MUST fail fast on missing required env vars.

## Input Validation

- MUST use **Pydantic** for API request validation (FastAPI) or manual validation with type guards
- NEVER trust user input -- validate and sanitize at system boundaries
- NEVER use `eval()`, `exec()`, or `__import__()` with user-controlled input

## Subprocess Safety

- MUST use list arguments with `subprocess.run()`, NEVER `shell=True` with user input
- PREFER `subprocess.run(["cmd", "arg1"])` over `os.system("cmd arg1")`

## Deserialization

- MUST use `yaml.safe_load()`, NEVER `yaml.load()` without SafeLoader
- MUST use `json.loads()` for JSON, NEVER `eval()` on JSON strings
- NEVER use `pickle.loads()` on untrusted data

## Security Scanning

- MUST use **bandit** for static security analysis:
  ```bash
  bandit -r src/ -ll
  ```

## Enforcement

- python-reviewer agent checks Security (CRITICAL) items on all .py edits
- spektr agent auto-invoked for code touching auth, API keys, user input, exec/spawn
- bandit runs as part of python-reviewer diagnostic workflow
- post-edit-security hook runs `bandit -ll` on .py edits (warn-only; exits cleanly when bandit is not installed)
