---
name: documentation-lookup
description: Fetch live library and framework documentation via the Context7 MCP server instead of relying on training-data recall — supports React, Next.js, Prisma, Supabase, Tailwind, FastAPI, Django, and hundreds more. Use this skill whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service (even well-known ones), asks setup/configuration questions ("How do I configure X?"), requests code that depends on a specific library ("Write a Prisma query for..."), needs API reference information, or mentions a library or version by name. Also use whenever the user says "look up the docs", "check Context7", "current docs for X", "what's the latest API for X", or when unfamiliar APIs appear in code being reviewed. Do NOT use for generic programming concepts, refactoring business logic, or code review — those don't need live docs.
---

# Documentation Lookup (Context7)

When the user asks about a library, framework, or API, fetch current documentation via the Context7 MCP server instead of relying on training-data recall. Training data ages; Context7 is a live index.

## Why This Skill Exists

LLM training data has a cutoff date. Libraries evolve — APIs change, flags get renamed, recommended patterns shift. Answering from recall can be wrong in ways that look confident. Context7 returns real documentation from the current release, which is almost always what the user actually needs.

## When to Use

Activate when the user:

- Asks setup or configuration questions ("How do I configure Next.js middleware?")
- Requests code that depends on a library ("Write a Prisma query for relations")
- Needs API reference information ("What are Supabase auth methods?")
- Mentions a specific framework or library (React, Vue, Next.js, Prisma, Supabase, Tailwind, FastAPI, Django, Express, etc.)
- Is about to use an API from memory and the API is older than ~12 months
- Asks about CLI tools or cloud services (gh, aws, gcloud, supabase CLI)

### Do Not Use When

- The question is about general programming concepts (data structures, algorithms, design patterns)
- The task is refactoring business logic or debugging code where the library is not the issue
- The user is configuring the Kadmon harness itself (that's `update-config` / `rules/`)
- A dedicated internal skill already has authoritative information (e.g., `claude-api` for the Anthropic SDK)

## How It Works

### Step 1 — Resolve the Library ID

Call the Context7 MCP tool **resolve-library-id** with:

- `libraryName` — the library or product name taken from the user's question (e.g. `Next.js`, `Prisma`, `Supabase`)
- `query` — the user's full question. This improves relevance ranking

You **must** obtain a Context7-compatible library ID (format `/org/project` or `/org/project/version`) before querying docs. Do not call `query-docs` without a valid ID.

### Step 2 — Select the Best Match

From the resolution results, choose one using:

- **Name match** — prefer exact or closest match
- **Benchmark score** — higher = better documentation quality
- **Source reputation** — prefer High or Medium when available
- **Version** — if the user mentioned a version ("React 19", "Next.js 15"), prefer a version-specific ID

### Step 3 — Fetch Documentation

Call the Context7 MCP tool **query-docs** with:

- `libraryId` — the selected ID from Step 2 (e.g. `/vercel/next.js`)
- `query` — the user's specific question. Be specific for relevant snippets

**Budget**: do not call `query-docs` or `resolve-library-id` more than 3 times per question. If the answer is still unclear after 3 calls, state the uncertainty and work with the best information you have rather than guessing.

### Step 4 — Use the Documentation

- Answer using the fetched, current information
- Include minimal, relevant code examples from the docs when helpful
- Cite the library and version when it matters ("In Next.js 15...")
- Never paste irrelevant docs into the response — pick the smallest excerpt that answers the question

## Examples

### Example 1 — Next.js middleware

1. `resolve-library-id` with `libraryName: "Next.js"`, `query: "How do I set up middleware?"`
2. Pick `/vercel/next.js` by name + benchmark score
3. `query-docs` with that ID and the question
4. Return the answer with a minimal `middleware.ts` snippet from the docs

### Example 2 — Prisma relational query

1. `resolve-library-id` with `libraryName: "Prisma"`, `query: "query with relations"`
2. Select the official Prisma ID (e.g. `/prisma/prisma`)
3. `query-docs` for the relational query pattern
4. Return the Prisma Client pattern (`include` or `select`) with a short example

### Example 3 — Supabase auth methods

1. `resolve-library-id` with `libraryName: "Supabase"`, `query: "auth methods"`
2. Pick the Supabase docs library ID
3. `query-docs` and summarize the methods with minimal examples

## Best Practices

- **Be specific in queries** — the user's full question produces better relevance ranking than a one-word topic
- **Respect versions** — when the user mentions a version, use a version-specific library ID if available
- **Prefer official sources** — when multiple matches exist, pick the official package over community forks
- **Never leak secrets** — the user's question might contain an API key or credential. Redact those before passing the query to Context7
- **Summarize, don't paste** — return the minimum excerpt that answers the question; avoid flooding the response with irrelevant doc snippets

## Integration

- **almanak agent** (sonnet) — primary owner. almanak is the harness's library-lookup specialist; it is auto-invoked whenever unfamiliar APIs appear or the `no_context` principle requires verification. This skill is the playbook almanak follows when it reaches for Context7.
- **Context7 MCP** — the execution layer. `.mcp.json` must have Context7 configured and authenticated for this skill to work; if the MCP is disabled, the skill must say so rather than invent an answer.
- **mcp-server-patterns skill** — sibling. Covers *how* to build and configure MCP servers; this skill covers *how to use* one specific server (Context7) from the consumer side.
- **deep-research skill** — complementary. `deep-research` handles multi-source web investigation; `documentation-lookup` is the fast path for "I just need the API reference".
- **/almanak command** — entry point. `/almanak` loads this skill and almanak executes the 4-step flow.

## no_context Application

This skill exists **because** the `no_context` principle demands evidence, and training-data recall is not evidence when it concerns a library that changes. Before answering a library question, verify the answer by calling Context7 — even for libraries you "know". If Context7 returns no match, the correct response is to state the gap ("Context7 has no match for `libraryX`, working from general patterns") rather than to guess silently. Treat any API you haven't verified against current docs in the last few months as unknown by default.
