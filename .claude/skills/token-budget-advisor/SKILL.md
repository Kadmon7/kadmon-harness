---
name: token-budget-advisor
description: Offer the user an explicit choice of response depth (25% / 50% / 75% / 100%) before answering, with token estimates based on prompt complexity. Use this skill whenever the user says "token budget", "token count", "response length", "answer depth", "short version", "tldr", "brief answer", "detailed answer", "exhaustive answer", "cuántos tokens", "ahorrar tokens", "respuesta corta", "dame la versión corta", "responde al 50%", or clearly asks to control how much context/response to consume. Do NOT trigger when "token" refers to auth/JWT/payment tokens, when the user has already set a depth this session (maintain it silently), or when the answer is trivially one line.
---

# Token Budget Advisor

Intercept the response flow and offer an explicit depth choice **before** answering. Lets the user decide how much output they want, with concrete token estimates instead of vague prose.

## When to Use

- User mentions tokens, budget, depth, length, or brevity
- User says "short version", "tldr", "al 25%", "exhaustive", "detailed"
- User wants to cap or expand response size upfront
- Long-running sessions where context pressure is starting to matter

**Do not trigger** when the user has already chosen a depth in the current session (maintain it silently), when "token" refers to JWT/auth/payment context, or when the answer is a trivial one-liner.

## How It Works

### Step 1 — Estimate input tokens

Use the canonical heuristic shared with [context-budget](context-budget.md):

- **Prose**: `words × 1.3`
- **Code or mixed blocks**: `chars / 4`

For mixed content, pick the dominant type. Don't aim for precision — this is a heuristic estimate with ~85-90% accuracy.

### Step 2 — Classify complexity and project response window

| Complexity | Multiplier range | Example prompts |
|---|---|---|
| Simple | 3× – 8× | "What is X?", yes/no, single fact |
| Medium | 8× – 20× | "How does X work?" |
| Medium-High | 10× – 25× | Code request with context |
| Complex | 15× – 40× | Multi-part analysis, comparisons, architecture review |
| Creative | 10× – 30× | Narrative writing, longer-form explanation |

Response window = `input_tokens × mult_min` to `input_tokens × mult_max`, clamped by the model's configured output limit.

### Step 3 — Present depth options

Before answering, show this block with actual numbers filled in:

```
Analyzing your prompt...

Input: ~[N] tokens  |  Type: [prose|code|mixed]  |  Complexity: [level]

Choose your depth level:

[1] Essential   (25%)  ->  ~[tokens]   Direct answer only, no preamble
[2] Moderate    (50%)  ->  ~[tokens]   Answer + context + 1 example
[3] Detailed    (75%)  ->  ~[tokens]   Full answer with alternatives
[4] Exhaustive (100%)  ->  ~[tokens]   Everything, no limits

Which level? (1-4 or say "25% depth", "50% depth", "75% depth", "100% depth")

Precision: heuristic estimate ~85-90% accuracy (±15%).
```

Level token estimates within the response window:

- 25% → `min + (max - min) × 0.25`
- 50% → `min + (max - min) × 0.50`
- 75% → `min + (max - min) × 0.75`
- 100% → `max`

### Step 4 — Respond at the chosen level

| Level | Target length | Include | Omit |
|---|---|---|---|
| 25% Essential | 2-4 sentences | Direct answer, key conclusion | Context, examples, nuance, alternatives |
| 50% Moderate | 1-3 paragraphs | Answer + necessary context + 1 example | Deep analysis, edge cases, references |
| 75% Detailed | Structured response | Multiple examples, pros/cons, alternatives | Extreme edge cases, exhaustive refs |
| 100% Exhaustive | No restriction | Everything — full analysis, all code, all perspectives | Nothing |

## Shortcuts — skip the question

If the user already signals a level, respond immediately at that level without asking:

| User says | Level |
|---|---|
| "1" / "25% depth" / "short version" / "brief" / "tldr" | 25% |
| "2" / "50% depth" / "moderate" / "balanced" | 50% |
| "3" / "75% depth" / "detailed" / "thorough" | 75% |
| "4" / "100% depth" / "exhaustive" / "full deep dive" | 100% |

If the user set a level earlier in the session, **maintain it silently** for subsequent responses unless they explicitly change it.

## Examples

### Triggers
- "Give me the short version first"
- "How many tokens will your answer use?"
- "Respond at 50% depth"
- "I want the exhaustive answer, not the summary"
- "Dame la versión corta y luego la detallada"

### Does Not Trigger
- "What is a JWT token?" — auth context
- "The checkout flow uses a payment token" — payment context
- "Is this normal?" — trivial yes/no
- "Complete the refactor" — no depth signal
- Any follow-up after the user already chose a depth for the session

## Integration

- **arkonte agent** (sonnet) — primary owner. arkonte is the harness's performance and context-budget specialist. When a session is approaching compact thresholds and the user asks for "the short version", arkonte loads this skill to make the depth choice explicit instead of guessing.
- **context-budget skill** — direct sibling. `context-budget` estimates what the current window is costing; `token-budget-advisor` asks the user what to spend on the next response. Use together: `context-budget` reads the state, `token-budget-advisor` writes the decision.
- **/kompact command** — natural entry point when the user asks to compact or shrink response size during a long session.

## no_context Application

The depth choice must rest on an actual estimate, not a guess. Before showing the four options, compute `input_tokens` with the heuristic and compute the response window from the complexity multiplier — both values appear in the block presented to the user. If you cannot estimate (e.g., binary content, unknown language), flag the unknown instead of inventing numbers. The `no_context` principle here means: the user deserves the math, not a vague "this will be short".
