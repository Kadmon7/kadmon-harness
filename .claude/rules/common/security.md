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

## Incident Response
- STOP — do not proceed with the current task
- INVOKE spektr agent immediately
- FIX the vulnerability before continuing
- ROTATE any exposed credentials (API keys, tokens, passwords)
- REVIEW — run /kreview on the fix before committing

## Enforcement
- spektr agent auto-invoked for code touching auth, API keys, user input, exec/spawn, file paths, SQL queries
- config-protection hook prevents edits to critical config files (PreToolUse on Edit|Write, exit 2)
- block-no-verify hook prevents bypassing git safety hooks (PreToolUse on Bash, exit 2)
- safety-guard skill provides runtime security guardrails
- spektr agent provides structured security analysis during /checkpoint review phase
- permissions.deny in settings.json blocks Read access to .env, .env.*, and secrets/ files