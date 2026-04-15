---
number: 12
title: Skill frontmatter YAML syntax fix — migrate to list format for native preloading
date: 2026-04-14
status: proposed
route: A
plan: plan-012-skill-frontmatter-syntax-fix.md
supersedes: ADR-011-skill-loading-enforcement.md
---

# ADR-012: Skill frontmatter YAML syntax fix — migrate to list format for native preloading

> **Deciders**: Ych-Kadmon (architect), arkitect (agent).
> **Implementation Status**: Proposed 2026-04-14. Supersedes ADR-011 (proposed same day, not implemented). Konstruct follows with `plan-012-skill-frontmatter-syntax-fix.md`.

## Status

Proposed — 2026-04-14. **Supersedes ADR-011** in full. No code from ADR-011 shipped; the correction lands before any Phase 0 rollout begins.

## Context

This is the second iteration of a decision about skill loading into sub-agents. The first iteration (ADR-011, 2026-04-14) concluded that Claude Code's `Task` tool "does NOT parse the YAML `skills:` field" and proposed imperative Phase 0 blocks across 16 agent files plus a diagnostic audit hook. That diagnosis was wrong.

A `no_context`-disciplined research pass on the same day — direct WebFetch of the official Anthropic sub-agents documentation at `docs.claude.com/en/docs/claude-code/sub-agents`, cross-referenced via the `kerka` agent — revealed that the `skills:` field **is** a native, documented, actively-parsed frontmatter field. The full skill content is injected into the sub-agent's context at startup. The mechanism we thought was missing has existed in Claude Code for months.

The real bug is much smaller and entirely mechanical: every one of the 16 agent files uses comma-separated scalar syntax instead of a YAML list. YAML 1.2 parses `skills: a, b, c` as a single scalar string `"a, b, c"`, not a three-element list. Claude Code then looks up a skill named literally `"coding-standards, receiving-code-review, git-workflow, github-ops, regex-vs-llm-structured-text"`, fails to find it, and injects nothing — silently. The 46-skill catalog has been functioning as documentation instead of knowledge-in-context not because the loader doesn't exist, but because we never wrote the frontmatter in a shape the loader can parse.

This ADR exists to (a) record the corrected diagnosis, (b) reject ADR-011's infrastructure-heavy response, and (c) specify the minimal fix.

## Evidence

**Official Anthropic documentation** — `docs.claude.com/en/docs/claude-code/sub-agents`, "Supported frontmatter fields" table:

> `skills` | optional | Skills to load into the subagent's context at startup. **The full skill content is injected, not just made available for invocation. Subagents don't inherit skills from the parent conversation.**

**Official example syntax** from the same page:

```yaml
---
name: api-developer
description: Implement API endpoints following team conventions
skills:
  - api-conventions
  - error-handling-patterns
---
```

The documented syntax is YAML block-list (`- item` on each line). Flow-list (`[a, b]`) would also be valid YAML. Comma-separated scalars are not a list at all.

**Current Kadmon Harness syntax** — verified directly:

- `.claude/agents/kody.md:7` — `skills: coding-standards, receiving-code-review, git-workflow, github-ops, regex-vs-llm-structured-text`
- `.claude/agents/alchemik.md:7` — `skills: search-first, continuous-learning-v2, skill-stocktake, agent-eval, prompt-optimizer, skill-comply, workspace-surface-audit, cost-aware-llm-pipeline`

All 16 agent files in `.claude/agents/` use the same broken pattern. None use list syntax. A spot-check of `agent-metadata-sync.js` confirms the sync hook round-trips whatever scalar is on the line — it never validated that the value parses as a list, because it was built to mirror the catalog into `CLAUDE.md`, not to validate loader semantics.

## Decision

**Fix the YAML syntax in all 16 agent files to block-list format.** Delete the now-redundant "## Skill Reference" body sections (they were passive prose added under ADR-011's earlier assumption that the loader didn't exist). Update `rules/common/agents.md` to document the correct syntax and reference this ADR as the authoritative source.

Pilot on `kody` first. Verify via a real `/chekpoint lite` run that the sub-agent's `observations.jsonl` shows the declared skills actually injected (or equivalently, that `kody`'s review output reflects the `coding-standards` conventions without being told to read them). Roll out to the remaining 15 agents in a single mechanical PR once the pilot is clean.

