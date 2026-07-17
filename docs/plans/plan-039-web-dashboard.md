---
number: 39
title: Kadmon OS web dashboard (local telemetry + catalog UI)
date: 2026-07-17
status: pending
needs_tdd: true
route: B
---

## Plan: Kadmon OS web dashboard [fable]

> Approved 2026-07-17 by Ych118 (in-session gate). Status flips to `in_progress`
> when the implementing session claims Step 1.

### Overview

A local, read-only web dashboard for the harness: one `node:http` server bound to
127.0.0.1 serving a single dark-themed HTML page that shows (a) the component
catalog (agents / skills / commands / hooks) scanned live from disk and (b) live
telemetry from `~/.kadmon/kadmon.db` (instincts with confidence, recent sessions,
cost, hook health, agent usage, orphan count). No framework, no new dependencies:
`node:http` + existing `state-store` getters + one static HTML file with inline
CSS/JS polling JSON endpoints every 10s.

This plan was authored by the main (Fable) session as the complete strategy; every
implementation step below is executable by a Sonnet-tier session (see "Model
routing"). The plan is self-contained — no conversation context required.

### Decision Context (recorded 2026-07-17 — do not relitigate)

- ECC's `ecc_dashboard.py` (Tkinter, 947 lines, reference clone at
  `C:\Command-Center\_reference\ECC`) was evaluated and REJECTED as an adaptation
  base: it is a catalog browser only (no telemetry), its data loaders are bound to
  ECC's directory layout (~10% reuse), and a Python/Tkinter GUI is an alien stack
  in this TypeScript repo. Visual inspiration only (dark warm background, orange
  accent, monospace labels, 3-column catalog, stats footer).
- Build from scratch in TypeScript, web-over-desktop: works identically on the
  Windows (Git Bash) and Mac machines the team uses.
- v1 is deliberately framework-free (no React/Vite/Express). If the UI grows past
  one page, revisit with an ADR. An ADR for this stack decision MAY be minted by
  arkitect at implementation kickoff; until then this section carries the evidence.

### Assumptions (validated against the tree 2026-07-17)

- `scripts/lib/state-store.ts` is a barrel re-exporting `./state-store/*`; the
  getters listed in Phase 0 exist with these exact names. Re-verify signatures at
  implementation time before coding against them.
- `scripts/dashboard.ts` (the `/nexus` CLI) already demonstrates the wiring
  pattern: `detectProject()` -> `openDb()` -> queries -> render -> `closeDb()`.
- `sessions` table PK column is `id` (NOT `session_id`); ORDER BY needs a `rowid`
  tiebreaker for deterministic results (CLAUDE.md pitfalls).
- DB path: `path.join(homedir(), ".kadmon", "kadmon.db")`; tests override via
  `KADMON_TEST_DB` (`:memory:` or a temp file).
- `package.json` has no `dashboard:*` script yet; `tsx` is invoked via `npx tsx`
  elsewhere (CLAUDE.md Quick Start), so the new script uses `npx tsx`.
- Since commit (pending) "forge-blind fix", observations may live in BOTH
  `observations.jsonl` (live) and `observations.archive.jsonl` (archived per-turn
  past message 20) inside `os.tmpdir()/kadmon/<sessionId>/`. Any active-session
  detection must consider both files.
- No new npm dependencies are needed or allowed in v1 (`sql.js` + `zod` are the
  only runtime deps today).

### Phase 0: Research (DONE — recorded for the implementer; re-read these files first)

- [x] `scripts/lib/state-store.ts` + `scripts/lib/state-store/*.ts` — getters:
  `getRecentSessions`, `getOrphanedSessions`, `getSession` (sessions);
  `getActiveInstincts(projectHash)`, `getInstinctCounts(projectHash)` (instincts);
  `getCostSummaryByModel(projectHash)`, `getCostBySession(sessionId)` (cost);
  `getHookEventStats(...)` (hook-events); `getAgentInvocationStats(...)`
  (agent-invocations). Read each signature before use.
- [x] `scripts/dashboard.ts` — `findActiveSessionDir(tmpBase?)` is exported and
  reusable; `loadObservations(sessionId)` shows the JSONL read pattern.
