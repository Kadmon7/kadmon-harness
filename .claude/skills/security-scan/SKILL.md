---
name: security-scan
description: Scan the local `.claude/` directory for security misconfigurations, injection risks, and supply-chain issues — permissions allow-lists, hook command injection, MCP server risks, agent tool overreach, CLAUDE.md prompt-injection vectors. Use this skill whenever auditing harness configuration before a commit, onboarding into a repo with an existing `.claude/` tree, after editing `settings.json` / `CLAUDE.md` / `.mcp.json` / `hooks/`, when the user says "scan my config", "is my claude code safe", "audit .claude", "check permissions", "any security issues in the harness", or as part of periodic hygiene. Do NOT trigger for runtime code vulnerabilities — that's `security-review` — or for generic npm audit (use `npm audit` directly).
---

# Security Scan

Audit the local `.claude/` configuration for security issues without depending on an external scanner. Complements `security-review` (code-level) — this skill targets **config surface**.

## When to Activate

- Before committing changes to `settings.json`, `CLAUDE.md`, `.mcp.json`, or hook scripts
- Onboarding into a repo that already has a `.claude/` tree — treat it as untrusted
- After adding a new agent, skill, or hook — verify it doesn't widen attack surface
- Periodic hygiene (monthly, or after 20+ settings edits)
- When `/medik` reports unexpected hook activity

## What This Skill Scans

| Surface | File | Checks |
|---|---|---|
| Permissions | `settings.json`, `settings.local.json` | Overly permissive `Bash(*)`, missing `deny` list, dangerous bypass flags, `--no-verify` tolerance |
| Prompt surface | `CLAUDE.md`, `agents/*.md` | Auto-run instructions, implicit shell commands, unbounded "always do X" directives, prompt-injection vectors |
| MCP servers | `.mcp.json` | `npx -y` auto-install, hardcoded env secrets, shell-running MCPs, missing descriptions |
| Hook scripts | `.claude/hooks/scripts/*.js` | Command injection via `${var}` interpolation, silent error suppression (`2>/dev/null`, `\|\| true`), missing `try/catch`, eval/exec with user input |
| Agent definitions | `.claude/agents/*.md` | Agents with unrestricted tool access, missing model specification, tools that exceed the agent's charter |

## Method

### Phase 1 — Inventory the surface

```bash
# Everything the scan touches
ls .claude/settings*.json
ls .claude/agents/*.md
ls .claude/hooks/scripts/*.js
cat .claude/.mcp.json 2>/dev/null || echo "no MCP config"
wc -l CLAUDE.md
```

Note which files exist. A missing file is sometimes the finding (e.g., no deny list in `settings.json`).

### Phase 2 — Pattern scan with grep

Run these focused searches. Each is cheap; together they cover the most common defects.

```bash
# 1. Unrestricted Bash in allow list
grep -n '"Bash(\*)"' .claude/settings*.json

# 2. Hardcoded secrets in config
grep -nE '(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16})' .claude/

# 3. Command injection risk in hooks (shell interpolation on unvalidated input)
grep -nE 'exec\(|spawn\(|execSync\(|`\$\{' .claude/hooks/scripts/*.js

# 4. Silent error suppression in hooks
grep -nE '2>/dev/null|\|\| true|catch.*{}\s*$' .claude/hooks/scripts/*.js

# 5. Auto-run instructions in CLAUDE.md (prompt injection)
grep -nE '(always|automatically|without asking) (run|execute|commit|push)' CLAUDE.md

# 6. Shell-running or auto-install MCPs
grep -nE '"command": ("sh"|"bash"|"npx -y")' .claude/.mcp.json 2>/dev/null

# 7. Agents without model specification
for f in .claude/agents/*.md; do
  head -20 "$f" | grep -q "^model:" || echo "MISSING model: $f"
done
```

### Phase 3 — Classify findings

| Severity | Meaning | Examples |
|---|---|---|
| **CRITICAL** | Actively exploitable or leaks secrets | Hardcoded API key, `Bash(*)` in allow list, command injection in hook |
| **HIGH** | Widens attack surface significantly | Auto-run instruction in CLAUDE.md, missing deny list, agent with unrestricted tool access |
| **MEDIUM** | Defense-in-depth gap | Silent error suppression in hook, MCP without description, `npx -y` auto-install |
| **LOW** | Hygiene / clarity issue | Agent missing model frontmatter, unused permission entry |

### Phase 4 — Report

For each finding:

```
[SEVERITY] <short title>
File: <path>:<line>
Evidence: <grep match or file excerpt>
Impact: <one sentence on what this enables>
Fix: <smallest change that removes the issue>
```

Never fix automatically. Hand findings to the user with a suggested diff; they approve each one.

## Reference Files Cheat Sheet

| If you edit… | You should re-scan… |
|---|---|
| `settings.json` permissions | Phase 2 checks 1, 6 |
| `CLAUDE.md` directives | Phase 2 check 5 |
| A hook script | Phase 2 checks 3, 4 |
| An agent definition | Phase 2 check 7 + tool list vs charter |
| `.mcp.json` | Phase 2 checks 2, 6 |

## Optional — External Scanner

If the harness has network access and the user wants a deeper automated pass, an external scanner can run the same checks with a bundled rule set. Treat it as complementary — its output still needs human review against this checklist before committing changes.

## Integration

- **spektr agent** (opus) — primary owner. spektr is the harness's security specialist; this skill is the config-surface variant of its work (as opposed to `safety-guard`, which targets runtime code). When the user asks to audit `.claude/`, spektr runs this skill's phases and produces the severity-ranked report.
- **config-protection hook** — complementary. The `config-protection` hook blocks *accidental* edits to critical config files; `security-scan` audits the current state of those files for defects. Defense in depth: hook prevents regressions, scan finds pre-existing issues.
- **/medik command** — entry point. `/medik` runs 8 health checks; spektr can load this skill during the agent-analysis phase to add a security lens to the harness-health report.
- **Related skills**: `security-review` (runtime code), `safety-guard` (agent-level guardrails). Load together when auditing a repo end-to-end.

## no_context Application

Every finding must point at a specific file, line, and evidence string. "The permissions look too broad" is not a finding — "settings.json:12 contains `\"Bash(*)\"` in the allow list, which grants unrestricted shell access to any Bash call from Claude" is. If you can't cite the file path and the exact match, the correct action is to re-run the Phase 2 grep and capture the evidence, not to weaken the claim into prose. The `no_context` principle here means: every severity label carries a traceable grep hit behind it.
