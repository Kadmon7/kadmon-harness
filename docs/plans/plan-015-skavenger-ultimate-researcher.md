---
number: 15
title: Skavenger ULTIMATE Researcher
date: 2026-04-17
status: completed
needs_tdd: true
route: A
adr: ADR-015-skavenger-ultimate-researcher.md
---

# Plan 015: Skavenger ULTIMATE Researcher [konstruct]

## 1. Overview

This plan converts ADR-015's 12 features and Q1-Q5 decisions into a 7-commit sequence that turns skavenger from a multi-source synthesizer into a true investigator. Each commit leaves the tree green (build + typecheck + vitest + linter 16/16) and is independently revertible. Implementation is gated on user greenlight after plan approval; feniks will guide TDD on Commits 2 and 5 where new production logic lands in `scripts/lib/`.

`needs_tdd: true` because three new pieces of production logic require red-green-refactor discipline: (1) `scripts/lib/github-research.ts` wrapping `gh api` (new network surface), (2) `research_reports` CRUD in `state-store.ts` (new table, camelCase/snake_case mapping, JSON column parsing), and (3) the FTS5-capability-probe-with-LIKE-fallback (branching logic with two correctness paths that must be individually verified). Commits 3/4/6 mostly edit agent/command markdown and orchestrate already-tested helpers, so they ride lite reviews rather than full TDD cycles.

## 2. Architectural References

- `docs/decisions/ADR-015-skavenger-ultimate-researcher.md` — Q1-Q5 decisions, 12-feature scope, R1-R8 risks, rollback matrix
- `docs/decisions/ADR-009-deep-research-capability.md` — original caps floor (D5), D7 extension seam, routing contract (unchanged)
- `docs/decisions/ADR-014-rename-kerka-to-skavenger.md` — identity invariance
- `docs/decisions/ADR-005-forge-evolve-pipeline.md` — "pure pipeline + single mutator" ethos consumed by Q1 decision
- `docs/decisions/ADR-008-evolve-generate-pipeline.md` — observation pipeline precedent
- `docs/plans/plan-009-deep-research-capability.md` — format and depth template
- `docs/plans/plan-013-skills-subdirectory-structure.md` — commit-staging template for atomic multi-file plans
- `.claude/rules/common/development-workflow.md` — `/chekpoint` tier table (full/lite/skip semantics)
- `.claude/skills/deep-research/SKILL.md:104-115` — existing Task-tool parallelization doc that F9 finally activates

## 3. Files to Create

| Path | Purpose |
|---|---|
| `docs/research/README.md` | Convention doc: numbering, frontmatter schema, retention policy (live-forever), escape-hatch env var |
| `scripts/lib/github-research.ts` | `gh api` wrapper: issues, PRs, README, CHANGELOG, discussions — modeled on `youtube-transcript.ts` shape |
| `tests/lib/github-research.test.ts` | Unit tests: stubbed `gh` CLI on PATH, rate-limit parsing, auth-status branches, error passthrough |
| `tests/lib/state-store-research-reports.test.ts` | CRUD tests + FTS5 probe branch + LIKE fallback branch + session-scoped `--continue` query |

## 4. Files to Modify

| Path | Changes |
|---|---|
| `scripts/lib/schema.sql` | Append `CREATE TABLE IF NOT EXISTS research_reports (...)` + 3 indexes (session_id, generated_at DESC, slug) |
| `scripts/lib/types.ts` | Add `ResearchReport` interface (camelCase, mirrors SQL columns) + `ResearchFinding` interface for `/forge` JSON fence payload |
| `scripts/lib/state-store.ts` | Add `saveResearchReport()`, `queryResearchReports(params)`, `getResearchReport(number)`, `getLastResearchReportForSession(sessionId)`; private FTS5 capability probe with per-process cache; `mapResearchRow()` helper |
| `.claude/agents/skavenger.md` | Add `Task` to `tools:` frontmatter; add `untrusted_sources: true` frontmatter proposal in output contract; add F5/F6/F7 depth modes; add F8 Route D; add F9 parallelization instructions; add F10 diversity caps; add structured frontmatter-proposal fence + `research_findings` JSON fence to output format; add mandatory Open Questions section; **REMOVE** line 175 "never auto-write" clause |
| `.claude/commands/research.md` | Argument parser for `--plan`, `--verify`, `--continue`, `--drill N`, `--history Q`, `--verify-citations N`; auto-write of skavenger report to `docs/research/research-NNN-<slug>.md`; emit `research_finding` observations to `observations.jsonl`; honor `KADMON_RESEARCH_AUTOWRITE=off` |
| `.claude/skills/deep-research/SKILL.md` | Additive only: reference new modes (--plan, --verify, --drill) and point to skavenger.md for the rubric/caps; no methodology change |
| `.claude/hooks/scripts/evaluate-patterns-shared.js` | Explicit filter: `research_finding` observations pass through to observation log but do NOT contribute to existing ClusterReport pattern evaluation (R5 guard) |
| `CLAUDE.md` | DB table count 6 → 7; skavenger row/description updated; `/research` flags listed in commands section; new "Research artifact" entry in File Structure; status line bumped |
| `README.md` | `/research` examples with new flags + escape-hatch env var documented |
| `scripts/dashboard.ts` | New `research_reports: N` row in DB section |
| `.claude/rules/common/development-workflow.md` | `/research` command row updated with flags list |
| `.claude/rules/common/agents.md` | Skavenger skills column unchanged (still `deep-research`); Tools column note for `Task` if the catalog renders tools (scan first) |

