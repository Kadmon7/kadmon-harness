---
name: claude-api
description: Patterns for Claude API and Anthropic SDKs (TypeScript + Python) — messages, tool use, streaming, extended thinking, prompt caching, batches, cost optimization. Use this skill whenever code imports @anthropic-ai/sdk or anthropic, when building features that call Claude directly, implementing function calling / tool use, streaming responses, or managing API costs. Also use when the user asks to "call Claude", "use the API", "add tool use", or works on ToratNetz/KAIRON backend integration.
---

# Claude API

Patterns for using the Claude API with Anthropic TypeScript and Python SDKs.

## When to Use
- Building features that call Claude API directly
- Implementing tool use (function calling)
- Streaming responses
- Managing API costs
- Building agent loops

## Model Selection

| Model | ID | Best For |
|-------|-----|----------|
| Opus 4.6 | `claude-opus-4-6` | Complex reasoning, architecture, research |
| Sonnet 4.6 | `claude-sonnet-4-6` | Balanced coding, most development tasks |
| Haiku 4.5 | `claude-haiku-4-5-20251001` | Fast responses, high-volume, cost-sensitive |

Default to Sonnet unless the task requires deep reasoning (Opus) or speed/cost optimization (Haiku). For production, prefer pinned snapshot IDs over aliases.

## TypeScript SDK

```bash
npm install @anthropic-ai/sdk
```

### Basic Message
```typescript
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const message = await client.messages.create({
  model: 'claude-sonnet-4-6-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello' }],
});
```

### Streaming
```typescript
const stream = client.messages.stream({
  model: 'claude-sonnet-4-6-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Write a haiku' }],
});

for await (const event of stream) {
  if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
    process.stdout.write(event.delta.text);
  }
}
```

### Tool Use
```typescript
const response = await client.messages.create({
  model: 'claude-sonnet-4-6-20250514',
  max_tokens: 1024,
  tools: [{
    name: 'search_torah',
    description: 'Search Torah texts by topic',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  }],
  messages: [{ role: 'user', content: 'Find passages about creation' }],
});

// Handle tool use response
for (const block of response.content) {
  if (block.type === 'tool_use') {
    const result = await searchTorah(block.input);
    // Send result back as tool_result
  }
}
```

## Python SDK

```bash
pip install anthropic
```

### Basic Message
```python
import anthropic

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env

message = client.messages.create(
    model="claude-sonnet-4-6-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}]
)
print(message.content[0].text)
```

### Streaming
```python
with client.messages.stream(
    model="claude-sonnet-4-6-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Write a haiku"}]
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

## Extended Thinking

For complex reasoning tasks where you want to see the model's chain of thought:

```python
message = client.messages.create(
    model="claude-sonnet-4-6-20250514",
    max_tokens=16000,
    thinking={"type": "enabled", "budget_tokens": 10000},
    messages=[{"role": "user", "content": "Solve this step by step..."}]
)

for block in message.content:
    if block.type == "thinking":
        print(f"Thinking: {block.thinking}")
    elif block.type == "text":
        print(f"Answer: {block.text}")
```

## Prompt Caching

Cache large system prompts to reduce costs (up to 90% savings on cached tokens):

```python
message = client.messages.create(
    model="claude-sonnet-4-6-20250514",
    max_tokens=1024,
    system=[
        {"type": "text", "text": large_system_prompt, "cache_control": {"type": "ephemeral"}}
    ],
    messages=[{"role": "user", "content": "Question about the cached context"}]
)
# Check cache usage
print(f"Cache read: {message.usage.cache_read_input_tokens}")
print(f"Cache creation: {message.usage.cache_creation_input_tokens}")
```

## Batches API

Process large volumes asynchronously at 50% cost reduction:

```python
batch = client.messages.batches.create(
    requests=[
        {
            "custom_id": f"request-{i}",
            "params": {
                "model": "claude-sonnet-4-6-20250514",
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": prompt}]
            }
        }
        for i, prompt in enumerate(prompts)
    ]
)
# Poll for completion, then retrieve results
```

## Cost Optimization

| Strategy | Savings | When to Use |
|----------|---------|-------------|
| Prompt caching | Up to 90% | Repeated system prompts or large context |
| Batches API | 50% | Non-time-sensitive bulk processing |
| Haiku instead of Sonnet | ~75% | Simple tasks, classification, extraction |
| Shorter max_tokens | Variable | When you know output will be short |
| Streaming | None (same cost) | Better UX, same price |

## Error Handling

```python
from anthropic import APIError, RateLimitError, APIConnectionError

try:
    message = client.messages.create(...)
except RateLimitError:
    time.sleep(60)  # Back off and retry
except APIConnectionError:
    pass  # Network issue, retry with backoff
except APIError as e:
    print(f"API error {e.status_code}: {e.message}")
```

## Gotchas
- The SDK API evolves -- always use /almanak (Context7) for current signatures
- Never hardcode API keys. Always use environment variables: `ANTHROPIC_API_KEY`
- Check token usage in response: `response.usage.input_tokens`, `response.usage.output_tokens`
- Use cost-calculator.ts in the harness to estimate per-session costs
- For production, pin model versions (snapshot IDs) rather than using aliases

## Rules
- Always handle API errors (rate limits, overloaded, invalid request)
- Never hardcode API keys -- use environment variables
- Log token usage for cost tracking
- Use streaming for long responses
- Route by complexity: Haiku for simple, Sonnet for standard, Opus for complex

## no_context Application
Always fetch current API documentation via almanak agent (/almanak) before using new API features. The Claude API evolves -- do not rely on training data.
