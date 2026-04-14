---
name: strategic-compact
description: Decision guide for when to run `/kompact` manually at logical task boundaries — after research, before execution, between unrelated tasks — rather than relying on arbitrary auto-compaction. Use this skill whenever a session is approaching context limits, crossing a phase transition (research → plan, plan → implement, debug → next feature), about to switch topics, or when the user says "is it time to compact", "should I compact", "context is getting full", "clear context", "reset context", "compact now". Do NOT trigger mid-implementation when variable names and partial state matter, and do NOT trigger if the user already compacted in this session unless the context has grown substantially since.
---

# Strategic Compact

Guide to when **manual** compaction wins over arbitrary auto-compaction. Kadmon has `/kompact` as the compaction command; this skill answers *when to call it*.

This is a **command-level skill** — no agent owns it. It's loaded directly when the user or another skill needs the decision matrix. Similar to `verification-loop`, which is loaded by `/chekpoint` without a reviewer agent.

## When to Use

- Long session approaching context limits
- Crossing a phase boundary (research → plan → implement → test)
- Switching between unrelated tasks within the same session
- Responses slowing down or degrading (context pressure signal)
- Just finished a major milestone and starting new work

## Why Strategic Compaction Beats Auto-Compaction

Auto-compaction triggers at whatever moment the system decides — often mid-task, losing the exact state you need. Strategic compaction is triggered by **you** at a logical boundary:

- After exploration, before execution — compress research, keep the plan
- After a completed milestone — fresh start for the next phase
- Before a major context shift — clear the old exploration before the new task

## Decision Guide

| Phase transition | Compact? | Why |
|---|---|---|
| Research → Planning | **Yes** | Research is bulky; the plan is the distilled output |
| Planning → Implementation | **Yes** | Plan is persisted to a file or tasks; free up context for code |
| Implementation → Testing | *Maybe* | Keep if tests reference very recent code; compact if switching focus |
| Debugging → Next feature | **Yes** | Debug traces pollute context for unrelated work |
| Mid-implementation | **No** | Losing variable names, file paths, and partial state is costly |
| After a failed approach | **Yes** | Clear the dead-end reasoning before trying a new approach |
| After /chekpoint + commit | **Yes** | Natural break; file state is persisted |

## What Survives Compaction

Understanding what persists lets you compact with confidence:

| Persists | Lost |
|---|---|
| `CLAUDE.md` instructions | Intermediate reasoning and analysis |
| Task list (TaskCreate state) | File contents you previously read |
| Memory files (`~/.claude/projects/<project>/memory/`) | Multi-turn conversation nuance |
| Git state (commits, branches) | Tool call history and counts |
| Files on disk | Verbally stated preferences not committed to memory |
| Plan files (`~/.claude/plans/*.md`) | Scratch thinking not written anywhere |

**Practical rule**: if something matters after compaction, **write it to disk first** — a plan file, a memory entry, a commit message, or a `TaskCreate`. Don't rely on conversation memory.

## Best Practices

1. **Compact after planning.** Once the plan is finalized in a plan file or task list, compact to start the execution phase clean.
2. **Compact after debugging.** Clear error-resolution context before continuing with unrelated work.
3. **Don't compact mid-implementation.** Preserve context for related changes — a half-compacted implementation is worse than a full one.
4. **Read the suggestion, decide for yourself.** A hook might *suggest* compaction; only you know whether the next step needs the current context.
5. **Write before compacting.** Save important context to files or memory before the compaction so it survives.
6. **Compact with a pointer.** When you run `/kompact`, pass a short note about what to preserve: "Focus on implementing auth middleware next."

## Signals That It's Time

If any of these are true, compaction is usually the right call:

- Tool responses are arriving truncated or slower than normal
- You've had to re-read the same file twice
- The session spans more than 3 distinct topics
- You're about to start a completely new workflow (e.g., moving from debugging to writing docs)
- Context-budget estimates show >70% of the window is consumed by historical turns

## Signals That It's NOT Time

- You're in the middle of a debugging session and traces matter
- You just read 5 files and are about to synthesize across them
- The conversation has a single coherent thread and compaction would disrupt it
- You compacted 10 turns ago and haven't accumulated much since

## Integration

- **/kompact command** — the execution counterpart. This skill is loaded *by* `/kompact` (and by agents that need to decide whether to recommend compaction). `/kompact` executes; this skill decides whether `/kompact` should run at all.
- **command-level skill, no agent owner** — by design. Compaction decisions are deterministic enough that routing through an agent adds no value; the decision guide table is the tool. Same pattern as `verification-loop`.
- **context-budget skill** — upstream signal. `context-budget` measures how much of the window is consumed; `strategic-compact` decides whether that measurement warrants action.
- **token-budget-advisor skill** — downstream partner. After compaction, `token-budget-advisor` helps the user pick the depth of the next response to avoid immediately refilling the window.

## no_context Application

A compaction recommendation must cite the actual signal, not a guess. "You're probably running out of context" is not enough — the signal is one of: a specific tool-call count, an explicit token estimate, a named phase transition, or a user's verbal complaint about slow responses. If none of those exist, the honest answer is "I don't see a reason to compact yet" — not "compacting seems like a good idea". The `no_context` principle here means: treat compaction as an action that costs something (lost mid-task state), and justify it with evidence before recommending it.