- [x] `scripts/lib/project-detect.ts` — `detectProject()` yields `projectHash`.
- [x] `.claude/rules/common/hooks.md` — hook latency budgets: observe-pre/post
  < 50ms, no-context-guard < 100ms, all others < 500ms; documented exceptions
  (`post-edit-typecheck.js`, `quality-gate.js`, `post-edit-format.js`) are
  toolchain-bounded and must be labeled "exempt" in the UI, not flagged red.
- [x] Catalog sources: `.claude/agents/*.md` (exclude `CATALOG.md`,
  `_TEMPLATE.md.example`), `.claude/skills/*/SKILL.md`, `.claude/commands/*.md`
  (exclude `CATALOG.md`), hooks from `.claude/settings.json` hook registrations
  (count unique script names; verify against `.claude/hooks/CATALOG.md`'s "23
  registered" figure and prefer the mechanical settings.json count).
- [x] Frontmatter parsing precedent: `scripts/lib/medik-checks/frontmatter.ts`
  (`parseFrontmatterStatus`) — mirror the regex style; do NOT add a YAML dep.

### Endpoint contracts (v1 — exactly three routes, all GET, read-only)

`GET /` -> `text/html` — serves `scripts/dashboard-web/index.html` from a fixed
path (no user-controlled path segment anywhere; nothing else is served).

`GET /api/catalog` -> `application/json`:

```typescript
interface CatalogResponse {
  agents: { name: string; model: string; description: string }[];
  skills: { name: string; description: string }[];
  commands: { name: string; description: string }[];
  hookCount: number;
  testFileCount: number;        // fs scan of tests/**/*.test.ts
  generatedAt: string;          // ISO timestamp
}
```

`GET /api/telemetry` -> `application/json`:

```typescript
interface TelemetryResponse {
  projectHash: string;
  instincts: {
    counts: { active: number; global: number; project: number };
    items: { id: string; pattern: string; confidence: number;
             occurrences: number; scope: string; lastReinforced: string | null }[];
  };
  sessions: {
    recent: { id: string; startedAt: string; messageCount: number;
              filesModified: number; costUsd: number | null; summary: string | null }[];
    orphanCount: number;
  };
  cost: { byModel: { model: string; totalUsd: number; inputTokens: number;
                     outputTokens: number }[] };
  hookHealth: { hookName: string; avgDurationMs: number | null; events: number;
                blocked: number; budgetMs: number; exempt: boolean }[];
  agents: { agentType: string; invocations: number; successRate: number | null;
            avgDurationMs: number | null }[];
  generatedAt: string;
}
```

Unknown routes -> `404` JSON `{ "error": "not found" }`. Any handler error ->
`500` JSON `{ "error": "<message>" }` with the detail logged server-side only
(never leak stack traces to the response).

### File-by-file spec

| File | Responsibility | Budget |
|---|---|---|
| `scripts/dashboard-web.ts` | Entry: parse `KADMON_DASHBOARD_PORT` (default 4321, Zod-validate 1024-65535), create `node:http` server on `127.0.0.1`, route table for the 3 routes, graceful SIGINT close (`closeDb()`), startup log with URL | < 150 lines |
| `scripts/lib/dashboard-web-data.ts` | Pure data assembly: `buildCatalog(rootDir)` (fs scans + frontmatter regex) and `buildTelemetry(projectHash)` (state-store getters + budget mapping). No http, no console. All fs roots injectable for tests | < 250 lines |
| `scripts/dashboard-web/index.html` | Single-file UI, inline CSS/JS, fetch + render both endpoints, 10s poll. Single-artifact exception to the 200-line preference — acceptable up to ~400 lines | < 400 lines |
| `tests/lib/dashboard-web-data.test.ts` | Unit tests for both builders (temp-dir fixtures + `KADMON_TEST_DB`) | — |
| `tests/lib/dashboard-web-server.test.ts` | Smoke: start server on port 0 (ephemeral), `fetch` all 3 routes + a 404, assert shapes and `127.0.0.1` bind | — |

### UI wireframe (encode this layout; design tokens below)

```
+----------------------------------------------------------------------+
| KADMON HARNESS          v1.4.0            [dot] LIVE - polls every 10s |
+----------------------------------------------------------------------+
| AGENTS 16          | SKILLS 53              | COMMANDS 12             |
| name [model badge] | name — description...  | /name — description...  |
| (scroll list)      | (scroll list)          | (scroll list)           |
+----------------------------------------------------------------------+
| INSTINCTS (star panel, full width)                                    |
| pattern-name  [############----] 0.72  x9  project  2026-07-15        |
+----------------------------------------------------------------------+
| SESSIONS + orphans | COST by model          | HOOK HEALTH | AGENT USE |
+----------------------------------------------------------------------+
| footer: N hooks - N test files - DB path - generatedAt                |
+----------------------------------------------------------------------+
```

Design tokens (dark-only v1): bg `#16120f`; panel `#1e1915`; border `#382f27`;
accent `#e56b3c` (hover `#ff7d4d`); text `#f2ead9`; muted `#8d8073`; font
`ui-monospace, 'JetBrains Mono', monospace`; section labels 11px uppercase
letter-spaced with an orange dot; large numerals for counts; 10px card radius.
Confidence bars: accent fill on `#382f27` track. Hook rows over budget: red
`#d4544a` unless `exempt` (then muted with "exempt" tag).

### Security requirements (spektr will review against these)

- Server binds `127.0.0.1` explicitly — never `0.0.0.0`.
- Read-only: no POST/PUT/DELETE handlers, no exec, no mutation of any file or DB.
- No user-controlled paths: `index.html` is read from one fixed constant path.
- `KADMON_DASHBOARD_PORT` validated with Zod before use; invalid -> fail fast.
- Responses never include stack traces, absolute paths beyond the footer DB path,
  or env contents. Instinct/session text comes from the DB (already scrubbed at
  observation time by `scrub-secrets.js`) — do not add new raw-text sources.

### Implementation steps (TDD red-green per step; feniks enforces)

- [ ] Step 1: `buildCatalog` (M) — Sonnet
  - New `scripts/lib/dashboard-web-data.ts` + test file. Red: fixture tree in a
    temp dir (2 agents incl. one `CATALOG.md` to exclude + `_TEMPLATE.md.example`,
    2 skills, 2 commands, settings.json with 3 hook scripts) -> expected counts,
    names, model frontmatter extraction. Green: implement with `node:fs` scans +
    frontmatter regex (mirror `medik-checks/frontmatter.ts` style).
  - Verify: `npx vitest run tests/lib/dashboard-web-data.test.ts`.
- [ ] Step 2: `buildTelemetry` (M) — Sonnet
  - Same module. Red: `KADMON_TEST_DB` seeded via existing state-store insert/
    upsert helpers (sessions incl. one orphan, instincts at two confidences,
    cost events for two models, hook events incl. one blocked + one exempt hook
    name, agent invocations with one failure) -> assert every `TelemetryResponse`
    field incl. budget mapping (50/100/500) and `exempt` flags. Green: implement
    over the Phase 0 getters only — if a needed aggregate is missing, compute it
    in this module from getter output; do NOT add SQL here.
  - Verify: same test file green; no direct `getDb()` usage in the module.
- [ ] Step 3: server + routes (M) — Sonnet
  - New `scripts/dashboard-web.ts` + smoke test. Red: server on port 0 -> `GET /`
    returns HTML containing `KADMON`, both APIs return valid JSON matching the
    interfaces, unknown route -> 404, bind address is `127.0.0.1`. Green:
    implement routes calling the two builders; port/env Zod validation.
  - Verify: smoke test green on Windows (no hardcoded `/tmp`).
- [ ] Step 4: `index.html` UI (M) — Sonnet
  - Implement the wireframe with the design tokens; render from the two payloads;
    10s `setInterval` poll; graceful "DB empty" states (dashes, never NaN).
    No test beyond Step 3's content smoke — visual QA is the acceptance check.
- [ ] Step 5: active-session awareness for `/nexus` parity (S) — Sonnet
  - Extend `findActiveSessionDir` in `scripts/dashboard.ts` to also consider
    `observations.archive.jsonl` mtime (post forge-blind-fix reality). Red first
    in `tests/lib/dashboard.test.ts`. This keeps the CLI and web dashboard
    consistent about "active session".
- [ ] Step 6: wiring + docs (S) — Sonnet
  - `package.json`: `"dashboard:web": "npx tsx scripts/dashboard-web.ts"`.
  - CLAUDE.md: Quick Start line + `KADMON_DASHBOARD_PORT` in Environment
    Variables; BACKLOG.md entry flip; note in `.claude/commands/nexus.md` if it
    references dashboards.
  - Verify: `npm run dashboard:web` opens `http://127.0.0.1:4321` with live data.

Escalation rule (cost control, per the Fable-orchestrator pattern): every step is
Sonnet-executable as specced. If any single step needs a 3rd red-green attempt or
an unforeseen design choice (schema mismatch, getter signature drift), STOP and
escalate that step to Opus (arkitect for design questions, konstruct for
re-scoping) instead of improvising in Sonnet.

### Acceptance criteria

- `npm run dashboard:web` serves on `http://127.0.0.1:4321` on Windows Git Bash
  AND macOS; Ctrl+C shuts down cleanly (DB closed).
- Every count on the page is computed from disk/DB at request time — zero
  hardcoded component numbers anywhere in the three new files.
- Full suite green (baseline at plan time: 1462 passed / 1 pre-existing skip);
  typecheck + lint clean; no new npm dependencies.
- `/chekpoint full` passes: typescript-reviewer + spektr (security section above)
  + kody, zero BLOCKs.

### Out of scope (v1)

- Phase 2 candidates (design accommodates, do not build): /medik last-run
  semaphore, BACKLOG.md P0/P1 pulse, pending ClusterReports panel, multi-project
  selector via projectHash, fork version drift, SSE push refresh, light theme
  toggle, per-day cost chart.
- Phase 3 parking lot (ideas recorded 2026-07-17, unscoped — top 3 starred):
  (*) live session feed (tail of the active session's observations incl. archive —
  "what is Claude doing right now"); (*) skill usage heatmap (which of the 53
  skills actually fire vs never — data-driven pruning candidates); (*) cost
  burn-rate panel (configurable monthly budget, burn bar, projection, per-session
  alert threshold); session replay timeline for postmortems (tools/files/agents/
  cumulative cost per past session); review quality metrics (BLOCK/WARN counts
  per /chekpoint run, TDD first-pass-green rate); hook block feed (recent exit-2
  blocks with reasons); commit/release panel (git log with Reviewed: tier,
  version vs CHANGELOG); read-only memory browser (MEMORY.md + memory/*.md);
  instinct confidence timeline (REQUIRES new instinct_history table — schema
  change, defer to v2 planning); visual alert states (orphans > 0, instinct >=
  0.7 "ready to promote", hook over budget) — the alert states are cheap enough
  to fold into any Phase 2 pass. Explicitly rejected: any action/exec button
  (run /medik etc.) — violates the read-only contract that keeps this tool safe;
  would need its own ADR with a confirmation model if ever revisited.
- Auth of any kind (localhost-only tool), HTTPS, remote access, write endpoints.
- Electron/Tauri packaging.

### Effort estimate

M overall: ~6-8 focused hours for a Sonnet implementer following the steps in
order (1-2h catalog, 1-2h telemetry, 1h server, 2h UI, 1h wiring/docs/review).

### Risks

- Getter signature drift between plan-time and implementation-time — mitigated by
  Phase 0 re-read instruction and the escalation rule.
- sql.js WASM cold-start adds ~1s to first request — acceptable for a local tool;
  do not add caching complexity in v1 (the 10s poll re-queries; if profiling shows
  pain, memoize `buildTelemetry` for 5s max, behind a test).
- `settings.json` hook-count parsing is the one catalog source without a precedent
  helper — keep it a dumb unique-script-name count; if ambiguous, fall back to
  counting `.claude/hooks/scripts/*.js` minus the shared-module list in
  `.claude/hooks/CATALOG.md` and document which source won.
