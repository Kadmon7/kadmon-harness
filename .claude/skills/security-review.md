---
name: security-review
description: Security vulnerability checklist — injection, secrets, auth bypass, unsafe exec, input validation. Use this skill whenever reviewing code that handles authentication, API keys, user input, exec/spawn calls, file paths, SQL queries, or environment variables. Also use when the security-reviewer agent is invoked, when implementing crypto or token handling, or when the user mentions "security", "vulnerability", "secrets", "injection", or "OWASP". Even simple input handling benefits from this checklist.
---

# Security Review

Systematic security checklist for TypeScript/Node.js code.

## When to Use
- Reviewing code that handles user input
- Working with API keys, tokens, or secrets
- Modifying Claude Code hooks
- Before deploying

## How It Works

### Checklist
1. **Secrets** — No hardcoded keys/tokens in code
2. **Input validation** — All external input validated with Zod
3. **SQL injection** — Parameterized queries only
4. **Command injection** — Use execFile with argument arrays
5. **Path traversal** — Validate file paths
6. **Dependencies** — npm audit
7. **Error messages** — No stack traces exposed
8. **Prompt injection** — AI-facing inputs sanitized

## Examples

### Safe SQL in sql.js
```typescript
// Bad: db.exec(`SELECT * FROM sessions WHERE id = '${input}'`);
// Good: db.prepare('SELECT * FROM sessions WHERE id = ?').get(input);
```

### Safe command execution
```typescript
// Bad: execSync('git log ' + userBranch);
// Good: execFileSync('git', ['log', userBranch]);
```

## no_context Application
Security review traces every input path from external sources to internal usage.