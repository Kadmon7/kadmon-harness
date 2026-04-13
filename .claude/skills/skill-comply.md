---
name: skill-comply
description: Measure whether skills, rules, and agent definitions are **actually followed** by Claude — generate scenarios at 3 prompt strictness levels (supportive, neutral, competing), run the agent, classify tool calls against the expected behavioral spec, and report compliance rates with full timelines. Use this skill whenever the user asks "is this rule actually being followed", "does Claude use this skill", "are our agents behaving", "measure compliance", "rule drift", or after adding new rules/skills to verify uptake. Also use periodically as part of harness health maintenance — rules and skills that exist on disk but never fire are invisible failures.
---

# Skill Comply

Measures whether coding agents actually follow skills, rules, or agent definitions. A skill that sits on disk but never triggers when it should is invisibly broken. This skill makes that invisible failure **measurable**.

## When to Activate

- User asks "is this rule actually being followed"
- After adding new rules or skills, to verify the agents actually pick them up
- Periodically as part of quality maintenance (monthly or pre-release)
- When a skill has a high-quality description but doesn't seem to fire
- When `/evolve` reports that a rule is documented but never referenced in observations

## Supported Targets

- **Skills** (`.claude/skills/*.md`) — workflow skills like `search-first`, `tdd-workflow`
- **Rules** (`.claude/rules/common/*.md`, `.claude/rules/typescript/*.md`, `.claude/rules/python/*.md`) — mandatory rules like `testing.md`, `security.md`, `git-workflow.md`
- **Agent definitions** (`.claude/agents/*.md`) — whether an agent gets invoked when expected (internal workflow verification is out of scope)

## Method

### Phase 1 — Extract the Expected Behavioral Sequence (Spec)

Read the target file (skill / rule / agent) and auto-generate a spec describing what the agent SHOULD do when this skill/rule applies. Example for `search-first`:

```
Expected sequence when user asks to implement a new function:
1. Agent runs Grep or Glob to search existing code
2. Agent reads 2+ related files before proposing implementation
3. Only then does the agent Edit or Write
```

The spec is a list of **tool-call expectations** with temporal ordering, not prose.

### Phase 2 — Generate Scenarios at 3 Strictness Levels

For each skill/rule, create 3 test prompts with decreasing support for the expected behavior:

| Level | Prompt style | Purpose |
|---|---|---|
| **Supportive** | Mentions the skill explicitly or aligns fully with its domain | Baseline: does the skill fire at all? |
| **Neutral** | Describes the task without mentioning the skill or contradicting it | Realistic: does the skill fire when it should? |
| **Competing** | Frames the task in a way that invites skipping the skill ("quick fix", "just do X") | Stress: does the skill hold up under pressure? |

Example for `search-first`:

- **Supportive**: "I want to add retry logic. Can you search the codebase first to see how we currently handle HTTP errors?"
- **Neutral**: "Add retry logic to the HTTP client."
- **Competing**: "Quick fix — just add a try/catch with retry to the HTTP client. Keep it simple."

### Phase 3 — Run the Agent and Capture the Trace

Run each scenario and record every tool call in order. This can be done:

- **Manually**: copy the prompt into a fresh session, observe the tool sequence, record it
- **Programmatically**: if you have `claude -p` with stream-json, pipe the output and parse tool calls — this is the ECC-native path

Record the timeline: `[Tool, target, timestamp]` for each call until the agent completes or fails.

### Phase 4 — Classify Each Tool Call Against the Spec

Use an LLM (not regex) to classify each tool call against the expected spec steps:

- **Satisfies step N** — this call matches expected step N
- **Unrelated** — normal tool use, not part of the spec
- **Violates** — this call explicitly breaks a spec rule (e.g., Edit without prior Read when `search-first` is the target)

Also check **temporal ordering** deterministically: did the steps happen in the expected order?

### Phase 5 — Report

For each scenario, report:

```markdown
## Compliance Report: search-first

### Scenario 1 — Supportive
- Spec steps satisfied: 3/3
- Violations: 0
- Temporal order: correct
- **Compliance: PASS**
- Timeline:
  1. Grep "http_client" → satisfies step 1
  2. Read src/http/client.ts → satisfies step 2
  3. Read src/http/retry.ts → satisfies step 2
  4. Edit src/http/client.ts → satisfies step 3 (after reads)

### Scenario 2 — Neutral
- Spec steps satisfied: 2/3 (skipped "read 2+ files")
- Violations: 0
- **Compliance: PARTIAL**

### Scenario 3 — Competing
- Spec steps satisfied: 0/3
- Violations: 1 (Edit before any Grep/Read)
- **Compliance: FAIL**
- Note: the competing framing caused the agent to bypass the skill entirely.
```

### Key Insight: Prompt Independence

The question this skill answers is **not** "did the skill fire when the prompt asked for it?" — it's **"does the skill fire when the prompt doesn't support it?"**. A skill that only fires on supportive prompts is essentially decorative. A skill that fires on neutral and holds up on competing is actually encoding behavior.

## Recommendations from Low-Compliance Results

If a rule or skill fails on neutral/competing prompts:

1. **Rewrite the description more pushy** — add trigger words the user actually says
2. **Promote to a hook** — if the behavior is deterministic, a hook fires 100% of the time while a skill fires ~50-80% (skills use Claude's judgment)
3. **Move to rules** — rules are always in context; skills are selected

The report should suggest which fix is appropriate based on the failure pattern.

## Integration

- **alchemik agent** (opus) — primary owner. When `/evolve` runs, alchemik can use this skill to measure whether recent skill/rule additions are actually having effect. This closes the feedback loop between "we added a rule" and "the rule changed behavior".
- **/evolve command** — natural entry point for periodic compliance runs.
- **Related skills**: `skill-stocktake` evaluates **quality** of skills; `skill-comply` evaluates **effectiveness**. Use them together — a skill can be high quality but low effectiveness if its description doesn't trigger.
- **Rules**: `continuous-learning-v2` skill explains why hooks fire 100% while skills fire probabilistically — that's the exact trade-off this skill surfaces.

## no_context Application

Compliance measurement must rest on **actual recorded traces**, never on hand-wavy claims like "I think the agent usually uses that skill". A spec step is either satisfied by a real tool call at a real timestamp, or it isn't. When a skill's compliance score drops, the evidence is the timeline — you can point to the exact moment the agent skipped the expected step. This skill exists precisely because "I think it's being followed" is not evidence.
