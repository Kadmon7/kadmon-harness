# ADR-002: No Bash Scripts, No Python

## Status
Accepted

## Context
ECC uses .sh scripts and a Python CLI (instinct-cli.py) for some functionality. These are fragile on Windows.

## Decision
All hooks and scripts are Node.js only. All temp files use `os.tmpdir()`. No `/tmp/` literals. No `.sh` files. No Python dependencies. This is a Windows-native system.

## Consequences
- All hooks run reliably on Windows without WSL
- instinct-cli.py functionality rewritten in TypeScript
- Shell-based continuous learning scripts rewritten as Node.js
- No dependency on Python runtime