## 5. Commit Sequence

Branch: `feat/plan-015-skavenger-ultimate`. Seven commits. Each commit must pass the full gate (build, typecheck, vitest, `lint-agent-frontmatter.ts` 16/16) before the next begins. Tier references map to `.claude/rules/common/development-workflow.md`.

---

### Commit 1 — Foundations: bootstrap + schema + types

**Complexity:** S-M. Additive only; no behavior change; no functional paths exercised yet.

**Files touched:**
- `docs/research/README.md` (new)
- `scripts/lib/schema.sql` (append table + indexes)
- `scripts/lib/types.ts` (add `ResearchReport`, `ResearchFinding`)

**Schema sketch (to be placed at the end of `schema.sql`, after `agent_invocations`):**

```sql
CREATE TABLE IF NOT EXISTS research_reports (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  report_number INTEGER NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  topic TEXT NOT NULL,
  path TEXT NOT NULL,
  summary TEXT,
  confidence TEXT CHECK (confidence IN ('High', 'Medium', 'Low')),
  caps_hit TEXT DEFAULT '[]',
  open_questions TEXT DEFAULT '[]',
  sub_questions TEXT DEFAULT '[]',
  sources_count INTEGER DEFAULT 0,
  untrusted_sources INTEGER DEFAULT 1,
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_research_reports_session ON research_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_research_reports_generated ON research_reports(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_reports_slug ON research_reports(slug);
```

**Types sketch (in `types.ts`):**

```ts
export interface ResearchReport {
  id: string;
  sessionId: string;
  reportNumber: number;
  slug: string;
  topic: string;
  path: string;
  summary: string | null;
  confidence: "High" | "Medium" | "Low" | null;
  capsHit: string[];
  openQuestions: string[];
  subQuestions: string[];
  sourcesCount: number;
  untrustedSources: boolean;
  generatedAt: string;
}

export interface ResearchFinding {
  claim: string;
  confidence: number; // 0..1
  sources: Array<{ url: string; title: string }>;
}
```

**Reuse:**
- Follow the same `IF NOT EXISTS` idempotent-migration pattern already used for `hook_events` and `agent_invocations`.
- Mirror the camelCase/snake_case convention documented in `types.ts:1-4`.

**Tests:** none new in this commit (types + schema are consumed in Commit 2). Existing suite must remain 576+ green — the schema change is additive with `IF NOT EXISTS`, proven safe by migration-idempotency tests already in `tests/lib/state-store.test.ts`.

**Acceptance:**
- `docs/research/` exists on disk with `README.md` explaining convention
- `npm run build && npx tsc --noEmit` green
- `npx vitest run` still 576+ passing
- `scripts/lib/schema.sql` diff contains exactly one new `CREATE TABLE` + three new indexes

**Gate:** build ✓, typecheck ✓, vitest unchanged count ✓, linter 16/16

**Tier:** skip. Rationale (`development-workflow.md`): additive docs + schema + type declarations, no runtime path exercised, no `.ts` logic touched. `Reviewed: skip (verified mechanically)` in commit footer.

**Risks:**
- R-schema-drift: if another in-flight plan adds a different table with the same name, merge conflict. Mitigation: plan owner confirms `git fetch && git log origin/main -20` shows no `research_reports` introduction before starting.

**Rollback:** `git revert` the single commit. `DROP TABLE IF EXISTS research_reports` is safe because no FKs reference it.

---

### Commit 2 — State-store CRUD + FTS5 probe (feniks-guided TDD)

**Complexity:** M-L. Most test-heavy commit. Two correctness branches (FTS5 MATCH vs LIKE) must be individually verified.

**Files touched:**
- `tests/lib/state-store-research-reports.test.ts` (new; RED first)
- `scripts/lib/state-store.ts` (GREEN)

**Functions to implement in `state-store.ts`:**

```ts
export function saveResearchReport(report: ResearchReport): void;
export function getResearchReport(reportNumber: number): ResearchReport | null;
export function getLastResearchReportForSession(sessionId: string): ResearchReport | null;
export function queryResearchReports(params: {
  query: string;
  limit?: number;
}): ResearchReport[];

// Private:
function hasFts5Support(): boolean;          // cached per-process
function ensureResearchFts5Table(): void;    // idempotent; no-op if unsupported
function mapResearchRow(row: Record<string, unknown>): ResearchReport;
```

**FTS5 probe strategy (Q2):**
- On first call to `queryResearchReports`, run `CREATE VIRTUAL TABLE IF NOT EXISTS research_reports_fts USING fts5(topic, summary, content=research_reports, content_rowid=rowid)` wrapped in try/catch.
- On success: cache `true`; run trigger-based sync on insert (in `saveResearchReport`); query via `MATCH`.
- On failure: cache `false`; `saveResearchReport` skips FTS insert; queries use `LIKE '%' || ? || '%'` against `topic || ' ' || summary`.
- konstruct's implementation note: probe decision between `SELECT fts5(?)` and `CREATE VIRTUAL TABLE` is left to the implementer — whichever sql.js v1.14.1 actually accepts without throwing. ADR-015 Open Question #4 acknowledged.

