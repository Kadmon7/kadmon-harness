# ADR-009: Firecrawl Integration Strategy

## Status
Accepted (revised 2026-04-01 — changed from MCP Server to Skill + CLI)

## Context

The Kadmon Harness is infrastructure that serves multiple projects (Kadmon Harness, ToratNetz, KAIRON, future projects). It currently has two documentation/web capabilities:

1. **Context7 plugin** -- live documentation lookup for libraries and frameworks. Used by the almanak agent. Official Claude plugin, zero configuration beyond `enabledPlugins`.
2. **WebSearch / WebFetch** -- native Claude Code tools. WebSearch performs general web search. WebFetch fetches individual URLs (domain-allowlisted in `settings.local.json` with 16 approved domains).

These cover two use cases well: library documentation (Context7) and targeted URL fetching (WebFetch). But they leave significant gaps:

- **Full-page scraping with clean output**: WebFetch returns raw HTML; extracting useful content requires manual parsing. Firecrawl returns clean markdown, structured data, or screenshots.
- **Site-wide crawling**: No current capability to recursively crawl a site and extract all pages. Needed for ToratNetz (scraping Torah commentary sites) and KAIRON (research gathering).
- **Dynamic content**: WebFetch cannot interact with JavaScript-rendered pages, forms, or SPAs. Firecrawl's browser and interact capabilities handle these.
- **Structured extraction**: No current way to extract structured data (JSON) from web pages using LLM-powered extraction.
- **Site mapping**: No current ability to discover all URLs on a domain before deciding what to crawl.
- **Autonomous web research**: No current agent-mode capability for multi-step web data gathering.

The user wants to integrate Firecrawl. Four integration options exist, each with different trade-offs.

### Existing Architecture Constraints
- Context7 and Supabase are configured as **official Claude plugins** (`enabledPlugins` in `settings.json`). Firecrawl is NOT an official Claude plugin.
- The harness is infrastructure: any integration must be portable across projects.
- Windows + Git Bash environment.
- API key management follows env var pattern (never in code, never committed).

## Options Considered

### Option A: Firecrawl Skill + CLI (`firecrawl-cli`)

Install the Firecrawl CLI globally and run `npx -y firecrawl-cli@latest init --all --browser` to install both the **Skill** (knowledge files that teach Claude about Firecrawl) and the **CLI** (the tool Claude uses via Bash). This is Firecrawl's recommended approach for AI agents.

**CLI Commands (7):**
| Command | Purpose |
|---------|---------|
| `firecrawl scrape <url>` | Scrape a single URL (markdown, HTML, screenshots, structured JSON) |
| `firecrawl search <query>` | Web search with optional result scraping |
| `firecrawl map <url>` | Discover all URLs on a site |
| `firecrawl crawl <url>` | Recursively crawl entire sites |
| `firecrawl agent <prompt>` | Autonomous web data gathering via natural language |
| `firecrawl browser <cmd>` | Cloud browser sandbox (Playwright, agent-browser, 40+ commands) |
| `firecrawl credit-usage` | Check credit balance and usage |

- **Pros**:
  - **Recommended by Firecrawl for AI agents.** Their docs explicitly recommend CLI + skill init for agents like Claude Code.
  - Zero background processes. Each command executes and terminates. No MCP server to manage or restart.
  - Rich command set: 7 commands covering scrape, search, map, crawl, agent, browser, credit-usage.
  - Pipeable with Unix tools: output to stdout, `| head`, `| jq`, `-o file`, `--pretty` for JSON.
  - Built-in auth: `firecrawl login --api-key` or env var `FIRECRAWL_API_KEY`.
  - `init --all` generates skill/rule files that teach Claude when and how to use each command.
  - Cross-project: global install (`npm install -g firecrawl-cli`) available everywhere.
  - Self-hosted support: `--api-url` flag for local Firecrawl instances.
  - Built-in cost monitoring: `firecrawl --status` shows credits, concurrency, auth status.
  - `--only-main-content` flag for clean output without nav/footer/ads.
  - Browser sandbox with Playwright (Python/JS/bash), no local browser install needed.
  - Telemetry opt-out: `FIRECRAWL_NO_TELEMETRY=1`.

- **Cons**:
  - Claude constructs Bash commands (less structured than MCP tool calls). Mitigated by skill files from `init --all` that teach correct usage patterns.
  - Output is text/JSON to stdout -- Claude must parse it. Mitigated by `--pretty` and `--json` flags.
  - No automatic health checking via MCP hooks. Mitigated by `firecrawl --status` for manual checks.
  - Global npm install adds a CLI to the system PATH.
  - CLI version updates require manual `npm update -g firecrawl-cli`.

### Option B: Firecrawl MCP Server

Configure Firecrawl as a custom MCP server via `.mcp.json`, giving Claude Code direct tool access.

