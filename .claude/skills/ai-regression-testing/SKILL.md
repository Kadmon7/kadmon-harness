---
name: ai-regression-testing
description: Regression testing strategies for AI-assisted development — sandbox-mode API testing without DB dependencies, automated bug-check workflows, and test patterns that catch the predictable blind spots created when the same model writes and reviews code. Use this skill whenever an AI agent has modified API routes or backend logic, after a bug was found and fixed, when adding tests to a project that has a sandbox/mock mode, when running a `bug-check` workflow, when there are multiple code paths (sandbox vs production, feature flags), or when the user says "regression test", "bug check", "sandbox/production parity", "AI blind spot", "prevent re-introduction", or "the agent keeps making the same mistake". Do NOT use for greenfield testing (use `tdd-workflow`) or for end-to-end browser tests (use `e2e-testing`).
---

# AI Regression Testing

Testing patterns specifically for AI-assisted development, where the same model writes code *and* reviews it — creating predictable blind spots that only automated tests can catch.

## When to Activate

- An AI agent has modified API routes or backend logic
- A bug was found and fixed — need to prevent re-introduction
- The project has a sandbox/mock mode that can be leveraged for DB-free testing
- Running a bug-check or similar review command after code changes
- Multiple code paths exist (sandbox vs production, feature flags, branched logic)

## The Core Problem

When an AI writes code and then reviews its own work, it carries the same assumptions into both steps. The result is a predictable failure pattern:

```
AI writes fix → AI reviews fix → AI says "looks correct" → Bug still exists
```

A real example observed in production:

```
Fix 1: Added notification_settings to API response
  → Forgot to add it to the SELECT query
  → AI reviewed and missed it (same blind spot)

Fix 2: Added it to SELECT query
  → TypeScript build error (column not in generated types)
  → AI reviewed Fix 1 but didn't catch the SELECT issue

Fix 3: Changed to SELECT *
  → Fixed production path, forgot sandbox path
  → AI reviewed and missed it AGAIN

Fix 4: Test caught it instantly on first run. PASS.
```

The lesson: **sandbox/production path inconsistency** is the #1 AI-introduced regression. Automated tests catch it deterministically; AI self-review doesn't.

## Sandbox-Mode API Testing

Most projects with AI-friendly architecture have a sandbox or mock mode. This is the key to fast, DB-free API testing.

### Setup (Vitest + Next.js App Router — TypeScript)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/**/*.test.ts'],
    setupFiles: ['__tests__/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

### Setup (pytest + FastAPI — Python)

```ini
# pytest.ini
[pytest]
testpaths = tests
python_files = test_*.py
addopts = -ra --strict-markers
markers =
    regression: regression tests for previously-found bugs
    sandbox: sandbox-mode API tests (no DB)
```

```python
# tests/conftest.py
import os
import pytest

@pytest.fixture(autouse=True)
def sandbox_env(monkeypatch):
    monkeypatch.setenv("SANDBOX_MODE", "true")
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "")
```

```typescript
// __tests__/setup.ts
process.env.SANDBOX_MODE = 'true'
process.env.NEXT_PUBLIC_SUPABASE_URL = ''
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''
```

### Test Helper for Next.js API Routes

```typescript
// __tests__/helpers.ts
import { NextRequest } from 'next/server'

export function createTestRequest(
  url: string,
  options?: {
    method?: string
    body?: Record<string, unknown>
    headers?: Record<string, string>
    sandboxUserId?: string
  },
): NextRequest {
  const { method = 'GET', body, headers = {}, sandboxUserId } = options ?? {}
  const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`
  const reqHeaders: Record<string, string> = { ...headers }

  if (sandboxUserId) reqHeaders['x-sandbox-user-id'] = sandboxUserId

  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: reqHeaders,
  }

  if (body) {
    init.body = JSON.stringify(body)
    reqHeaders['content-type'] = 'application/json'
  }

  return new NextRequest(fullUrl, init)
}