**Reuse:**
- `mapResearchRow()` follows the exact shape of `mapSessionRow()` at `state-store.ts:214-233`.
- Call `saveToDisk()` (existing wrapper) after every mutation — mandated by `rules/common/performance.md`.
- Use `parseJson()` helper at `state-store.ts:203` for the 3 JSON array columns (`caps_hit`, `open_questions`, `sub_questions`).

**Test cases (RED → GREEN; write in this order):**

1. **CRUD happy path:** `saveResearchReport` + `getResearchReport(1)` → round-trip preserves all fields including JSON arrays and boolean `untrustedSources`.
2. **Session-scoped continue (Q3):** insert two reports under `session_id=A` and one under `session_id=B`; `getLastResearchReportForSession('A')` returns the most recently `generated_at` one for A; returns `null` for unknown session (no cross-session fallback).
3. **Report-number uniqueness:** attempting to save a duplicate `report_number` throws a SQLITE_CONSTRAINT error (the CHECK/UNIQUE is enforced).
4. **FTS5 probe — supported branch:** mock/detect the FTS5 path; insert 3 reports with distinct topics; `queryResearchReports({ query: 'pgvector' })` returns only the matching one(s). If sql.js v1.14.1 does NOT ship FTS5 in the test environment, this test uses `vi.spyOn(hasFts5Support)` to force-return `true` and asserts the FTS5 branch code path runs; skipped with `.skipIf(!fts5Available)` only as a last resort.
5. **LIKE fallback branch:** force `hasFts5Support` to return `false`; same 3 reports; same query; same result via the LIKE path. Both branches must return equivalent results on the smoke input.
6. **Pagination / limit:** default `limit=10`, explicit `limit=1` honored.
7. **Empty DB:** `queryResearchReports({ query: 'anything' })` on empty table returns `[]`, does not throw.
8. **Probe caching:** assert `hasFts5Support` is called exactly once across 5 consecutive queries (per-process cache).

**Acceptance:**
- All 8 tests green
- `state-store.ts` net addition ~120-160 lines
- No change to existing function signatures
- `getDb()` pattern preserved (no new top-level state)

**Gate:** build ✓, typecheck ✓, vitest 576+ + 8 new tests green, linter 16/16, no new `any` introduced (spektr will spot this in the lite review)

**Tier:** lite (ts-reviewer). Rationale: single-file TS logic addition in `scripts/lib/`, no new security surface (no shell, no network, no file paths outside repo), but >50 LOC so not "trivial refactor". ts-reviewer checks naming/types/Node16 resolution and mapRow convention adherence. `Reviewed: lite (ts-reviewer)`.

**Risks:**
- R2 (ADR-015): FTS5 unknown in sql.js v1.14.1. Mitigation: the fallback branch is the primary path; FTS5 is opportunistic. Both branches tested.
- R-mapping: camelCase/snake_case drift. Mitigation: dedicated `mapResearchRow()` function, tested round-trip.

**Rollback:** `git revert`. No data loss — the table remains from Commit 1 but orphan (nothing writes to it).

---

### Commit 3 — Group A: Auto-doc + Open Questions + basic `--continue`

**Complexity:** M. Modifies 3 markdown files + 1 hook-adjacent helper; exercises the Commit 2 state-store via the command.

**Files touched:**
- `.claude/commands/research.md` (major rewrite of arg parsing + auto-write flow)
- `.claude/agents/skavenger.md` (add frontmatter-proposal fence requirement; add Open Questions mandatory section; REMOVE line 175 "never auto-write")
- `.claude/hooks/scripts/evaluate-patterns-shared.js` (add `research_finding` filter — skip pattern eval for this type, still let it through to observation log)

**Behavior after this commit:**

- `/research <topic>` (bare) — skavenger produces its report with a proposed frontmatter block (JSON fence) + mandatory Open Questions section + `research_findings` JSON fence. The `/research` command parses these, writes `docs/research/research-NNN-<slug>.md` with merged frontmatter, calls `saveResearchReport()`, and appends one `{type: "research_finding", ...}` observation per finding to `observations.jsonl`.
- `/research --continue` — command calls `getLastResearchReportForSession(sessionId)`, loads the report file as prior context into skavenger's prompt (wrapped in an "untrusted content" boundary block per Q5), and continues investigation. Appends a new section to the SAME file (not a new file). If no prior report exists for the session, returns `no_context` with hint "No prior research in this session — start fresh with `/research <topic>`".
- `KADMON_RESEARCH_AUTOWRITE=off` — command bypasses auto-write entirely; restores ADR-009 ephemeral behavior.

**Numbering (manual, per user decision):**
- Command lists `docs/research/research-*.md`, picks `max(NNN) + 1`, 3-digit zero-padded. Consistent with ADR/plan scanners.

**Reuse:**
- `saveResearchReport()` from Commit 2
- `getLastResearchReportForSession()` from Commit 2
- Slugification: reuse existing utility if present in `scripts/lib/utils.ts`; otherwise inline a 10-line slugify.