- **Pros**:
  - Direct tool access with structured input/output, type-safe.
  - Existing `mcp-health-check` and `mcp-health-failure` hooks automatically cover it.
  - Existing `observe-pre`/`observe-post` hooks capture MCP tool calls.

- **Cons**:
  - Requires a running MCP server process. Adds a background process to manage.
  - API key must be in `.mcp.json` or environment. `${VAR}` interpolation uncertain on Windows.
  - Custom MCP servers are less stable than official plugins. Version updates are user's responsibility.
  - Windows compatibility risk: `cmd /c npx` wrapper needed, potential path issues.
  - If the MCP server crashes, Firecrawl tools fail entirely. No graceful degradation.
  - Cold-start latency when the MCP server is first invoked.
  - Recommended by Firecrawl for "AI tools" (Cursor, VS Code), NOT for AI agents.
  - No built-in status/credit check command.

### Option C: Node.js SDK (@mendable/firecrawl-js)

Install the SDK as a project dependency and use programmatically in scripts.

- **Pros**:
  - Full programmatic control for pipelines (crawl, filter, extract, store).
  - Type-safe TypeScript SDK.
  - Best for batch operations (ToratNetz corpus building).

- **Cons**:
  - Claude cannot call SDK functions directly during a conversation.
  - Significant implementation effort for each use case.
  - Adds production dependency.
  - Over-engineering for interactive scraping.

### Option D: MCP + SDK Combination

Use MCP for interactive access AND SDK for programmatic pipelines.

- **Pros**: Best of both worlds.
- **Cons**: Two integration points. SDK may not be needed yet (YAGNI).

## Decision

**Option A: Firecrawl Skill + CLI (`firecrawl-cli`)**, with the SDK (Option C) deferred to when a concrete pipeline use case emerges.

### Rationale

1. **Recommended by Firecrawl for AI agents.** Their documentation explicitly states: "The Firecrawl skill is the fastest way for agents to discover and use Firecrawl." The Skill + CLI approach is designed specifically for Claude Code, Antigravity, and OpenCode. MCP is recommended for "AI tools" (Cursor, VS Code, Windsurf) -- a different category.

2. **Two-part integration: Skill + CLI.**
   - **Skill**: `npx -y firecrawl-cli@latest init --all` generates knowledge files in `.claude/` that teach Claude when and how to use each Firecrawl command. This is knowledge injection -- Claude learns the patterns.
   - **CLI**: `npm install -g firecrawl-cli` provides the actual tool. Claude runs `firecrawl <command>` via Bash. Each command executes and terminates -- no background process.

3. **Zero background processes.** Unlike MCP, there is no server process to manage, monitor, restart, or debug. This eliminates an entire class of failure modes (server crashes, cold-start latency, env var interpolation bugs in `.mcp.json`).

4. **Rich command set covers all use cases.** The CLI provides 7 commands that map directly to every Firecrawl capability:
   - `scrape` -- single page to markdown/HTML/JSON/screenshot (with `--only-main-content` for clean output)
   - `search` -- web search with optional scraping of results, source/category/time/location filters
   - `map` -- discover all URLs on a site (with `--search` filter, sitemap control)
   - `crawl` -- recursive site crawl (with depth/page limits, path include/exclude, progress indicator)
   - `agent` -- autonomous web research via natural language prompts (with schema for structured output)
   - `browser` -- cloud Playwright sandbox (Python/JS/bash, 40+ agent-browser commands, live view)
   - `credit-usage` -- cost monitoring

5. **Unix-native output.** CLI outputs to stdout by default, making it composable with Unix tools:
   ```bash
   firecrawl search "query" --pretty | head -50
   firecrawl https://example.com -o content.md
   firecrawl map https://example.com | wc -l
   firecrawl https://example.com --format links | jq '.links[].url'
   ```

6. **Built-in auth and status.** `firecrawl login` handles authentication. `firecrawl --status` shows version, auth status, concurrency limits, and remaining credits -- no separate monitoring needed.

7. **Cross-project portability.** Global install makes `firecrawl` available in every project's Bash tool. The skill files in `.claude/` can be copied to any project. This matches the "infrastructure, not product" philosophy.

### Why NOT Option B (MCP Server)

Option B was the original decision but was revised after reviewing the full CLI documentation:

1. **Wrong recommendation target.** Firecrawl recommends MCP for "AI tools" (Cursor, VS Code, Windsurf) and CLI for "AI agents" (Claude Code). We are an agent, not a tool.

2. **Background process complexity.** MCP requires a persistent server process. On Windows with `cmd /c npx`, this introduces: cold-start latency, env var interpolation uncertainty in `.mcp.json`, process crashes without graceful degradation, and the need for `.mcp.json` configuration.

