---
alwaysApply: true
---

# TypeScript LSP Usage

The LSP tool provides precise code intelligence. Prefer it over Grep/Glob for TypeScript navigation tasks.

## When to Use LSP

| Task | LSP Operation | Instead of |
|------|--------------|------------|
| Find where a function/type is defined | goToDefinition | Grep for "function name" |
| Find all callers of a function | findReferences or incomingCalls | Grep for "functionName(" |
| Check type of a variable or return type | hover | Reading source and inferring |
| List all exports in a file | documentSymbol | Reading the entire file |
| Find who implements an interface | goToImplementation | Grep for "implements X" |
| Understand call chain before refactoring | incomingCalls + outgoingCalls | Manual trace through files |
| Search for a symbol across the project | workspaceSymbol | Glob + Grep combination |

## When to Keep Using Grep

- Searching for string literals, comments, or non-symbol text
- Searching across non-TypeScript files (JSON, MD, JS hooks)
- Pattern matching with regex (LSP only does exact symbols)

## Proactive Usage

- MUST use `findReferences` before renaming or removing any exported function
- MUST use `incomingCalls` before modifying a function's signature
- SHOULD use `hover` when unsure about a variable's type instead of guessing
- SHOULD use `documentSymbol` when exploring an unfamiliar file for the first time
