---
name: council
description: Convene a four-voice council (Architect, Skeptic, Pragmatist, Critic) for ambiguous decisions, tradeoffs, and go/no-go calls — using subagent isolation as an anti-anchoring mechanism. Use this skill whenever a decision has multiple credible paths and no obvious winner, when you need explicit tradeoff surfacing, when conversational anchoring is a real risk, when the user asks for "second opinions", "dissent", "multiple perspectives", "council", "tradeoffs", "should we ship now or wait", or when a go/no-go call would benefit from adversarial challenge. Do NOT use for verifying correctness (use `verification-loop`), implementation planning (`konstruct`), system architecture (`arkitect`), code review (`kody`), straight factual questions, or obvious execution tasks.
---

# Council

Convene four advisors for an ambiguous decision:

- The **in-context Claude** voice (Architect)
- A **Skeptic** subagent
- A **Pragmatist** subagent
- A **Critic** subagent

This is for **decision-making under ambiguity**, not code review, implementation planning, or architecture design.

## When to Use

- A decision has multiple credible paths and no obvious winner
- You need explicit tradeoff surfacing
- The user asks for second opinions, dissent, or multiple perspectives
- Conversational anchoring is a real risk (the model is locked into one framing)
- A go/no-go call would benefit from adversarial challenge

Examples:

- Monorepo vs polyrepo
- Ship now vs hold for polish
- Feature flag vs full rollout
- Simplify scope vs keep strategic breadth
- Rewrite vs refactor

## When NOT to Use

| Instead of council | Use |
|---|---|
| Verifying that an implementation is correct | `verification-loop` |
| Breaking a feature into implementation steps | `konstruct` agent |
| Designing system architecture | `arkitect` agent |
| Reviewing code for bugs or security | `kody` / `spektr` |
| Straight factual questions | Just answer directly |
| Obvious execution tasks | Just do the task |

## Roles

| Voice | Lens |
|---|---|
| **Architect** | Correctness, maintainability, long-term implications |
| **Skeptic** | Premise challenge, simplification, assumption-breaking |
| **Pragmatist** | Shipping speed, user impact, operational reality |
| **Critic** | Edge cases, downside risk, failure modes |

The three external voices must be launched as **fresh subagents** with **only the question and relevant context** — not the full ongoing conversation. That is the anti-anchoring mechanism. If a subagent receives the conversation history, it inherits the same framing and stops being an independent voice.

## Workflow

### 1. Extract the real question

Reduce the decision to one explicit prompt:

- What are we deciding?
- What constraints matter?
- What counts as success?

If the question is vague, ask **one** clarifying question before convening the council.

### 2. Gather only the necessary context

If the decision is codebase-specific:

- Collect the relevant files, snippets, issue text, or metrics
- Keep it compact
- Include only the context needed to make the decision

If the decision is strategic/general:

- Skip repo snippets unless they materially change the answer

### 3. Form the Architect position first

Before reading other voices, write down:

- Your initial position
- The three strongest reasons for it
- The main risk in your preferred path

Do this **first** so the synthesis does not simply mirror whichever external voice arrived last.

### 4. Launch three independent voices in parallel

Each subagent gets:

- The decision question
- Compact context (only what's needed)
- A strict role
- **No** conversation history beyond the prompt

Prompt template:

```
You are the [ROLE] on a four-voice decision council.

Question:
[decision question]

Context:
[only the relevant snippets or constraints]

Respond with:
1. Position — 1-2 sentences
2. Reasoning — 3 concise bullets
3. Risk — biggest risk in your recommendation
4. Surprise — one thing the other voices may miss

Be direct. No hedging. Keep it under 300 words.
```

Role emphasis:

- **Skeptic** — challenge the framing, question assumptions, propose the simplest credible alternative
- **Pragmatist** — optimize for speed, simplicity, real-world execution
- **Critic** — surface downside risk, edge cases, reasons the plan could fail

### 5. Synthesize with bias guardrails

You are both a participant *and* the synthesizer, so apply these rules:

- Do not dismiss an external view without explaining why
- If an external voice changed your recommendation, say so explicitly
- Always include the strongest dissent, even if you reject it
- If two voices align against your initial position, treat that as a real signal
- Keep the raw positions visible **before** the verdict

### 6. Present a compact verdict

```markdown
## Council: [short decision title]

**Architect:** [1-2 sentence position]
[1 line on why]

**Skeptic:** [1-2 sentence position]
[1 line on why]

**Pragmatist:** [1-2 sentence position]
[1 line on why]

**Critic:** [1-2 sentence position]
[1 line on why]

### Verdict
- **Consensus:** [where they align]
- **Strongest dissent:** [most important disagreement]
- **Premise check:** [did the Skeptic challenge the question itself?]
- **Recommendation:** [the synthesized path]
```

Keep it scannable on a phone screen.

## Persistence Rule

Do **not** write ad-hoc notes. If the council materially changes the recommendation:

- Write an ADR via `architecture-decision-records` if the decision becomes long-lived system policy
- Save to project memory if the lesson should carry across sessions
- Update the relevant GitHub issue / PR if the decision changes active execution truth

Only persist a decision when it changes something real.

## Multi-Round Follow-up

Default is **one round**.

If the user wants another round:

- Keep the new question focused
- Include the previous verdict only if necessary
- Keep the Skeptic as clean as possible to preserve anti-anchoring value

## Anti-Patterns

- Using council for code review (that's `kody` / `spektr`)
- Using council when the task is just implementation work
- Feeding the subagents the entire conversation transcript (kills anti-anchoring)
- Hiding disagreement in the final verdict ("everyone agreed" is suspicious)
- Persisting every decision as a note regardless of importance

## Example

Question:

> Should we ship Kadmon v1.1 now with 8/16 Sprint F skills imported, or hold until all 16 are in?

Likely council shape:

- **Architect**: structural integrity favors the full set; partial releases create migration drag
- **Skeptic**: questions whether "v1.1" needs all 16 — the 8 already shipped are independent
- **Pragmatist**: ship now, the user wants to use the harness in ToratNetz this week
- **Critic**: focuses on docs drift if 8 ship without the routing updates that 16 would justify

The value isn't unanimity. The value is making the disagreement legible *before* choosing.

## Integration

- **konstruct agent** (opus) — primary owner. konstruct handles complex planning under uncertainty; this skill is the multi-voice technique konstruct uses when the planning question is ambiguous enough that a single perspective would anchor too quickly.
- **/abra-kdabra command** — entry point. When a user says "I'm not sure which approach", konstruct can convene a council before producing a plan.
- **architecture-decision-records skill** — downstream artifact. When the council recommendation becomes long-lived system policy, capture it as an ADR.
- **arkitect agent** — handoff target. After the council produces a recommendation that touches architecture, hand off to arkitect for the formal design.
- **search-first skill** — upstream gathering. If the council needs external reference material, run search-first before convening.

## no_context Application

Every voice must rest on real context, not on imagined positions. Before launching the Skeptic subagent, gather the actual constraints — don't ask the Skeptic to "challenge a generic version of the question". If a voice's reasoning is grounded in something the parent agent imagined ("the user probably wants speed"), the council degenerates into a single voice talking to itself in three tones. The `no_context` principle here means: every advisor's input is traceable to a real fact or constraint passed in the prompt, not a confabulation.