**Tests:** command-level markdown edits aren't directly unit-tested in this harness, but:
- `evaluate-patterns-shared.js` filter addition gets a unit test in `tests/lib/pattern-engine.test.ts` (or a sibling file): assert that `{type: "research_finding", ...}` observations pass through but do NOT contribute to ClusterReport output. R5 guard.
- Existing test suite must remain green; new test +1.

**Acceptance:**
- `rg -i "never auto-write" .claude/agents/skavenger.md` → 0 hits (exit criterion)
- `KADMON_RESEARCH_AUTOWRITE=off` mentioned in both `research.md` and `README.md` (next commit will wire README)
- Every report has a non-empty `open_questions[]` in its frontmatter (enforced in command by rejecting skavenger output that lacks the fence)
- `--continue` session-scoped (Q3)

**Gate:** build ✓, typecheck ✓, vitest +1 test green, linter 16/16

**Tier:** lite (ts-reviewer). Rationale: the hook-shared-module edit is <20 lines and has no auth/exec/path surface; the markdown rewrites are agent/command prose. ts-reviewer reviews the JS edit + eyeballs the command argv parsing logic for path-traversal risk (slug sanitization must prevent `../../../etc/passwd`). `Reviewed: lite (ts-reviewer)`.

**Risks:**
- R6 (ADR-015): backward compat break — users running `/research X` today get auto-write by default. Mitigation: escape hatch + release note in Commit 7.
- R3 (ADR-015): prompt injection via `--continue`. Mitigation: Q5 decision — `untrusted_sources: true` frontmatter + "untrusted content boundary" wrapper in skavenger's prompt when loading prior report.
- R-path-traversal: slug could be weaponized. Mitigation: `slug.replace(/[^a-z0-9-]/g, '-')` + assert resolved path stays within `docs/research/`.
- R-concurrent-numbering: two parallel sessions running `/research` simultaneously could race on `max+1`. Mitigation: `saveResearchReport()` has `UNIQUE(report_number)` — the losing session retries with `max+1` re-scanned, or fails with a clear error message. Documented as known limitation; acceptable for v1.

**Rollback:** `git revert`. State-store from Commit 2 becomes orphan again; no data corruption.

---

### Commit 4 — Group B: Depth modes (`--plan`, `--verify`, `--drill`, self-eval)

**Complexity:** M. Pure prompt/command engineering; no new `scripts/lib/` code.

**Files touched:**
- `.claude/commands/research.md` (add flag branches)
- `.claude/agents/skavenger.md` (add F5/F6/F7 mode instruction blocks + self-eval rubric section)
- `.claude/skills/deep-research/SKILL.md` (additive reference to the new modes; no methodology change)

**Behavior:**

- `/research --plan <topic>` — zero-fetch dry-run. skavenger outputs proposed sub-questions + candidate source domains + estimated cap consumption, then STOPS. No WebSearch/WebFetch/Bash calls. Command writes no file. User either refines or invokes without `--plan` to execute.
- `/research --verify <hypothesis>` — hypothesis-driven mode. skavenger's prompt is augmented with "you must search explicitly for pro and contra evidence; the Methodology section reports pro: N, contra: M; never unanimous-declare a winner when evidence is mixed".
- `/research --drill <N>` — command reads the last report for the session, extracts sub-question N from `open_questions[]`, spawns skavenger with that sub-question as the new topic and fresh caps. Output is a new report that cross-references the parent via a `derived_from: research-NNN` frontmatter field.
- **Self-evaluation pass (F7):** after skavenger emits its first-pass report, it scores itself on four axes (coverage, cross-verification ratio, recency median, source-type diversity). If the composite score is below the threshold AND caps remain, a second pass targets the weakest sub-question. Rubric lives in `skavenger.md` (in-prompt, tunable). **Threshold value: OPEN — calibrate post-deploy.** Plan marks this as a TODO comment in skavenger.md; ADR-015 Open Question section documents the calibration plan (2-week observation window).

**Reuse:** nothing from `scripts/lib/`; entirely prompt engineering.

**Tests:** none new at unit level (prompt behavior is evaluated by the E2E smoke test). Existing suite must remain green.

**Acceptance:**
- `--plan` path provably makes zero tool calls beyond Read/Grep/Glob (enforced by prompt + verified in smoke test)
- `--verify` output contains `pro: N, contra: M` line in Methodology
- `--drill N` creates a new report with `derived_from` frontmatter
- Self-eval section present in output; threshold has an explicit TODO with rationale

**Gate:** build ✓, typecheck ✓, vitest green, linter 16/16, `skavenger.md` line count monitored

**Tier:** lite (ts-reviewer — scanning for hidden TS/JS logic changes). If pure markdown, this is arguably skip-tier, but the command-line parser may grow in `research.md`. Default to lite when ambiguous. `Reviewed: lite (ts-reviewer)`.

**Risks:**
- R1 (ADR-015): skavenger.md growing past 600 lines. After this commit, plan owner runs `wc -l .claude/agents/skavenger.md`; if >600, HALT and trigger Q4 re-evaluation (extract F7 rubric or F10 diversity rules per ADR-015 Q4 contingency).
- R-threshold-bias: self-eval threshold set too permissive → runaway second passes; too strict → dead code. Mitigation: explicit calibration window + review date in ADR-015.

