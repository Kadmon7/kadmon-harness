# ADR-004: no-context-guard as PreToolUse Hook

## Status
Accepted

## Context
The `no_context` principle ("never invent, never hallucinate") is the core principle of Kadmon Harness. ECC encourages research-before-code via skills but does not enforce it at the tool level.

## Decision
A PreToolUse hook on Write/Edit checks that the target file or its directory was previously Read/Grep/Glob'd in the current session. If no research is found, the hook exits with code 2 (blocking the operation).

Exceptions: test files (*.test.ts, *.spec.ts), markdown files, JSON configs, files already read, files in already-explored directories.

Override: set `KADMON_NO_CONTEXT_GUARD=off` environment variable.

## Consequences
- Claude physically cannot write code without having read related code first
- Strongest possible enforcement of the no_context principle
- May produce false positives on simple edits — exception list mitigates this
- Emergency override available via environment variable