### Rejected from ADR-011

- **Phase 0 imperative reads.** The official documentation explicitly says skills are injected at startup, not read on demand. Instructing sub-agents to read files that are already in their context is an antipattern — it wastes tokens and fights the native mechanism. Rejected.
- **`skill-load-audit.js` runtime hook.** There is nothing to audit at the `Task` tool boundary once the native loader is doing the work. Rejected as runtime enforcement.
- **Hard cap of 2 always-load skills per agent.** Context-budget discipline is still valuable, but it belongs to `skill-stocktake` and `/evolve`, not to a loader workaround. Rejected.
- **Template rewrites of 8 command files.** Out of scope. This ADR touches only agents. Commands are addressed separately if `skill-stocktake` surfaces bloat.

### Preserved from ADR-011 (reoriented)

- **The audit concept survives, reoriented as a frontmatter linter**, not a runtime hook. A small script that validates `.claude/agents/*.md` frontmatter (skills field parses as a YAML list, every listed skill exists in `.claude/skills/`, no typos) is worth keeping as a `/medik` check or pre-commit validator to prevent the same bug from drifting back in. It is an optional follow-up, not a blocker for the syntax fix itself.

## Consequences

**What changes.**

- All 16 files in `.claude/agents/*.md` get their `skills:` line rewritten from comma-separated scalar to YAML block list. Zero semantic changes to which skills are declared.
- The "## Skill Reference" body section is deleted from every agent file where it exists. Agents stop duplicating skill content as prose.
- `.claude/rules/common/agents.md` "Skill Loading" section is rewritten to document the native injection behavior, reference the official Anthropic docs, show the correct syntax, and link to this ADR.
- `agent-metadata-sync.js` continues to round-trip `skills:` into the `CLAUDE.md` catalog, but the catalog rendering needs a small update to join list items with commas for the pretty-printed `skills:` column. Existing tests at `tests/hooks/agent-metadata-sync.test.ts` will need their fixtures updated.

**Migration.** Fully mechanical. No schema changes. No `dist/` rebuild. One pilot PR (`kody` only) to verify the native loader works, then one rollout PR for the remaining 15 agents. Total estimated work: ~30 minutes of edits plus verification.

**Rollback.** Revert the two PRs. Behavior returns to today's silently-broken state. No data loss, no schema change, no hook-registration churn.

**Risks.**

| Risk | Mitigation |
|---|---|
| R1: Claude Code's YAML parser is lenient and silently tolerates the current scalar syntax (splits on commas). | Pilot on `kody` first; if the scalar already works, nothing breaks in the rewrite because block-list is a strict superset. |
| R2: A listed skill name is a typo or doesn't exist on disk. | Follow-up frontmatter linter catches this. In the meantime, the pilot verification step on `kody` surfaces any missing skill by log inspection. |
| R3: `agent-metadata-sync` tests break on the list-format fixtures. | Update fixtures and sync serializer in the same PR as the rewrite. |
| R4: `skill-stocktake` flags context bloat once the native loader is actually working for agents with 5–8 declared skills. | Exactly the outcome we want. Bloat discussions move to `/evolve` and skill consolidation, not to loader workarounds. |
| R5: The `/evolve` skill-loading pattern-definitions proposed in ADR-011 are no longer justified. | None were implemented — ADR-011 did not ship code — so there is nothing to roll back. |

**What this enables.** For the first time, the harness actually uses the native Anthropic mechanism it claims to use. The 46-skill catalog becomes functional knowledge-in-context. Sub-agent behavior should improve on the next invocation after the fix lands, without any further ceremony.

## Relationship to ADR-011

ADR-011 is superseded in full. Its Option 5 Hybrid (imperative Phase 0 + audit hook) rested on the incorrect premise that no runtime loader exists. Once the premise is corrected, every option in ADR-011 except the rejected "inline into agent files" becomes wrong for a different reason:

- Option 1 (imperative Phase 0) — unnecessary and wasteful, fights the native loader.
- Option 2 (nudge hook) — audits a boundary the native loader doesn't expose.
- Option 3 (inline content) — rejected by ADR-011 for correct reasons; still rejected here.
- Option 4 (command-level pre-read) — rejected by ADR-011; still rejected.
- Option 5 (hybrid) — fails because both halves fail.

