---
name: claude-api
description: Patterns for Claude API and Anthropic TypeScript SDK — messages, tool use, streaming, cost tracking. Use this skill whenever code imports @anthropic-ai/sdk, when building features that call Claude directly, implementing function calling / tool use, streaming responses, or managing API costs. Also use when the user asks to "call Claude", "use the API", "add tool use", or works on ToratNetz/KAIRON backend integration.
---

# Claude API

Patterns for using the Claude API and Anthropic TypeScript SDK.

## When to Use
- Building features that call Claude API directly
- Implementing tool use (function calling)
- Streaming responses
- Managing API costs

## How It Works

### Basic Message
```typescript
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic();
const message = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello' }],
});
```

### Tool Use
```typescript
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
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
```

### Cost Awareness
- Check token usage in response: `response.usage.input_tokens`, `response.usage.output_tokens`
- Use cost-calculator.ts to estimate cost
- Route by complexity: Haiku for simple, Sonnet for standard, Opus for complex

## Rules
- Always handle API errors (rate limits, overloaded, invalid request)
- Never hardcode API keys — use environment variables
- Log token usage for cost tracking
- Use streaming for long responses

## no_context Application
Always fetch current API documentation via docs-lookup agent before using new API features. The Claude API evolves — do not rely on training data.