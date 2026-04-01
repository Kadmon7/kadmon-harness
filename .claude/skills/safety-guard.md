---
name: safety-guard
description: Three-layer safety system — block-no-verify, config-protection, no-context-guard. Use this skill whenever an operation gets blocked by a hook (exit code 2), when trying to understand why an edit was prevented, when onboarding someone to the harness safety mechanisms, or when the user asks "why was my edit blocked?", "how do I bypass this?", or "what does no-context-guard do?". Also consult when designing new hooks that need to block operations safely.
---

# Safety Guard

The safety-guard system enforces the no_context principle and prevents destructive operations
that could lose work, corrupt configuration, or bypass quality gates. It operates through
three enforcement hooks, each with a specific scope and exit code.

## When to Use
- Understanding why a command or edit was blocked
- Reviewing hook safety mechanisms before onboarding a new contributor
- Diagnosing a blocked operation during implementation
- Deciding whether to request a temporary override

---

## Layer 1: block-no-verify

**Script:** `.claude/hooks/block-no-verify.js`
**Trigger:** PreToolUse on Bash
**Exit code:** 2 (hard block — no override)

Blocks any `git` command that includes `--no-verify` or `--no-gpg-sign`. These flags
bypass pre-commit hooks, which are the primary enforcement surface for type checking,
linting, and security guards. Allowing them would silently disable every other safety
layer during a commit.

**Blocked example:**
```bash
git commit --no-verify -m "skip hooks"
```

**Stderr output:**
```json
{"block":true,"message":"--no-verify is blocked by Kadmon safety guard"}
```

**Override:** None. This is intentional by design. If pre-commit hooks are failing,
the correct response is to fix the underlying issue, not to bypass the hooks. See the
`build-error-resolver` agent for compilation errors and `/verify` for quality gate failures.

---

## Layer 2: config-protection

**Script:** `.claude/hooks/config-protection.js`
**Trigger:** PreToolUse on Edit|Write
**Exit code:** 2 (hard block)

Blocks edits to critical configuration files that define the project's quality standards,
type system, and harness settings. Accidental or unauthorized edits to these files can
silently lower standards (e.g., disabling strict mode) without being caught by tests.

**Protected files:**
- `tsconfig.json` — TypeScript strict mode and module resolution
- `eslint.config.js` — Linting rules and code style enforcement
- `package.json` — scripts section guards (build, test, lint pipelines)
- `.claude/settings.json` — Harness permissions, hook wiring, MCP servers
- `vitest.config.ts` — Test runner configuration and coverage thresholds

**Stderr output:**
```json
{"block":true,"message":"config-protection: tsconfig.json is a protected config file"}
```

**Override:** No automatic override. To edit a protected file, the arkitect must
explicitly approve the change. Invoke the `arkitect` agent via `/kplan` to review
and authorize the edit.

---

## Layer 3: no-context-guard

**Script:** `.claude/hooks/no-context-guard.js`
**Trigger:** PreToolUse on Edit|Write
**Exit code:** 2 (hard block)

Blocks any Edit or Write operation on a file that has not been Read in the current session.
This enforces the core no_context principle: you cannot responsibly modify code you have
not read. The hook checks the current session's observations JSONL to verify a prior Read
of the target file path exists.

**Blocked example:**
```
Edit src/lib/state-store.ts  (no prior Read of this file)
```

**Stderr output:**
```json
{"block":true,"message":"no_context: must Read src/lib/state-store.ts before editing"}
```

**Override:** Set the environment variable `KADMON_NO_CONTEXT_GUARD=off` to disable this
hook. Use only in automation pipelines where the file has been verified through an
alternative mechanism. This override exists because CI/CD scripts may generate files
without reading them first — it does NOT exist for interactive development sessions.

---

## Example: no-context-guard in Action

```
❌ BLOCKED:
> Edit src/lib/state-store.ts (without reading it first)
> stderr: {"block":true,"message":"no_context: must Read src/lib/state-store.ts before editing"}

✅ ALLOWED:
> Read src/lib/state-store.ts
> Edit src/lib/state-store.ts (now allowed — file was read)
```

---

## MUST / NEVER Rules

- MUST exit(2) for all safety blocks — exit(1) only warns and allows the operation through
- MUST wrap all hook logic in try/catch — NEVER crash Claude Code on unexpected input
- MUST log errors to stderr as JSON: `{ "error": "..." }`
- NEVER add an override mechanism for block-no-verify — this is an intentional design constraint
- MUST document every override mechanism clearly (env var, arkitect approval, or none)
- MUST complete within < 100ms for no-context-guard; < 500ms for config-protection and block-no-verify

---

## Troubleshooting

**Why was my edit blocked?**
Check stderr for a JSON object with `"block": true` and a `"message"` field. The message
identifies which hook triggered and which file or flag caused the block.

**Why can't I use --no-verify?**
Safety principle: pre-commit hooks are the enforcement surface for type checking, linting,
and security scans. Bypassing them means commits can silently violate quality gates.
If the hooks are failing, fix the root cause — use `/build-fix` or `/verify`.

**How do I edit a protected config file?**
Ask the arkitect to temporarily allow the change via `/kplan`, or follow the `update-config`
skill process. Never attempt to disable config-protection unilaterally.

**How do I disable no-context-guard?**
Set `KADMON_NO_CONTEXT_GUARD=off` in the environment. However, understand WHY it exists:
editing files without reading them first is the most common source of context-free mistakes,
where an AI agent (or a developer) overwrites logic they did not understand. The guard
makes that impossible by default.

---

## no_context Application

The safety-guard system is the no_context principle made physical. Each of the three hooks
corresponds to a failure mode the principle guards against:

| Hook | no_context violation it prevents |
|------|----------------------------------|
| block-no-verify | Bypassing verification without evidence quality gates passed |
| config-protection | Editing quality standards without architectural review |
| no-context-guard | Modifying code without evidence it was read and understood |

When a hook blocks an operation, the correct response is to acquire context — read the file,
run the verification, or consult the arkitect — not to find a workaround.
