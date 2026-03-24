---
alwaysApply: true
globs: ["**/*.ts"]
---

# TypeScript Security Rules

## Type Safety as Security
- NEVER cast user input to a type without Zod validation first
- MUST use branded types or newtypes for security-sensitive values (e.g., ProjectHash)
- NEVER expose internal error details in user-facing output

## File Operations
- MUST sanitize file paths before any fs operation
- MUST use path.resolve() to prevent path traversal attacks
- NEVER read/write files based solely on user-provided paths without validation

## Data
- MUST sanitize all data before inserting into SQLite
- NEVER store plaintext secrets in SQLite
- MUST use parameterized queries for all SQL operations