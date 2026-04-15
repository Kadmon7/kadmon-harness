---
name: cost-aware-llm-pipeline
description: Cost-optimization patterns for any code that calls Claude, OpenAI, or similar LLM APIs — model routing by task complexity, immutable cost tracking, narrow retry logic, and prompt caching combined into a composable pipeline. Use this skill whenever building or reviewing code that calls an LLM API in a loop or pipeline, when the user says "cut API costs", "reduce LLM spend", "model routing", "which model should I use", "budget limit", "prompt caching", "fallback model", "retry on rate limit", or when designing any batch processor that could silently overspend. Do NOT trigger for one-off prompts with no budget concern or for questions about local models that don't charge per token.
---

# Cost-Aware LLM Pipeline

Patterns for controlling LLM API spend without sacrificing quality on complex work. Combines four techniques into a composable pipeline: **routing**, **budget tracking**, **narrow retry**, and **prompt caching**.

## When to Activate

- Building an application that calls the Claude or OpenAI API
- Processing a batch where item complexity varies (most are simple, a few are complex)
- Need to stay within a hard budget for API spend
- Optimizing cost without degrading quality on the complex items
- Reviewing existing pipeline code that looks like "use Opus for everything"

## Four Core Patterns

### 1. Model Routing by Task Complexity

Default to the cheapest model. Escalate only when complexity thresholds are crossed. Python example:

```python
MODEL_SONNET = "claude-sonnet-4-6"
MODEL_HAIKU = "claude-haiku-4-5-20251001"

_SONNET_TEXT_THRESHOLD = 10_000  # chars
_SONNET_ITEM_THRESHOLD = 30      # items

def select_model(text_length: int, item_count: int, force: str | None = None) -> str:
    if force is not None:
        return force
    if text_length >= _SONNET_TEXT_THRESHOLD or item_count >= _SONNET_ITEM_THRESHOLD:
        return MODEL_SONNET   # complex → escalate
    return MODEL_HAIKU        # simple → ~4× cheaper
```

TypeScript is the same idea — pure function, explicit thresholds, single `force` override for testing.

### 2. Immutable Cost Tracking

Every API call returns a **new** tracker. Never mutate state. This makes replay, audit, and parallel execution safe.

```python
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class CostRecord:
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float

@dataclass(frozen=True, slots=True)
class CostTracker:
    budget_limit: float = 1.00
    records: tuple[CostRecord, ...] = ()

    def add(self, record: CostRecord) -> "CostTracker":
        return CostTracker(
            budget_limit=self.budget_limit,
            records=(*self.records, record),
        )

    @property
    def total_cost(self) -> float:
        return sum(r.cost_usd for r in self.records)

    @property
    def over_budget(self) -> bool:
        return self.total_cost > self.budget_limit
```

### 3. Narrow Retry Logic

Retry only on **transient** errors. Authentication or bad-request failures should raise immediately — retrying them wastes budget on permanent failures.

```python
from anthropic import APIConnectionError, InternalServerError, RateLimitError

_RETRYABLE = (APIConnectionError, RateLimitError, InternalServerError)
_MAX_RETRIES = 3

def call_with_retry(func, *, max_retries: int = _MAX_RETRIES):
    for attempt in range(max_retries):
        try:
            return func()
        except _RETRYABLE:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)
    # AuthenticationError, BadRequestError → raise immediately (never retried)
```

### 4. Prompt Caching

Cache long system prompts so they aren't resent on every request. Saves cost **and** latency. Break-even is around 1024 tokens of cached content.

```python
messages = [
    {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},  # cached segment
            },
            {
                "type": "text",
                "text": user_input,  # variable part
            },
        ],
    }
]
```

## Composition

All four techniques in one pipeline function:

```python
def process(text: str, config: Config, tracker: CostTracker) -> tuple[Result, CostTracker]:
    model = select_model(len(text), estimated_items, config.force_model)

    if tracker.over_budget:
        raise BudgetExceededError(tracker.total_cost, tracker.budget_limit)

    response = call_with_retry(lambda: client.messages.create(
        model=model,
        messages=build_cached_messages(system_prompt, text),
    ))

    record = CostRecord(
        model=model,
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens,
        cost_usd=compute_cost(model, response.usage),
    )
    return parse_result(response), tracker.add(record)
```

## Pricing Reference (2025-2026)

| Model | Input ($/1M tok) | Output ($/1M tok) | Relative |
|---|---|---|---|
| Haiku 4.5 | $0.80 | $4.00 | 1× |
| Sonnet 4.6 | $3.00 | $15.00 | ~4× |
| Opus 4.6 | $15.00 | $75.00 | ~19× |

Always verify current pricing via `/almanak` before quoting — Anthropic updates this page frequently.

## Best Practices

1. **Start with the cheapest model.** Escalate only when a measurable threshold (text length, item count, required precision) is crossed.
2. **Set an explicit budget limit** before processing a batch. Fail early rather than overspend.
3. **Log every routing decision** so thresholds can be tuned from real data, not guesses.
4. **Use prompt caching for any system prompt ≥1024 tokens** — it's almost always a net win.
5. **Never retry on auth or validation errors.** Those are permanent failures; retries just burn budget.
6. **Track cost immutably.** Mutable counters make debugging and auditing painful when things go wrong.

## Anti-Patterns to Avoid

- Using Opus for all requests regardless of complexity ("it's smarter anyway")
- Blanket `try: ... except Exception: retry` — retries permanent failures
- Mutating a single `cost_so_far` variable from multiple call sites
- Hardcoding model IDs scattered through the codebase instead of centralizing in constants
- Forgetting prompt caching on a system prompt that repeats 1000× in a batch

## Integration

- **alchemik agent** (opus) — primary owner. alchemik tracks harness cost trends via the dashboard's cost-tracker module; this skill is the reference it applies when auditing any Kadmon pipeline that calls Claude (e.g. agent invocations, /evolve runs, deep-research).
- **claude-api skill** — direct sibling. `claude-api` covers *how* to call the Anthropic API correctly (prompt caching, streaming, tool use); this skill covers *how much it costs* and how to stay within budget. Load together when building anything that calls Claude in a loop.
- **/evolve command** — natural entry point when the user asks to audit or reduce harness cost.
- **context-budget skill** — complementary on the input side. `context-budget` controls how many tokens go *in*; this skill controls how many go *out* and how much each call is allowed to cost.

## no_context Application

Every cost claim in a pipeline review must rest on observable evidence. The routing threshold must be justified by real data (log a sample of 100 prior calls, not a gut feel); the budget limit must be tied to an actual constraint (this batch must cost under $X); the pricing table must be verified via `/almanak` before quoting. A recommendation like "switch to Haiku, it'll be cheaper" without a measurement is a guess — the `no_context` principle demands the number: "Haiku passed 47/50 test cases on your corpus at $0.08 vs Sonnet's $0.31". If the data doesn't exist yet, the honest answer is "measure first, then route".