**Rollback:** `git revert`. Modes disappear; base flow (Commit 3) still works.

---

### Commit 5 — Group C: GitHub Route D + parallelization + diversity caps (FULL review)

**Complexity:** L. Only commit in the plan that adds `scripts/lib/` runtime code. New network surface (`gh api`). Tier: **FULL**.

**Files touched:**
- `scripts/lib/github-research.ts` (new)
- `tests/lib/github-research.test.ts` (new; RED first)
- `.claude/agents/skavenger.md` (add Route D classifier, add F9 parallelization block, add F10 diversity enforcement rules, add `Task` to `tools:` frontmatter)

**Library shape (`github-research.ts`):**

```ts
export interface GitHubIssueResult {
  ok: true;
  kind: "issues" | "prs" | "readme" | "changelog" | "discussions";
  repo: string;
  items: Array<{ title: string; url: string; body?: string; state?: string }>;
  rateLimit: { remaining: number; reset: string; authenticated: boolean };
}

export interface GitHubResearchErr {
  ok: false;
  kind: "error";
  error: string;
  hint?: string; // e.g. "authenticate with gh auth login for 5000 req/hr"
}

export type GitHubResearchResult = GitHubIssueResult | GitHubResearchErr;

export async function fetchGitHubRepoContent(opts: {
  repo: string; // "owner/name"
  kinds: Array<"issues" | "prs" | "readme" | "changelog" | "discussions">;
  limit?: number;
  timeoutMs?: number;
}): Promise<GitHubResearchResult[]>;

export function checkGhAvailable(): boolean;
export function checkGhAuthenticated(): boolean;
```

**Reuse (template: `youtube-transcript.ts`):**
- Same `ok: true | false` discriminated union
- Same `execFileSync` with argument array (no `shell: true`) — security hard rule
- Same stub-on-PATH test pattern (`tests/fixtures/stubs/gh-stub.sh`)
- Same CLI entry point guard via `import.meta.url === pathToFileURL(process.argv[1]).href` for ad-hoc `npx tsx` invocation

**Route D classifier (in `skavenger.md`):**
- Add a new route branch matching GitHub repo shortcuts: `/^(gh:|github\.com\/)([^\/\s]+\/[^\/\s]+)/i` or explicit `--route=github` flag.
- Skavenger invokes the helper via Bash: `npx tsx scripts/lib/github-research.ts <repo> <kinds>`.

**F9 parallelization:**
- Add `Task` to skavenger's `tools:` frontmatter list. `Task, Read, Grep, Glob, Bash, WebSearch, WebFetch`.
- Add instruction block: "For Route C with ≥3 sub-questions, spawn N sub-agents via the Task tool, each assigned one sub-question, each given the same caps; the main skavenger synthesizes the joined output." References `deep-research/SKILL.md:104-115` which already documents this pattern.

**F10 diversity enforcement:**
- Hard rules embedded in the Methodology section: max 2 sources from the same registered domain, min 1 official doc if one exists, min 1 academic source (`arxiv.org`, `*.edu`, journal DOI) if topic flagged "technical".
- Violations recorded as warnings in Methodology + downgrade self-eval rubric score.

**Test cases (RED → GREEN):**

1. `checkGhAvailable()` returns `true` with stub on PATH, `false` with stub stripped.
2. `checkGhAuthenticated()` parses `gh auth status` output correctly for authenticated and unauthenticated cases.
3. `fetchGitHubRepoContent({ repo: 'pgvector/pgvector', kinds: ['issues'] })` with stub returning canned JSON → returns parsed items with correct shape.
4. Rate-limit parsing: stub returns headers `X-RateLimit-Remaining: 42` → propagated to result.
5. Auth branches: authenticated → `remaining=5000-ish`, unauthenticated → `remaining=60-ish`, `hint` surfaces.
6. `kinds: ['readme']` → single fetch to `gh api repos/owner/name/readme`.
7. Error passthrough: stub exits 1 with stderr message → `{ ok: false, error: <stderr>, hint: ... }`.
8. No shell injection: `repo` argument with shell metacharacters passed as argv (not interpolated) — assert stub receives literal `$REPO` via `printenv` probe.
9. Timeout: `timeoutMs: 10` + stub that sleeps → returns error, does not hang.

**Acceptance:**
- All 9 tests green
- `Task` present in skavenger frontmatter tools list
- `rg "gh api" scripts/lib/github-research.ts | wc -l` ≥ 5 (issues, prs, readme, changelog, discussions)
- No `shell: true` anywhere in `github-research.ts`
- No eslint security warnings on `scripts/lib/github-research.ts`

**Gate:** build ✓, typecheck ✓, vitest +9 tests green, linter 16/16, spektr/security scan clean

**Tier:** **FULL**. Rationale (`development-workflow.md`): new file in `scripts/lib/` AND new network surface AND new shell surface (`execFileSync` on `gh`). Per tier table: "Production .ts/.js in scripts/lib/ … full parallel" + "Security-sensitive (exec, file paths) … full parallel (spektr MANDATORY)". `Reviewed: full`. Reviewers: ts-reviewer + spektr + orakle (N/A — no SQL in this commit but keep in the parallel set per tier rule) + kody consolidation.

