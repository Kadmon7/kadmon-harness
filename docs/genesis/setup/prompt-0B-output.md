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
- Token: stored as Windows user environment variable `GITHUB_TOKEN`, referenced via `${GITHUB_TOKEN}` in MCP config

## Other MCP Servers Found
- Supabase MCP (claude.ai managed) was already connected

## Resolved Issues
- Initial PAT was exposed in chat — revoked and replaced with a new token.
- Token storage upgraded: moved from hardcoded value to `${GITHUB_TOKEN}` system environment variable (best practice).
- MCP tools require Claude Code session restart to appear as callable tools.

## Status
Phase 0-B complete.
