---
name: mcp-server-patterns
description: Build and consume MCP servers — TypeScript SDK, stdio transport, tool definitions, health monitoring. Use this skill whenever configuring MCP servers in claude.json, building a custom MCP server, debugging MCP connection issues, or working with the GitHub/Supabase/Context7 MCPs. Also use when the user mentions "MCP", "tool server", "model context protocol", or when mcp-health-check hook reports failures.
---

# MCP Server Patterns

Build and consume MCP servers with the TypeScript SDK.

## When to Use
- Building a custom MCP server
- Integrating with existing MCP servers (GitHub, Supabase, Context7)
- Debugging MCP connection issues

## How It Works

### Consuming MCP Servers
MCP servers are configured in `~/.claude.json` under the project:
```json
{
  "mcpServers": {
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
    }
  }
}
```

### Building an MCP Server
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'my-server', version: '1.0.0' });

server.tool('search_content', { query: z.string() }, async ({ query }) => {
  const results = await searchDatabase(query);
  return { content: [{ type: 'text', text: JSON.stringify(results) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Rules
- Keep under 10 MCP servers enabled to preserve context
- Use environment variable expansion for secrets: `${VAR_NAME}`
- Handle server health with mcp-health-check/mcp-health-failure hooks
- Test MCP tools manually before relying on them in workflows

## no_context Application
When consuming MCP server tools, verify the tool exists and understand its parameters via documentation — do not assume MCP tool schemas.