**Risks:**
- R8 (ADR-015): `gh` rate limits. Mitigation: rate-limit surfacing in Methodology + F7 caps bound call count.
- R-cmd-injection: `gh api` argv must never interpolate. Mitigation: argv-array only, enforced by test case 8.
- R1 (ADR-015): skavenger.md growing again. After this commit, plan owner re-runs `wc -l .claude/agents/skavenger.md`. Projection after C4+C5: ~500-600 lines. If >600, extract F10 diversity rules into a skill section (Q4 contingency).

**Rollback:** `git revert` the full commit. `github-research.ts` disappears; Route D classifier in skavenger.md disappears; `Task` tool reverts to unused. No DB change.

---

### Commit 6 — Group D: `--history`, `--verify-citations`, `/forge` loop closure

**Complexity:** M. Ties together pieces from Commits 2/3/5.

**Files touched:**
- `.claude/commands/research.md` (add `--history <query>` and `--verify-citations <N>` handlers)
- `.claude/agents/skavenger.md` (document citation-verification behavior; no new routes)
- `tests/lib/pattern-engine.test.ts` or sibling (add R5 guard test: mixed observations file with `research_finding` entries must NOT affect existing ClusterReport output)

**Behavior:**

- `/research --history <query>` — calls `queryResearchReports({ query })` from Commit 2 (uses FTS5 if available, LIKE otherwise), prints a ranked list of matching reports with `report_number, topic, generated_at, confidence, path`. No new research performed.
- `/research --verify-citations <N>` — loads report N via `getResearchReport(N)`, extracts all `[text](url)` markdown links, re-fetches each via `WebFetch` (or HEAD-only equivalent), flags 404s and redirects. Produces a delta report: "3 of 12 citations broken". Does NOT modify the original report (append-only principle; the delta is its own output).
- **`/forge` loop closure:** the `research_finding` observations written in Commit 3 now need to NOT pollute the existing cluster pipeline (R5). `evaluate-patterns-shared.js` filter from Commit 3 handles this; Commit 6's test verifies the filter holds under a realistic mixed observation stream.

**Reuse:**
- `queryResearchReports()`, `getResearchReport()` from Commit 2
- Existing WebFetch tool for citation re-fetching

**Tests:**
- R5 guard test: build a synthetic `observations.jsonl` with 10 tool-call observations + 3 `research_finding` observations; run `evaluate-patterns-shared.js` logic; assert the ClusterReport output is identical to the same input with the 3 `research_finding` entries removed. This is the acceptance test for Q1/R5.
- `--history` smoke: insert 3 reports via `saveResearchReport`, run `queryResearchReports({ query: 'pgvector' })`, verify ranking order.

**Acceptance:**
- `--history` returns results from both FTS5 and LIKE branches (tested in Commit 2; Commit 6 verifies end-to-end)
- `--verify-citations` flags at least one broken link in a synthetic test fixture
- R5 guard test green
- `research_finding` observations visible in `observations.jsonl` after a `/research` run (verified in Commit 7 smoke test)

**Gate:** build ✓, typecheck ✓, vitest +2 tests green, linter 16/16

**Tier:** lite (ts-reviewer). Rationale: no new `scripts/lib/` files; orchestration via existing helpers; `evaluate-patterns-shared.js` touch is <10 lines of filter logic. `Reviewed: lite (ts-reviewer)`.

**Risks:**
- R-filter-fragility: if `evaluate-patterns-shared.js` filter regresses silently, `research_finding` observations could start contributing to clusters. Mitigation: R5 guard test is a tripwire.
- R-citation-load: `--verify-citations` on a 50-citation report = 50 HTTP requests. Mitigation: cap at 20 per invocation, surface "20 of 50 verified, rerun with --offset 20 for more".