3. **Same capabilities, more complexity.** The CLI provides the exact same API endpoints (scrape, search, map, crawl, extract, interact) through simpler invocations. MCP adds structured tool schemas but at the cost of process management overhead that outweighs the benefit for interactive use.

4. **No built-in cost monitoring.** MCP tools don't expose `--status` or credit checks. The CLI has `firecrawl --status` and `firecrawl credit-usage` built in.

### Why NOT Options C/D

The SDK adds value only for programmatic pipelines outside of Claude Code sessions. Today's use cases are all interactive. When ToratNetz needs automated corpus building, the SDK earns its place -- in that project, not in the harness.

## Implementation

### 1. Install Firecrawl Skill + CLI

```bash
# Install the CLI globally
npm install -g firecrawl-cli

# Install the Skill (knowledge files for Claude Code)
npx -y firecrawl-cli@latest init --all --browser
```

The `init --all` command detects Claude Code and generates skill/rule files in `.claude/` that teach the agent about Firecrawl capabilities. The `--browser` flag opens the browser for authentication.

Verify:
```bash
firecrawl --version
```

### 2. Authenticate

Option A (recommended -- persistent):
```bash
firecrawl login --api-key fc-YOUR-API-KEY
```

Option B (env var -- add to `~/.bashrc`):
```bash
export FIRECRAWL_API_KEY="fc-..."
```

Verify:
```bash
firecrawl --status
# Should show: Authenticated, credits remaining, concurrency limits
```

### 3. Add Bash Permissions

File: `.claude/settings.local.json` (per-project, not committed)

Add to the `allow` array:
```
"Bash(firecrawl:*)"
```

This allows all `firecrawl` CLI commands without per-command prompting. Consistent with existing Bash permissions pattern.

### 4. Review Generated Skill Files

After step 1's `init --all`, review the generated files in `.claude/`. Some may overlap with existing harness skills. Keep what adds value, discard or adapt the rest.

### 5. Disable Telemetry (Optional)

Add to `~/.bashrc`:
```bash
export FIRECRAWL_NO_TELEMETRY=1
```

Telemetry collects: CLI version, OS, Node.js version, dev tool detection. No command data, URLs, or file contents.

### 6. No MCP Configuration Needed

No `.mcp.json` file. No `enabledPlugins` entry. No MCP server process. The CLI is a standalone tool accessed via Bash.

### 7. Update Almanak Agent (Minor)

File: `.claude/agents/almanak.md`

Clarify scope boundary: Context7 is for library documentation. Firecrawl CLI is for web content scraping. They serve different purposes.

## CLI Command Reference

### Scrape
```bash
firecrawl https://example.com                              # Default: markdown
firecrawl https://example.com --only-main-content           # Clean output (recommended)
firecrawl https://example.com --format markdown,html,links  # Multiple formats (JSON)
firecrawl https://example.com --screenshot                  # Take screenshot
firecrawl https://example.com --wait-for 3000               # Wait for JS rendering
firecrawl https://example.com -o output.md                  # Save to file
```

### Search
```bash
firecrawl search "query" --limit 5 --pretty                # Web search
firecrawl search "query" --scrape --scrape-formats markdown # Search + scrape results
firecrawl search "query" --tbs qdr:w                       # Last week only
firecrawl search "query" --categories github,research       # Category filter
```

### Map
```bash
firecrawl map https://example.com                           # Discover all URLs
firecrawl map https://example.com --search "blog"           # Filter URLs
firecrawl map https://example.com --include-subdomains      # Include subdomains
```

### Crawl
```bash
firecrawl crawl https://example.com --limit 50 --max-depth 3 --wait --progress
firecrawl crawl https://example.com --include-paths /docs --wait -o docs.json
```

### Agent
```bash
firecrawl agent "Find top 5 AI startups and funding" --wait
firecrawl agent "Compare pricing" --urls https://a.com,https://b.com --wait
firecrawl agent "Get company info" --schema '{"name":"string"}' --wait
```

### Browser
```bash
firecrawl browser launch-session
firecrawl browser execute "open https://example.com"
firecrawl browser execute "snapshot"
firecrawl browser execute "click @e5"
firecrawl browser execute "scrape"
firecrawl browser close
```

### Credit Usage
```bash
firecrawl credit-usage --json --pretty
```

## Overlap Analysis: Firecrawl CLI vs Existing Tools

