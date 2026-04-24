# ADR-026 — Graphify adoption as external knowledge-graph layer

- Status: accepted
- Date: 2026-04-23
- Deciders: Ych-Kadmon
- Supersedes: v1.3 roadmap item 7 "spec pendiente" clause (`docs/roadmap/v1.3-medik-expansion.md`)

## Context

The harness reached ~800 files (46 skills + 16 agents + 11 commands + 19 rules + 50+ docs/ADRs/plans + tests + scripts + hooks). Claude's typical navigation pattern burns tokens on filesystem enumeration (`Grep`, `Glob`) before any real answer surfaces. Upstream [`graphify`](https://github.com/safishamsi/graphify) (MIT, Python 3.10+, 33,750 stars, PyPI `graphifyy`) offers an external knowledge-graph layer that extracts structure once, persists `graph.json`, and — via `graphify claude install` — registers a PreToolUse hook telling Claude to consult the graph before blanket filesystem searches. Creator claim: 71.5× fewer tokens per query vs reading raw files.

User introduced graphify into the v1.3 roadmap on 2026-04-23 as item 7. The initial roadmap entry deferred the decision to a spec-driven evaluation. This ADR closes that decision gate.

## Decision

**Adopt graphify as an external dependency, not as harness-internal code.** Harness-side scope is strictly limited to:

1. `.graphifyignore` at repo root (exclude harness instruction files from extraction)
2. `.gitignore` entries for `graphify-out/cache/`, `graphify-out/manifest.json`, `graphify-out/cost.json`
3. README "Using graphify" subsection documenting install + commit workflow
4. This ADR
5. CHANGELOG entry

All runtime behavior lives in the upstream tool. `graphify claude install` — run by each collaborator on their own machine — writes a project-scoped `CLAUDE.md` section and a `.claude/settings.json` PreToolUse hook that fire before every `Glob` / `Grep` call.

## Alternatives considered

1. **Build an internal Kadmon graph** (decision-gate bucket 1) — rejected. Zero parity with upstream; ongoing maintenance burden; harness lacks Python ecosystem and Leiden clustering expertise. See `docs/research/research-007-graphify-spec-from-youtube.md` for the full comparison.

2. **Split graphify to v1.4** — rejected by user (2026-04-23). User wants v1.3 to ship complete so the harness can enter a maintenance pause and serve real project work. Since harness-side scope is config+docs only, there is no narrative contamination of the `/medik` expansion theme.

3. **Defer until community consensus settles** — rejected. 33,750 GitHub stars + MIT license + native Claude Code integration (PreToolUse hook, not just docs) is sufficient signal to dogfood now. The Sprint E measurement gate protects against vendor risk — if real token reduction is < 3×, we rip it out in one commit.

4. **Vendor graphify's source into the harness** — rejected. MIT allows it, but vendoring breaks the `graphify hook install` post-commit rebuild (depends on upstream binary being on PATH) and forks us off upstream security updates. Zero upside.

## Consequences

**Positive:**
- Zero harness TS code added. Single-commit rollback if the Sprint E benchmark fails.
- Upstream covers Windows, macOS, Linux — cross-platform support without harness work.
- Commit `graphify-out/` to git: every collaborator gets the same map on clone; drift is auditable via `git diff graphify-out/graph.json`.
- `graphify claude install` installs the PreToolUse hook at the project scope — does not pollute the user-global `~/.claude/settings.json`.

**Negative:**
- Python 3.10+ dependency added to collaborator setup (NOT covered by `install.sh` / `install.ps1` — manual `uv` / `pipx` / `pip` install per collaborator).
- First build is LLM-expensive. Graphify uses Claude subagents in parallel to extract concepts from every non-code file (ADRs, plans, roadmap, research, docs, READMEs). Budget approx $5–$30 on Anthropic billing for the initial build against this repo.
- Graph drift is a real risk. `graphify hook install` covers code-only changes (AST pass, no LLM calls). Doc/ADR/plan edits still require manual `graphify --update` — a stale graph can tell Claude wrong things.
- Creator-reported 71.5× token reduction is a single-source claim. Real-world gain on this harness is unknown until Sprint E measurement.

**Mitigation:**
- **Sprint E measurement gate.** Benchmark 5 typical queries pre/post graphify. Remove adoption if real token reduction < 3×. The roadmap item 7 checkbox stays unchecked until this gate passes.
- `.graphifyignore` excludes CLAUDE.md, AGENTS.md, `.claude/agents/`, `.claude/skills/`, `.claude/commands/`, `.claude/rules/`, and `.claude/settings.json` from extraction. These files are instruction-to-Claude text; extracting them as "knowledge" would pollute clusters with meta-instruction content that Claude already reads every session.
- Commit `graphify-out/` to git so drift is visible as a diff, not invisible local state.
- Document manual `graphify --update` in the README subsection so collaborators know to refresh after doc-heavy commits.

## Rollback

Single-commit reversible:

1. Each collaborator runs `graphify claude uninstall` locally (removes the CLAUDE.md section + `.claude/settings.json` hook written by graphify; our harness code is untouched).
2. `rm -rf graphify-out/` in each clone.
3. Revert the commit that adds `.graphifyignore` + `.gitignore` entries + README subsection + this ADR + roadmap item 7 update + CHANGELOG entry.

No harness code to unpick. No schema migrations. No deprecated commands. The design point of "external integration, zero TS" IS the rollback story.

## Related decisions

- [ADR-010](ADR-010-harness-distribution-hybrid.md) — hybrid distribution (plugin + install.sh). Graphify sits OUTSIDE this envelope (user-installed Python tool, not bundled).
- [ADR-020](ADR-020-runtime-language-detection.md) — language detection. Graphify is runtime-agnostic: the `graphify-out/graph.json` is consumed by Claude regardless of whether the target project is TS or Python.
- [ADR-025](ADR-025-versioning-policy.md) — versioning policy. Graphify adoption ships with v1.3 because its harness-side scope is config+docs (narrative-neutral), not because it belongs to the `/medik` expansion theme.

## Follow-ups (Sprint E)

- [x] 5-query token benchmark pre/post graphify on this repo — **PASSED 2026-04-24**. Expanded to 10 queries for robustness. Method C (total session cost, GRAPH_REPORT amortized once + wiki notes per query): **8.11× avg**. Method B (per-query, GRAPH_REPORT amortized): **20.07× avg**. Method A literal (GRAPH_REPORT counted per query) gave 1.77× but formula has obvious flaw — GRAPH_REPORT.md is navigation index loaded once per session, not per query. Below creator's 71.5× claim but well above 3.0× threshold. Full table at `docs/roadmap/v1.3-medik-expansion.md` item 7. Adoption confirmed.
- [ ] Promote adoption to first-class `/medik graphify` subcommand (Check #14) if benchmark passes and team commit-cadence for `graphify-out/` is consistent — deferred to v1.4
- [ ] Nexus badge for graph freshness (age of `graphify-out/graph.json` vs `HEAD` commit date) — deferred to v1.4