**Rollback:** `git revert`. `--history` and `--verify-citations` flags disappear; `/forge` filter remains harmless (observations pipeline simply doesn't see new `research_finding` types anymore).

---

### Commit 7 — Docs sync + release note

**Complexity:** S. Pure documentation.

**Files touched:**
- `CLAUDE.md` (DB table count 6→7; skavenger row updated; `/research` flags; File Structure adds `docs/research/`; status line bumped)
- `README.md` (new `/research` examples with all flags; `KADMON_RESEARCH_AUTOWRITE` documented)
- `scripts/dashboard.ts` (add `research_reports: N` row to DB section)
- `.claude/rules/common/development-workflow.md` (`/research` command row in Research Phase table updated with flags)

**Reuse:**
- Follow `plan-013` Commit 3 style for CLAUDE.md edits (table bumps, status-line update)
- Dashboard row format: match existing rows like `hook_events: N`

**Tests:**
- `tests/lib/dashboard.test.ts` likely needs a +1 assertion for the new row; if the existing test uses a "all tables listed" pattern, adding `research_reports` to the expected set is sufficient.

**Acceptance:**
- `rg -i "never auto-write" .claude/agents/skavenger.md` → 0 hits (exit criterion confirmed one last time)
- `rg "research_reports" scripts/dashboard.ts` → ≥1 hit
- `CLAUDE.md` explicitly lists the 6 `/research` flags in the commands section
- README has a worked example for `/research --history`

**Gate:** build ✓, typecheck ✓, vitest +0 or +1 green, linter 16/16

**Tier:** skip. Rationale (`development-workflow.md`): docs-only + config-only (`dashboard.ts` row add is mechanical). Exception: `dashboard.ts` is `.ts` but the change is a single-row table extension with no new logic — lite-adjacent. Default to skip but run typecheck mechanically. `Reviewed: skip (verified mechanically)`.

**Risks:** minimal. Documentation drift.

**Rollback:** `git revert`. Docs revert; runtime unaffected.

---

## 6. Testing Strategy

**Unit (new):**
- `tests/lib/state-store-research-reports.test.ts` — 8 tests (Commit 2)
- `tests/lib/github-research.test.ts` — 9 tests (Commit 5)
- `tests/lib/pattern-engine.test.ts` or sibling — 1 new test for R5 guard (Commit 6)
- `tests/lib/dashboard.test.ts` — possibly +1 assertion (Commit 7)

**Unit (untouched):** 576 existing tests continue to pass unchanged.

**Integration:** the `/research` command exercises state-store + helpers end-to-end; covered by smoke test below.

**E2E smoke test (post-implementation, before closing plan):**

Run in a fresh session after Commit 7 lands. Each step has an observable post-condition.

```
1. /research pgvector HNSW vs IVFFlat 2026-Q2 updates
```
Expected:
- `docs/research/research-001-pgvector-hnsw-vs-ivfflat-2026-q2.md` exists with valid frontmatter (`number: 1, agent: skavenger, untrusted_sources: true, open_questions: [...]` non-empty)
- One row in `research_reports` with `report_number=1`
- Dashboard shows `research_reports: 1`
- `observations.jsonl` contains ≥1 entry with `type: "research_finding"`
- Report contains a "### Open Questions" section at the end
- Methodology footer reports self-eval score + source diversity stats

```
2. /research --drill 2
```
Expected:
- New file `docs/research/research-002-<slug>.md` exists
- Frontmatter contains `derived_from: research-001`
- `research_reports` has 2 rows
- The drilled sub-question matches index 2 of report-001's `open_questions[]`

```
3. /research --history pgvector
```
Expected:
- Console output lists both research-001 and research-002 (both contain "pgvector" in topic/summary)
- No new file written
- No new row in `research_reports`
- Latency < 200ms (FTS5 or LIKE path)

```
4. /research --verify "HNSW siempre supera IVFFlat en pgvector"
```
Expected:
- New file `docs/research/research-003-<slug>.md` with frontmatter `mode: verify`
- Methodology section contains explicit `pro: N, contra: M` line
- Report does not unanimous-declare a winner if pro and contra are both > 0

```
5. /research --plan "best practices for agent memory in 2026"
```
Expected:
- Console output shows proposed sub-questions + candidate source domains
- NO file written (`docs/research/research-004-*.md` does NOT exist after this command)
- NO new row in `research_reports`
- Zero WebSearch/WebFetch calls in the session log for the duration of this command

Optional extension:

```
6. /research --verify-citations 1
```
Expected:
- Console output shows citation-by-citation status for report-001
- No modification to research-001.md
- Methodology-style delta report listing broken links (if any)

## 7. Risks & Mitigations (plan-level)

Inherited from ADR-015 R1-R8; plan-specific additions below. R1-R8 are covered in the commit-level Risks sections above.

- **R-P1 — File-size overflow in skavenger.md.** Projection after Commits 3+4+5: ~500-600 lines. Mitigation: after Commit 4 and after Commit 5, plan owner runs `wc -l .claude/agents/skavenger.md`. If >600, HALT and extract F7 rubric or F10 diversity rules into a referenced skill section per ADR-015 Q4 contingency. Flag in plan status before proceeding.
- **R-P2 — Parallel session race on report numbering.** Two `/research` invocations in different sessions could pick the same `max+1`. Mitigation: `UNIQUE(report_number)` constraint surfaces the race; losing session re-scans and retries. Documented as known limitation acceptable for v1.
- **R-P3 — FTS5 test environment.** sql.js v1.14.1 FTS5 availability is not guaranteed in CI. Mitigation: Commit 2 tests force-branch via `vi.spyOn(hasFts5Support)` so both paths are exercised regardless of runtime capability.
- **R-P4 — Smoke test non-determinism.** WebSearch/WebFetch output varies by time. Mitigation: smoke tests assert STRUCTURE (file exists, frontmatter valid, table row present, observations written) not CONTENT (which sources were cited). Content-level correctness is a review judgment, not a machine gate.
- **R-P5 — /forge signal pollution (R5 from ADR-015).** `research_finding` observations could be mis-attributed to existing ClusterReport patterns. Mitigation: Commit 3 adds the filter; Commit 6 adds the guard test; both must land for the loop to close cleanly.
- **R-P6 — skavenger.md drift from agent-metadata-sync hook.** Adding `Task` to `tools:` in Commit 5 triggers `agent-metadata-sync.js`. Mitigation: plan owner verifies the hook's auto-sync to CLAUDE.md and `rules/common/agents.md` runs cleanly; if it collides with the Commit 7 manual edits, prefer the hook's output and manually reconcile.

## 8. Success Criteria

- [ ] All 7 commits landed on `feat/plan-015-skavenger-ultimate` branch in order
- [ ] Each commit passes its gate (build + typecheck + vitest + linter 16/16)
- [ ] `npx vitest run` reports 576 + 18 = 594+ tests passing (exact count depends on Commit 7 dashboard test touch)
- [ ] `rg -i "never auto-write" .claude/agents/skavenger.md` → 0 hits
- [ ] `wc -l .claude/agents/skavenger.md` ≤ 600 OR Q4 contingency executed with rationale in plan-015 status update
- [ ] E2E smoke test steps 1-5 pass with observable post-conditions
- [ ] Dashboard row `research_reports: N` visible in `npx tsx scripts/dashboard.ts` output
- [ ] 12/12 features shipped (cross-check against ADR-015 scope list)
- [ ] `git diff main...HEAD -- .claude/agents/skavenger.md` shows Task added to tools
- [ ] `git diff main...HEAD -- CLAUDE.md` shows DB table count 6 → 7
- [ ] PR body includes the smoke-test transcript
- [ ] ADR-015 status transitions to `shipped` in a follow-up commit (plan-owner action after merge)

## 9. Open Questions (carry-over from ADR-015)

These are not plan blockers; the plan proceeds with sensible defaults and documents the calibration plan.

- **F7 self-eval threshold value.** Default proposal: composite score 0.7 (scale 0-1). Calibrate after 2 weeks of real use. Recorded in skavenger.md as a `<!-- TODO(ADR-015 post-deploy) -->` comment.
- **Retention policy for `docs/research/`.** Proposed: live-forever (symmetry with ADRs/plans). Revisit if directory exceeds 100 files. Recorded in `docs/research/README.md`.
- **Route D authentication warning.** Should `/research --route=github` surface a yellow warning when `gh auth status` reports unauthenticated (60 req/hr)? **Recommendation:** yes, non-blocking warning in Methodology section; implement in Commit 5 as part of `fetchGitHubRepoContent` result's `hint` field. Already covered in Commit 5's test case 5.
- **FTS5 probe choice.** `SELECT fts5(?)` vs `CREATE VIRTUAL TABLE USING fts5` — konstruct implementer decides during Commit 2 based on what sql.js v1.14.1 accepts without throwing. Both are acceptable; cached identically.

## 10. Non-Goals (defensive — what plan-015 does NOT do)

Reaffirming ADR-015's non-goals to prevent scope creep during implementation:

- No Supabase RAG or pgvector archive (defer; v2 Karpathy-inspired idea).
- No Perplexity Sonar wiring (ADR-009 Fase 2 stays deferred).
- No rename of the `deep-research` skill.
- No modification of almanak, kody, or any agent other than skavenger.
- No auto-counter helper (user explicitly chose manual, matching ADR/plan convention).
- No content-embedding index for research archive.
- No research templates / taxonomy.
- No multi-language translation.
- No PDF chunking beyond current WebFetch pass-through.
- No new skill for "research" (reuse `deep-research`).
- **Plan-015 additional non-goal:** no refactor of existing `youtube-transcript.ts` — it serves as a template, not a subject of change.
- **Plan-015 additional non-goal:** no migration of existing session data into `research_reports` (the table is forward-only; pre-plan-015 sessions have no research artifacts to migrate).

## 11. Ready-to-Execute Checklist

### Pre-flight
- [ ] ADR-015 merged to main (done)
- [ ] plan-015 merged to main (this file, after user approval)
- [ ] Working tree clean; `git status` empty; `origin/main` aligned
- [ ] User greenlight on plan-015 scope

### Commits
- [ ] Commit 1 — Foundations: bootstrap + schema + types (tier skip, S-M)
- [ ] Commit 2 — State-store CRUD + FTS5 probe (tier lite, M-L, **TDD via feniks**)
- [ ] Commit 3 — Group A: Auto-doc + Open Questions + basic `--continue` (tier lite, M)
- [ ] Commit 4 — Group B: Depth modes (tier lite, M)
- [ ] Commit 5 — Group C: GitHub Route D + parallelization + diversity caps (tier **FULL**, L, **TDD via feniks**)
- [ ] Commit 6 — Group D: `--history`, `--verify-citations`, `/forge` loop closure (tier lite, M)
- [ ] Commit 7 — Docs sync + release note (tier skip, S)

### Exit criteria
- [ ] ADR-015 + plan-015 both merged
- [ ] 12/12 features shipped
- [ ] `rg -i "never auto-write" .claude/agents/skavenger.md` → 0 hits
- [ ] E2E smoke test (steps 1-5) passes with observable post-conditions
- [ ] Dashboard reflects skavenger as primary writer of `docs/research/`
- [ ] `wc -l .claude/agents/skavenger.md` ≤ 600 OR Q4 contingency documented
- [ ] PR created via `gh pr create` with smoke-test transcript in body
- [ ] ADR-015 status transitioned to `shipped` post-merge