export async function parseResponse(response: Response) {
  const json = await response.json()
  return { status: response.status, json }
}
```

### Writing Regression Tests

The key principle: **write tests for bugs that were found, not for code that works.**

```typescript
// __tests__/api/user/profile.test.ts
import { describe, it, expect } from 'vitest'
import { createTestRequest, parseResponse } from '../../helpers'
import { GET } from '@/app/api/user/profile/route'

const REQUIRED_FIELDS = [
  'id', 'email', 'full_name', 'phone', 'role',
  'created_at', 'avatar_url',
  'notification_settings',  // ← added after the bug introduced it as missing
]

describe('GET /api/user/profile', () => {
  it('returns all required fields', async () => {
    const req = createTestRequest('/api/user/profile')
    const res = await GET(req)
    const { status, json } = await parseResponse(res)

    expect(status).toBe(200)
    for (const field of REQUIRED_FIELDS) {
      expect(json.data).toHaveProperty(field)
    }
  })

  // Regression test — the exact bug AI introduced 4 times
  it('notification_settings is not undefined (BUG-R1 regression)', async () => {
    const req = createTestRequest('/api/user/profile')
    const res = await GET(req)
    const { json } = await parseResponse(res)

    expect('notification_settings' in json.data).toBe(true)
    const ns = json.data.notification_settings
    expect(ns === null || typeof ns === 'object').toBe(true)
  })
})
```

### Sandbox/Production Parity Tests

The most common AI regression: fixing the production path but forgetting the sandbox path (or vice versa).

```typescript
describe('GET /api/user/messages (conversation list)', () => {
  it('includes partner_name in sandbox mode', async () => {
    const req = createTestRequest('/api/user/messages', { sandboxUserId: 'user-001' })
    const res = await GET(req)
    const { json } = await parseResponse(res)

    if (json.data.length > 0) {
      for (const conv of json.data) {
        expect('partner_name' in conv).toBe(true)
      }
    }
  })
})
```

## Bug-Check Workflow Integration

Wire the tests into a custom `bug-check` command that runs **before** any AI review:

```markdown
# bug-check (custom command)

## Step 1 — Automated tests (mandatory, cannot skip)
Run these FIRST, before any code review. Toolchain resolves at runtime via `detect-project-language.ts` (ADR-020):

  # TypeScript
  npm run test
  npm run build

  # Python (no build step — typecheck replaces it)
  pytest
  mypy .

- If tests fail → report as highest-priority bug
- If build/typecheck fails → report type errors as highest-priority
- Only proceed to Step 2 if both pass

## Step 2 — AI code review
Focus on: sandbox/production parity, response shape vs frontend, SELECT completeness,
error handling with rollback, optimistic update race conditions.

## Step 3 — For each bug fixed, propose a regression test
```

The flow:

```
User: /bug-check
  ├─ Step 1: npm run test
  │   ├─ FAIL → bug found mechanically (no AI judgment needed)
  │   └─ PASS → continue
  ├─ Step 2: npm run build
  │   ├─ FAIL → type error found mechanically
  │   └─ PASS → continue
  ├─ Step 3: AI review with known blind spots in mind
  └─ Step 4: write a regression test for each fix
```

## Common AI Regression Patterns

### Pattern 1 — Sandbox/Production Path Mismatch (most common)

```typescript
// FAIL — AI adds field to production path only
if (isSandboxMode()) {
  return { data: { id, email, name } }   // missing new field
}
return { data: { id, email, name, notification_settings } }

// PASS — both paths return the same shape
if (isSandboxMode()) {
  return { data: { id, email, name, notification_settings: null } }
}
return { data: { id, email, name, notification_settings } }
```

### Pattern 2 — SELECT Clause Omission

```typescript
// FAIL — new column added to response but not to SELECT
const { data } = await supabase.from('users').select('id, email, name').single()
return { data: { ...data, notification_settings: data.notification_settings } }
//                                                    ^^^^^^^^^^^^^^^^^^^^^^^ always undefined

