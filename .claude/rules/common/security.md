---
alwaysApply: true
---

# Security Rules

## Secrets
- NEVER commit secrets, API keys, or tokens to git
- NEVER log sensitive data (tokens, passwords, personal info)
- MUST use environment variables for all credentials
- MUST ensure .gitignore includes: .env, .env.*, *.db, credentials files

## Input
- ALWAYS validate and sanitize external input with Zod
- NEVER use eval() or Function() constructor
- NEVER use string concatenation for SQL queries — ALWAYS use parameterized queries
- MUST validate file paths before file operations (prevent path traversal)

## Commands
- PREFER execFileSync over execSync (prevents command injection)
- MUST use argument arrays, never string interpolation for commands
- NEVER pass user input directly to shell commands

## Dependencies
- MUST run `npm audit` periodically
- MUST review new dependencies before adding them