| Capability | WebSearch | WebFetch | Context7 | Firecrawl CLI |
|-----------|-----------|----------|----------|---------------|
| Web search | General search | No | Library docs only | `search` -- with scraping, filters, categories |
| Single page fetch | No | Raw HTML (domain-locked) | Docs only | `scrape` -- clean markdown/HTML/JSON |
| Recursive crawl | No | No | No | `crawl` -- depth/page limits, progress |
| Site mapping | No | No | No | `map` -- URL discovery with filters |
| Dynamic content (JS) | No | Limited | No | `browser` -- cloud Playwright sandbox |
| Structured extraction | No | No | No | `agent` -- with JSON schema output |
| Form interaction | No | No | No | `browser execute` -- click, fill, navigate |
| Screenshot | No | No | No | `scrape --screenshot` |
| Autonomous research | No | No | No | `agent` -- multi-step web gathering |
| Library documentation | No | Possible | Primary source | Not its purpose |
| Cost | Free | Free | Free (plugin) | Per-request API credits |
| Access method | Native tool | Native tool | MCP plugin | Bash CLI commands |

**Usage guidelines:**
- **Library docs**: Always Context7 first (almanak agent). Firecrawl is not for this.
- **Quick factual search**: WebSearch. Free, fast, sufficient for "what version of X supports Y?"
- **Fetch a known URL**: WebFetch if the domain is allowlisted. Firecrawl if you need clean markdown or the domain is not allowlisted.
- **Scrape a page for content**: `firecrawl scrape` with `--only-main-content`. Returns clean markdown.
- **Crawl a site**: `firecrawl crawl` only. Always specify `--limit` and `--max-depth`.
- **Interact with dynamic page**: `firecrawl browser`. Cloud sandbox, no local browser needed.
- **Autonomous research**: `firecrawl agent`. Natural language prompts, optional schema for structured output.
- **Discover site structure**: `firecrawl map`. Fast URL discovery before deciding what to crawl.

## Cost Controls

Firecrawl charges per API request. Uncontrolled usage could generate unexpected costs.

Mitigation strategies:
1. **Awareness**: Prefer free tools (WebSearch, WebFetch, Context7) when they suffice.
2. **Crawl limits**: Always specify `--limit` and `--max-depth` when crawling. Never crawl open-ended.
3. **Credit monitoring**: Use `firecrawl credit-usage` and `firecrawl --status` to check remaining credits.
4. **Agent cost caps**: Use `--max-credits` flag with `firecrawl agent` to limit per-job spend.
5. **No auto-invocation**: Firecrawl should NOT be auto-invoked. Use only when the user's request clearly requires web scraping or when explicitly asked.
6. **Observation tracking**: `observe-pre`/`observe-post` hooks already log all Bash calls including firecrawl commands.

## Consequences

- **What changes**:
  - New global CLI: `npm install -g firecrawl-cli` (system PATH).
  - New Bash permissions in `settings.local.json` for `firecrawl` commands.
  - New environment variable or stored credentials: `FIRECRAWL_API_KEY`.
  - Optional: skill files from `firecrawl-cli init --all`.
  - Minor update to almanak agent to clarify scope boundaries.

- **What does NOT change**:
  - No new hooks. `observe-pre`/`observe-post` already capture Bash calls.
  - No new agents. Firecrawl is a CLI tool, not a domain requiring a specialist agent.
  - No new dependencies in `package.json`. CLI is installed globally.
  - No `.mcp.json` file. No MCP server process.
  - No changes to `settings.json` (tracked). Only `settings.local.json` (untracked).

- **Migration**:
  1. `npm install -g firecrawl-cli`
  2. `firecrawl login --api-key fc-...` or set `FIRECRAWL_API_KEY`
  3. Add `Bash(firecrawl:*)` to `settings.local.json`
  4. Verify: `firecrawl --status`
  5. Optional: `npx -y firecrawl-cli@latest init --all` for skill files

- **Risks**:
  - API cost overruns. Mitigation: credit monitoring, `--max-credits` for agent, crawl limits, no auto-invocation.
  - CLI version breaking changes. Mitigation: `npm update -g firecrawl-cli` when needed. Pin version if stability is critical.
  - Global install pollutes system PATH. Mitigation: single binary (`firecrawl`), low risk.
  - `npx` commands may have Windows path issues. Mitigation: global install avoids npx entirely for daily use.

- **Future**:
  - When ToratNetz needs batch corpus building, add `@mendable/firecrawl-js` SDK as a project dependency in that project (not in the harness).
  - If Firecrawl becomes an official Claude plugin, evaluate migrating to `enabledPlugins` for consistency.
  - Consider a `web-researcher` agent if web scraping becomes a frequent multi-step workflow.
  - Consider creating `firecrawl-patterns.md` skill after 2+ weeks of usage.

- **Review date**: 2026-04-15 (after 2 weeks of usage, assess cost and utility).

## Revision History
- 2026-04-01: Initial decision -- Option B (MCP Server)
- 2026-04-01: Revised to Option A (Skill + CLI) after reviewing full CLI documentation. Skill + CLI is Firecrawl's recommended approach for AI agents, simpler (no background process), and provides the same capabilities.
