# Prompt 0-B Output — MCP Setup

## Date
2026-03-23

## Prerequisites Installed
- Node.js: v24.14.0 (LTS, installed via winget)
- npx: v11.9.0

## GitHub MCP
- Name: github
- Command: `npx -y @modelcontextprotocol/server-github`
- Status: Connected (verified via `claude mcp list`)

## Test Result
- MCP server connected successfully
- GitHub MCP tools require session restart to appear as callable tools

## Config Location
- File: `~/.claude.json` (user-level, NOT in repo)
- Section: `projects > C:/Proyectos Kadmon/Kadmon-Harness > mcpServers > github`
- Token stored as environment variable in the config — not committed to git

## Other MCP Servers Found
- Supabase MCP (claude.ai managed) was already connected

## Warnings
- **SECURITY:** The GitHub PAT was shared in chat history. Recommend revoking and creating a new token.
- MCP tools may not be available until Claude Code session is restarted.
- No config file was created inside the repo — MCP config lives in user-level `~/.claude.json`.

## Status
Phase 0-B complete. Waiting for architect approval before Prompt 1.
