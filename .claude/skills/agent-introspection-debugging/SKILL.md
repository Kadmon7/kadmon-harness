---
name: agent-introspection-debugging
description: Structured self-debugging workflow for AI agent failures — capture, diagnose, contained recovery, introspection report. Use this skill whenever an agent run is failing repeatedly, consuming tokens without progress, looping on the same tools, drifting from the intended task, hitting max-tool-call limits, or producing degraded output from context overflow. Also use when the user says "the agent is stuck", "stop retrying", "it keeps doing the same thing", "agent loop", "why did this fail", or when mekanik is about to intervene on a failure that is not a compile error. Teaches the agent to debug itself systematically before escalating to a human.
---

# Agent Introspection Debugging

Use this skill when an agent run is failing repeatedly, consuming tokens without progress, looping on the same tools, or drifting away from the intended task.

This is a workflow skill, not a hidden runtime. It teaches the agent to debug itself systematically before escalating to a human.

## When to Activate

- Maximum tool call / loop-limit failures
- Repeated retries with no forward progress
- Context growth or prompt drift that starts degrading output quality
- Filesystem or environment state mismatch between expectation and reality
- Tool failures that are likely recoverable with diagnosis and a smaller corrective action

## Scope Boundaries

Activate this skill for:
- capturing failure state before retrying blindly
- diagnosing common agent-specific failure patterns
- applying contained recovery actions
- producing a structured, human-readable debug report

Do **not** use this skill as the primary source for:
- feature verification after code changes — use `verification-loop`
- TypeScript/Vitest compilation failures — use `systematic-debugging` + `mekanik` agent
- framework-specific debugging when a narrower skill already exists
- runtime promises the current harness cannot actually enforce

## Four-Phase Loop

### Phase 1: Failure Capture

Before trying to recover, record the failure precisely. Blind retries are the most expensive debugging mistake.

Capture:
- error type, message, and stack trace when available
- the last meaningful tool call sequence (last 3-5 calls)
- what the agent was trying to do when it failed
- current context pressure: repeated prompts, oversized pasted logs, duplicated plans, or runaway notes
- current environment assumptions: `cwd`, branch, relevant service state, expected files

Minimum capture template:

```markdown
## Failure Capture
- Session / task:
- Goal in progress:
- Error:
- Last successful step:
- Last failed tool / command:
- Repeated pattern seen:
- Environment assumptions to verify:
```

### Phase 2: Root-Cause Diagnosis

Match the failure to a known pattern **before changing anything**.

| Pattern | Likely cause | Check |
|---|---|---|
| Maximum tool calls / repeated same command | loop or no-exit observer path | inspect the last N tool calls for repetition |
| Context overflow / degraded reasoning | unbounded notes, repeated plans, oversized logs | inspect recent context for duplication and low-signal bulk |
| `ECONNREFUSED` / timeout | service unavailable or wrong port | verify service health, URL, and port assumptions |
| `429` / quota exhaustion | retry storm or missing backoff | count repeated calls and inspect retry spacing |
| File missing after write / stale diff | race, wrong cwd, or branch drift | re-check path, cwd, `git status`, and actual file existence |
| Tests still failing after "fix" | wrong hypothesis | isolate the exact failing test and re-derive the bug |
| Hook exit 2 blocking every edit | no-context-guard triggered | read the target file first; re-check `KADMON_NO_CONTEXT_GUARD` |

Diagnosis questions:
- is this a **logic** failure, **state** failure, **environment** failure, or **policy** failure?
- did the agent lose the real objective and start optimizing the wrong subtask?
- is the failure deterministic or transient?
- what is the smallest reversible action that would validate the diagnosis?

### Phase 3: Contained Recovery

Recover with the smallest action that changes the diagnosis surface. The goal is to move from "stuck" to "one clear next step" — not to fix everything in one shot.

Safe recovery actions:

- stop repeated retries and restate the hypothesis
- trim low-signal context and keep only the active goal, blockers, and evidence
- re-check the actual filesystem / branch / process state
- narrow the task to one failing command, one file, or one test
- switch from speculative reasoning to direct observation (`ls`, `git status`, `cat`)
- escalate to a human when the failure is high-risk or externally blocked

Do **not** claim unsupported auto-healing actions like "reset agent state" or "update harness config" unless you are actually doing them through real tools in the current environment.

Contained recovery checklist:

```markdown
## Recovery Action
- Diagnosis chosen:
- Smallest action taken:
- Why this is safe:
- What evidence would prove the fix worked:
```

### Phase 4: Introspection Report

End with a report that makes the recovery legible to the next agent or human. This is the artifact that survives the session and informs future debugging.

```markdown
## Agent Self-Debug Report
- Session / task:
- Failure:
- Root cause:
- Recovery action:
- Result: success | partial | blocked
- Token / time burn risk:
- Follow-up needed:
- Preventive change to encode later (instinct? rule? hook?):
```

## Recovery Heuristics

Prefer these interventions in order:

1. **Restate the real objective** in one sentence. If you cannot, you have drifted.
2. **Verify the world state** instead of trusting memory. Run `ls`, `git status`, `cat <file>`.
3. **Shrink the failing scope.** One test, one file, one command.
4. **Run one discriminating check.** Not three speculative fixes.
5. Only then **retry**.

**Bad pattern**: retrying the same action three times with slightly different wording.

**Good pattern**: capture → classify → run one direct check → change the plan only if the check supports it.

## Integration

- **mekanik agent** (sonnet) — primary owner. mekanik is the harness's diagnostic agent for build/test failures; this skill gives it a workflow for the class of failures that are not compile errors but agent loops, context drift, or state mismatch.
- **systematic-debugging skill** — sibling skill. `systematic-debugging` applies to code bugs (4 phases: root cause → pattern → hypothesis → implementation). `agent-introspection-debugging` applies to **agent runtime failures**. When you can't tell which applies, start with this one: if the diagnosis reveals a code bug, hand off to `systematic-debugging`.
- **verification-loop skill** — use after recovery if code was changed during the contained recovery action.
- **continuous-learning-v2 skill** — when a failure pattern recurs across multiple sessions, promote it to an instinct via `/forge` so the harness catches the next occurrence.
- **/medik command** — if the failure is a harness health issue (stale `dist/`, broken hooks, corrupt DB), escalate via `/medik` instead of hand-fixing.

## no_context Application

A failed agent run is an accusation, not an explanation. The `no_context` principle applies here literally: before claiming "the agent looped because X", you need evidence of X — not a plausible-sounding guess. Phase 1's capture step exists precisely to force you to record the real state before forming hypotheses. A recovery action based on an unverified hypothesis is a blind retry with extra steps. When the diagnosis is uncertain, the correct response is Phase 2's "run one discriminating check" — not Phase 3 with three parallel fixes.

## Output Standard

When this skill is active, never end with "I fixed it" alone.

Always provide:
- the failure pattern
- the root-cause hypothesis
- the recovery action taken
- the evidence that the situation is now better (or still blocked, and why)