// PASS — SELECT * or explicitly include the new column
const { data } = await supabase.from('users').select('*').single()
```

### Pattern 3 — Error State Leakage

```typescript
// FAIL — error state set but old data not cleared
catch (err) {
  setError('Failed to load')
  // reservations still shows data from previous tab!
}

// PASS — clear related state on error
catch (err) {
  setReservations([])
  setError('Failed to load')
}
```

### Pattern 4 — Optimistic Update Without Rollback

```typescript
// FAIL — no rollback on failure
const handleRemove = async (id: string) => {
  setItems(prev => prev.filter(i => i.id !== id))
  await fetch(`/api/items/${id}`, { method: 'DELETE' })
  // if API fails, item is gone from UI but still in DB
}

// PASS — capture previous state and roll back on failure
const handleRemove = async (id: string) => {
  const prev = [...items]
  setItems(curr => curr.filter(i => i.id !== id))
  try {
    const res = await fetch(`/api/items/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('API error')
  } catch {
    setItems(prev)
    alert('Removal failed')
  }
}
```

## Strategy — Test Where Bugs Were Found

Don't aim for 100% coverage. Instead:

```
Bug found in /api/user/profile     → Write test for profile API
Bug found in /api/user/messages    → Write test for messages API
Bug found in /api/user/favorites   → Write test for favorites API
No bug in /api/user/notifications  → Don't write test (yet)
```

Why this works with AI development:

1. AI tends to make the **same category of mistake** repeatedly
2. Bugs cluster in complex areas (auth, multi-path logic, state management)
3. Once tested, that exact regression **cannot happen again**
4. Test count grows organically with bug fixes — no wasted effort

## Quick Reference

| AI Regression Pattern | Test Strategy | Priority |
|---|---|---|
| Sandbox/production mismatch | Assert same response shape across modes | High |
| SELECT clause omission | Assert all required fields in response | High |
| Error state leakage | Assert state cleanup on error | Medium |
| Missing rollback | Assert state restored on API failure | Medium |
| Type cast masking null | Assert field is not undefined | Medium |

## DO / DON'T

**DO**

- Write tests immediately after finding a bug (before fixing it if possible)
- Test the API response shape, not the implementation
- Run tests as the first step of every bug-check
- Keep tests fast (<1s total with sandbox mode)
- Name tests after the bug they prevent (e.g. `BUG-R1 regression`)

**DON'T**

- Write tests for code that has never had a bug
- Trust AI self-review as a substitute for automated tests
- Skip sandbox path testing because "it's just mock data"
- Write integration tests when unit tests suffice
- Aim for a coverage percentage — aim for regression prevention

## Integration

- **feniks agent** (sonnet) — primary owner. feniks enforces TDD and the red-green-refactor cycle; this skill is the regression-specific complement that catches bugs which only show up when an AI both writes and reviews the code.
- **eval-harness skill** — sibling. `eval-harness` defines pass/fail for **feature completion** (EDD); `ai-regression-testing` is the lighter-weight regression layer that runs every commit. Use both: eval-harness gates new features, ai-regression-testing keeps known bugs dead.
- **tdd-workflow skill** — complementary. TDD prevents new bugs by writing tests first; this skill prevents known bugs by writing tests after they're found. Different timing, same idea.
- **/abra-kdabra command** — entry point. When feniks runs in `needs_tdd` mode, it can load this skill alongside `tdd-workflow` for AI-specific blind spots.

## no_context Application

A regression test must encode the *exact* defect the bug exhibited, not a paraphrase. Before writing `expect(json.data).toHaveProperty('notification_settings')`, verify by reading the buggy commit that the field really was missing from the response — don't trust the bug report's summary. The test must fail on the buggy code and pass on the fix; if it doesn't fail on the buggy code, it's testing something else and won't catch a real regression. The `no_context` principle here means: every regression test traces back to a specific defect that has been reproduced.
