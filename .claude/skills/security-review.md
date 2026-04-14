---
name: security-review
description: Comprehensive security checklist and patterns for code that handles authentication, user input, secrets, API endpoints, SQL queries, file uploads, or sensitive data — 10-section review covering secrets, input validation, SQL injection, auth/authz, XSS, CSRF, rate limiting, sensitive data exposure, and dependencies. Use this skill whenever reviewing or writing code that adds auth, exposes an API route, accepts user input, touches secrets/credentials, inserts user data into a SQL query, or handles file uploads. Also use whenever the user says "security review", "is this code safe", "check this for vulnerabilities", "OWASP check", "review my auth", or "audit this endpoint". Covers the runtime code surface — use `security-scan` for `.claude/` config and `safety-guard` for agent-level guardrails.
---

# Security Review

Comprehensive code-level security review. Covers the 10 most common attack surfaces for TypeScript/Node.js and Python applications. Every section has a **Fail/Pass** contrast and a **Verification Checklist** you can actually run against a diff.

## When to Activate

- Adding or modifying authentication / authorization
- Accepting user input or file uploads from any source
- Creating or editing an API endpoint
- Touching secrets, credentials, or environment configuration
- Writing or modifying SQL queries (raw or ORM)
- Handling payment flows or sensitive personal data
- Integrating a new third-party API that receives user data
- Reviewing a PR that touches any of the above

This is the runtime code counterpart to `security-scan` (config surface) and `safety-guard` (agent guardrails). When auditing a repo end-to-end, load all three.

## Checklist

### 1. Secrets Management

**Fail** — hardcoded in source:

```typescript
const apiKey = "sk-proj-xxxxx"
const dbPassword = "password123"
```

**Pass** — env vars with startup validation:

```typescript
const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  throw new Error('OPENAI_API_KEY not configured')
}
```

Verify:

- [ ] No hardcoded API keys, tokens, or passwords anywhere in tracked files
- [ ] All secrets sourced from environment variables or a secret manager
- [ ] `.env` / `.env.local` / `*.db` in `.gitignore`
- [ ] No secrets leaked into git history (`git log -S 'api_key'` → no hits)
- [ ] Production secrets stored in the hosting platform, not in the repo

### 2. Input Validation

**Pass** — validate with a schema at every system boundary:

```typescript
import { z } from 'zod'

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).max(150),
})

export async function createUser(input: unknown) {
  const result = CreateUserSchema.safeParse(input)
  if (!result.success) {
    return { success: false, errors: result.error.issues }
  }
  return await db.users.create(result.data)
}
```

File upload validation — enforce size, MIME type, **and** extension:

```typescript
function validateFileUpload(file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error('File too large (max 5MB)')

  const allowedMime = ['image/jpeg', 'image/png', 'image/gif']
  if (!allowedMime.includes(file.type)) throw new Error('Invalid file type')

  const allowedExt = ['.jpg', '.jpeg', '.png', '.gif']
  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0]
  if (!ext || !allowedExt.includes(ext)) throw new Error('Invalid extension')
}
```

Verify:

- [ ] All external input validated with a schema (Zod for TS, Pydantic for Python)
- [ ] File uploads checked on size, MIME, and extension
- [ ] Whitelist validation (not blacklist)
- [ ] Error messages don't echo back unsanitized input
- [ ] Validation runs at the boundary, not deep in business logic

### 3. SQL Injection

**Fail** — string concatenation:

```typescript
const query = `SELECT * FROM users WHERE email = '${userEmail}'`
await db.query(query)
```

**Pass** — parameterized queries:

```typescript
await db.query('SELECT * FROM users WHERE email = $1', [userEmail])

// or via ORM / Supabase client
await supabase.from('users').select('*').eq('email', userEmail)
```

Verify:

- [ ] No string concatenation or template literals building SQL with user data
- [ ] Parameter placeholders (`$1`, `?`, named bindings) used everywhere
- [ ] ORM / query-builder used consistently, not mixed with raw SQL
- [ ] Supabase `rpc()` calls use parameter objects, not interpolated strings

### 4. Authentication & Authorization

**Fail** — tokens in localStorage (XSS-readable):

```typescript
localStorage.setItem('token', token)
```

**Pass** — httpOnly cookies:

```typescript
res.setHeader('Set-Cookie',
  `token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`)
```

Authorization must be checked **before** the sensitive operation:

```typescript
export async function deleteUser(targetId: string, requesterId: string) {
  const requester = await db.users.findUnique({ where: { id: requesterId } })
  if (requester?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  await db.users.delete({ where: { id: targetId } })
}
```

If using Supabase, enable Row Level Security (RLS) on every table:

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own data" ON users FOR SELECT
  USING (auth.uid() = id);
```

Verify:

- [ ] Tokens in httpOnly cookies, never localStorage
- [ ] Authorization checks precede every sensitive operation
- [ ] RLS enabled on all Supabase tables (not a replacement for app-level checks — defense in depth)
- [ ] Role-based access explicit, not inferred
- [ ] Sessions invalidated on logout and password change

### 5. XSS Prevention

Sanitize user-provided HTML with an allowlist:

```typescript
import DOMPurify from 'isomorphic-dompurify'