The correct decision was the one neither iteration considered: **check the official docs before proposing infrastructure**.

### Lessons captured

- The first iteration violated the `no_context` principle. An audit of the codebase was treated as evidence about Claude Code's runtime, when it was only evidence about the harness's own files. We should have fetched `docs.claude.com` before writing Options, not after.
- `search-first` explicitly includes "search dependencies and docs" as step 2. Skipping that step because "the runtime is our own territory" was the same kind of shortcut `/forge` catches in observations — it should have been caught here too. This is a candidate feedback memory for `arkitect`.
- Plan-011 was never approved and no code shipped. The correction cost is zero lines of rolled-back code plus one superseded ADR. Cheap lesson. Next time the ceiling may be higher.

## Non-goals

- NOT implementing custom hooks for skill loading.
- NOT inlining skill content into agent files.
- NOT touching command files, rule body content, or skill files themselves.
- NOT validating skill *application quality* — only that the loader receives parseable frontmatter. Application quality is `agent-eval` (via `/evolve`) and `/chekpoint` territory.
- NOT changing the declared skill lists per agent. The sets stay identical; only the YAML shape changes.
- NOT registering the `SubagentStart` hook referenced in follow-ups. That hook is available in Claude Code's hook catalog and is worth documenting in `rules/common/hooks.md` for future use, but it is out of scope for this fix.

## Follow-ups

- **Frontmatter linter** — small script to validate that every `.claude/agents/*.md` file's `skills:` field parses as a YAML list and every listed skill exists in `.claude/skills/`. Register as a `/medik` check or pre-commit validator. Optional, sequenced after the core fix.
- **Document `SubagentStart` hook** in `.claude/rules/common/hooks.md` as an available mechanism for injecting `additionalContext` into sub-agents before spawn. Not a blocker; worth noting for future decisions that ADR-011 would have needed.
- **Claude Code v2.1.x features** — `effort:`, `model:` path lists, `if:` conditionals on hooks, and description expansion to 1536 chars shipped in late 2025 / early 2026. Non-urgent but worth surveying in a future `/evolve` pass.
- **`arkitect` memory entry**: "run search-first including external docs before proposing infrastructure, even when the affected territory looks internal." Capture as a feedback memory in `.claude/agent-memory/arkitect/`.

## Checklist Verification

- [x] **Requirements documented.** Fix YAML syntax in 16 agent files; delete passive "## Skill Reference" sections; update `rules/common/agents.md`; update `agent-metadata-sync` fixtures.
- [x] **Alternatives evaluated.** ADR-011's five options re-examined against the corrected evidence; all rejected with reasoning preserved above.
- [x] **Evidence anchored.** Official Anthropic docs quoted with source URL; two broken files cited with file:line references.
- [x] **Data model specified.** No schema changes. YAML shape change only.
- [x] **Component responsibilities defined.** Native Claude Code loader injects skills at sub-agent startup; `agent-metadata-sync` mirrors the frontmatter to the CLAUDE.md catalog; `skill-stocktake` owns context-budget discipline.
- [x] **Error handling strategy.** Rollback = revert two PRs. No runtime error surface introduced.
- [x] **Testing strategy.** Pilot on `kody` via `/chekpoint lite` real run; update `agent-metadata-sync` Vitest fixtures in the same PR; full Vitest suite expected green post-change.
- [x] **Migration path.** Additive. One pilot PR + one rollout PR. Backward compatible with existing frontmatter consumers.
- [x] **Windows compatibility.** No hook scripts touched, no path changes, no new runtime code. N/A by scope.
- [x] **Observability planned.** Success is measurable by inspecting sub-agent behavior post-fix (e.g., `kody` applying coding-standards conventions without being told). Formal telemetry deferred to the optional frontmatter linter.
- [x] **Rollback plan.** `git revert` on the two PRs. No stateful changes.

## Review date

**2026-05-14** — 30 days from acceptance. Success criteria: all 16 agents ship list-format frontmatter; `kody` pilot verified; no regressions in Vitest or `agent-metadata-sync`; optional frontmatter linter either shipped or explicitly deferred with reason recorded.
