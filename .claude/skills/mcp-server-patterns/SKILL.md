---
name: mcp-server-patterns
description: Build and consume MCP servers — TypeScript SDK, tools, resources, prompts, stdio vs HTTP transport, Zod validation, health monitoring. Use this skill whenever configuring MCP servers in claude.json, building a custom MCP server, debugging MCP connection issues, or working with the GitHub/Supabase/Context7 MCPs. Also use when the user mentions "MCP", "tool server", "model context protocol", or when mcp-health-check hook reports failures.
---

# MCP Server Patterns

Build and consume MCP (Model Context Protocol) servers. MCP lets AI assistants call tools, read resources, and use prompts from your server.

## When to Use
- Building a custom MCP server
- Integrating with existing MCP servers (Supabase, Context7)
- Debugging MCP connection issues
- Choosing between stdio and HTTP transport

## Core Concepts

- **Tools**: Actions the model can invoke (e.g. search, run a command). The primary MCP primitive.
- **Resources**: Read-only data the model can fetch (e.g. file contents, API responses). Useful for giving the model reference data without tool calls.
- **Prompts**: Reusable, parameterized prompt templates the client can surface (e.g. in Claude Desktop).
- **Transport**: stdio for local clients; Streamable HTTP for remote. Legacy HTTP/SSE for backward compatibility only.

The SDK API has changed over time -- registration methods may be `tool()` / `resource()` or `registerTool()` / `registerResource()` depending on version. Always verify against current docs via /almanak (Context7) or the official MCP documentation.

## Consuming MCP Servers

Configure in `~/.claude.json` under the project:
```json
{
  "mcpServers": {
    "context7": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@anthropic-ai/context7-mcp"],
      "env": {}
    },
    "supabase": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@anthropic-ai/supabase-mcp", "--supabase-url", "${SUPABASE_URL}"],
      "env": { "SUPABASE_SERVICE_ROLE_KEY": "${SUPABASE_SERVICE_ROLE_KEY}" }
    }
  }
}
```

## Building an MCP Server

```bash
npm install @modelcontextprotocol/sdk zod
```

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'my-server', version: '1.0.0' });

// Register a tool
server.tool('search_content', { query: z.string() }, async ({ query }) => {
  const results = await searchDatabase(query);
  return { content: [{ type: 'text', text: JSON.stringify(results) }] };
});

// Register a resource (read-only data)
server.resource('schema', 'schema://main', async (uri) => {
  const schema = await readSchema();
  return { content: [{ type: 'text', text: schema }] };
});

// Connect via stdio (local)
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Transport Options

| Transport | Use Case | Notes |
|-----------|----------|-------|
| stdio | Local clients (Claude Desktop, Claude Code) | Default. Simple, no network setup |
| Streamable HTTP | Remote clients (Cursor, cloud) | Preferred for remote. Single endpoint |
| HTTP/SSE (legacy) | Backward compatibility only | Deprecated in favor of Streamable HTTP |

Keep server logic (tools + resources) independent of transport so you can plug in either in the entrypoint.

## Best Practices
- **Schema first**: Define Zod input schemas for every tool; document parameters and return shape
- **Errors**: Return structured errors the model can interpret; avoid raw stack traces
- **Idempotency**: Prefer idempotent tools where possible so retries are safe
- **Rate and cost**: For tools that call external APIs, document rate limits and cost in the tool description
- **Versioning**: Pin SDK version in package.json; check release notes when upgrading

## Gotchas
- On Windows, use `cmd /c npx` wrapper for MCP servers (not `npx` directly)
- Keep under 10 MCP servers enabled to preserve context window budget
- Use environment variable expansion for secrets: `${VAR_NAME}` -- never hardcode
- The mcp-health-check hook validates server health before MCP tool calls; mcp-health-failure logs failures for diagnostics
- SDK method names change between versions (`tool()` vs `registerTool()`). Always verify with /almanak

## Rules
- Keep under 10 MCP servers enabled to preserve context
- Use environment variable expansion for secrets: `${VAR_NAME}`
- Handle server health with mcp-health-check/mcp-health-failure hooks
- Test MCP tools manually before relying on them in workflows

## no_context Application
When consuming MCP server tools, verify the tool exists and understand its parameters via documentation -- do not assume MCP tool schemas. The SDK API evolves; always check current docs via /almanak (Context7).