function renderUserContent(html: string) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p'],
    ALLOWED_ATTR: [],
  })
  return <div dangerouslySetInnerHTML={{ __html: clean }} />
}
```

Verify:

- [ ] Any `dangerouslySetInnerHTML` / `innerHTML` call sanitizes first
- [ ] CSP headers configured on the response
- [ ] React's built-in escaping not bypassed without sanitization
- [ ] User input never concatenated into `eval`, `new Function`, or `setTimeout(string)`

### 6. CSRF Protection

```typescript
export async function POST(request: Request) {
  const token = request.headers.get('X-CSRF-Token')
  if (!csrf.verify(token)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
  }
  // proceed
}
```

Verify:

- [ ] CSRF token or SameSite=Strict cookie on every state-changing request
- [ ] Double-submit cookie pattern if using custom token
- [ ] GET/HEAD handlers never mutate state

### 7. Rate Limiting

```typescript
import rateLimit from 'express-rate-limit'

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
})

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
})

app.use('/api/', apiLimiter)
app.use('/api/search', searchLimiter)
```

Verify:

- [ ] Rate limiting on all public endpoints
- [ ] Stricter limits on expensive operations (search, file upload, password reset)
- [ ] Both IP-based and user-based limits when authenticated
- [ ] 429 responses include `Retry-After` header

### 8. Sensitive Data Exposure

**Fail** — logging secrets and raw errors:

```typescript
console.log('User login:', { email, password })

catch (error) {
  return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 })
}
```

**Pass** — redact on the way in, generic on the way out:

```typescript
console.log('User login:', { email, userId })

catch (error) {
  console.error('Internal error:', error)  // full error server-side only
  return NextResponse.json(
    { error: 'An error occurred. Please try again.' },
    { status: 500 },
  )
}
```

Verify:

- [ ] No passwords, tokens, cards, PII in logs
- [ ] Error responses generic; detailed stack only in server logs
- [ ] No internal hostnames, IPs, or schema names exposed to clients

### 9. Dependency Security

```bash
npm audit
npm audit fix
npm outdated
```

Verify:

- [ ] `npm audit` clean (no high/critical)
- [ ] Lock files (`package-lock.json`, `pnpm-lock.yaml`) committed
- [ ] CI uses `npm ci`, not `npm install`
- [ ] Dependabot or equivalent enabled
- [ ] New dependencies reviewed before adding (source, maintenance, popularity)

### 10. Automated Security Tests

Cover every critical path with at least one test:

```typescript
test('requires authentication', async () => {
  const res = await fetch('/api/protected')
  expect(res.status).toBe(401)
})

test('rejects invalid input', async () => {
  const res = await fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify({ email: 'not-an-email' }),
  })
  expect(res.status).toBe(400)
})

test('enforces rate limits', async () => {
  const requests = Array(101).fill(null).map(() => fetch('/api/endpoint'))
  const responses = await Promise.all(requests)
  expect(responses.some(r => r.status === 429)).toBe(true)
})
```

Verify:

- [ ] Authentication tested (401 on missing token)
- [ ] Authorization tested (403 on insufficient role)
- [ ] Input validation tested (400 on invalid)
- [ ] Rate limiting tested (429 when exceeded)

## Pre-Deployment Security Checklist

Run every item before production deploy. Don't ship until each is checked.

- [ ] Secrets — no hardcoded values; all in env
- [ ] Input validation — all external data validated with a schema
- [ ] SQL — all queries parameterized, no concatenation
- [ ] XSS — user HTML sanitized; CSP headers set
- [ ] CSRF — tokens or SameSite=Strict on state-changing requests
- [ ] Auth — httpOnly cookies; authz checks before sensitive ops
- [ ] Rate limiting — enabled on all public endpoints
- [ ] HTTPS — enforced in production
- [ ] Error handling — no sensitive data in client responses
- [ ] Logging — no secrets; PII redacted
- [ ] Dependencies — `npm audit` clean; lock files committed
- [ ] RLS — enabled on all Supabase tables if applicable
- [ ] CORS — restricted to known origins
- [ ] File uploads — size/MIME/extension validated
- [ ] Tests — auth, authz, validation, rate limit covered

## Integration

- **spektr agent** (opus) — primary owner. spektr is the harness's security specialist; this skill is its code-level checklist (as distinct from `security-scan`, which targets `.claude/` config). When spektr is auto-invoked on code touching auth/keys/exec/paths/SQL, it runs this checklist against the diff.
- **safety-guard skill** — sibling. `safety-guard` covers agent-runtime guardrails (what the agent itself must not do); `security-review` covers application code. Load both when auditing a full-stack repo.
- **`rules/common/security.md`** — the harness's canonical security rules. This skill is the longer-form checklist version of those rules; refer back to the rules file for authoritative "MUST" / "NEVER" statements.
- **/chekpoint command** — entry point. spektr is invoked in Phase 2 of `/chekpoint` when the diff touches any sensitive surface.

## no_context Application

Every finding must cite a specific file and line, and every Pass/Fail claim must be grounded in the diff under review — not in "I remember this pattern from last week". When a checklist item fails, the evidence is the exact line: `src/api/login.ts:42` stores the JWT in `localStorage`. "The auth looks risky" without a file reference is not a finding — it is an impression, and impressions get dismissed. The `no_context` principle applies here with unusual force because security claims without evidence erode trust in all subsequent security claims. When you cannot point to the defect, run the grep or read the file before speaking.

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Web Security Academy](https://portswigger.net/web-security)
- [Supabase Security](https://supabase.com/docs/guides/auth)
