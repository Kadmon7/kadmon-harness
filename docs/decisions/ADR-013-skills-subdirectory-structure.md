---
number: 13
title: Skills live at .claude/skills/<name>/SKILL.md (subdirectory structure)
date: 2026-04-14
status: proposed
route: A
plan: plan-013-skills-subdirectory-structure.md
supersedes_partial: ADR-012-skill-frontmatter-syntax-fix.md
---

# ADR-013: Skills live at `.claude/skills/<name>/SKILL.md` (subdirectory structure)

> **Deciders**: Ych-Kadmon (architect), arkitect (agent).
> **Implementation Status**: Proposed 2026-04-14. Partial supersede of ADR-012 (path resolution only). Konstruct follows with `plan-013-skills-subdirectory-structure.md`.

## Status

Proposed — 2026-04-14. **Partial supersede of ADR-012.**

ADR-012 made two separable claims:

1. Skill frontmatter must use YAML block-list syntax (not comma-separated scalars). **Still authoritative.** Plan-012 landed this fix across all 16 agent files in commits `ac45f15`, `5379ba5`, `db5429e`, `dea0a63`. Nothing in this ADR changes that.
2. Skill files live at `.claude/skills/<name>.md` (flat). **Wrong.** The native Claude Code loader resolves skills at `.claude/skills/<name>/SKILL.md`. This ADR corrects that single claim.

ADR-012 remains the canonical record for the YAML syntax enforcement. ADR-013 only replaces its path-resolution assumption. Both ADRs stay active; readers needing the "why block-list" rationale go to ADR-012, readers needing the "where skill files live" rationale come here.

## Context

Plan-012 diagnosed and fixed the YAML scalar bug in the 16 agent frontmatters. The fix was correct as far as it went — the `skills:` field is now parseable as a list in all 16 agents — but it was **cosmetic, not functional**. The sub-agent loader still receives zero skill content at startup, because ADR-012 silently assumed the loader reads `.claude/skills/<name>.md` and built a linter (commit `dea0a63`) that validates that same wrong path.

The real layout required by Claude Code's native sub-agent loader is a **per-skill subdirectory with a literal `SKILL.md` entrypoint**. Every one of the 46 skill files in `.claude/skills/` has been dead documentation throughout the entire harness history. Agents appeared to function because:

- Rules reach every session via `CLAUDE.md` parent context (not via the skill loader)
- Each agent's workflow lives in the body of its own `.md` file (not in any skill)
- Skills have never actually been injected at runtime — they have been aspirational reference docs

Plan-013 migrates all 46 files from flat (`<name>.md`) to subdirectory (`<name>/SKILL.md`) structure via `git mv`, fixes two hardcoded path references in executable docs, and corrects the linter built under ADR-012. The frontmatter content of all 46 files is already valid (`name` + `description` present) — the migration is purely structural. Zero content edits.

## Empirical Evidence

On 2026-04-14, during the pre-Sprint-D audit (plan-010), we ran a direct injection test. We spawned `kody` (a sub-agent that declares five skills in its frontmatter: `coding-standards, receiving-code-review, git-workflow, github-ops, regex-vs-llm-structured-text`) with this prompt, paraphrased:

> Without using any tools, quote verbatim the first 5 coding-standards rules from your injected context, or report if they are absent.

Kody's response was surgically precise. It distinguished three categories of context with evidence for each:

- **Rules files PRESENT** — kody confirmed it could see the common and typescript rule content, reaching its context via the parent session's `CLAUDE.md` injection.
- **Its own agent system prompt PRESENT** — kody confirmed it could see the kody agent body from `.claude/agents/kody.md`.
- **The 5 declared skill files NOT PRESENT** — kody explicitly reported that none of the five skills declared in its own `skills:` frontmatter field had arrived as readable file content in the session.

Kody closed with the line:

```
INJECTION_STATUS: BROKEN
```

This is the canonical proof. The loader is parsing the `skills:` list (ADR-012 fix worked), resolving each name to a path, checking whether that path exists, and finding nothing at `.claude/skills/coding-standards.md`-shaped locations — because the loader is looking at `.claude/skills/coding-standards/SKILL.md`, which does not exist in the current harness layout. The loader fails silently and injects zero bytes.

The same test run post-migration will be embedded in the plan-013 Commit 3 message and this ADR's Verification section as the success gate. If post-migration kody cannot quote coding-standards content and does not emit `INJECTION_STATUS: WORKING`, the migration is rolled back (see Risk R5 below).

## Upstream Evidence

Anthropic official documentation at `https://code.claude.com/docs/en/skills` is prescriptive and unambiguous.

**Structural rule:**

> Each skill is a directory with `SKILL.md` as the entrypoint.

**Scope table:**

| Location | Path |
|---|---|
| Personal | `~/.claude/skills/<skill-name>/SKILL.md` |
| **Project** | **`.claude/skills/<skill-name>/SKILL.md`** |
| Plugin | `<plugin>/skills/<skill-name>/SKILL.md` |

The filename is literally `SKILL.md` (uppercase), there is exactly one subdirectory per skill, and the frontmatter must contain at minimum `name` and `description` fields. All three conditions are non-negotiable upstream requirements.

**Plugin cache confirmation.** Independently, we inspected the installed official `skill-creator` plugin at:

```
~/.claude/plugins/cache/claude-plugins-official/skill-creator/unknown/skills/skill-creator/SKILL.md
```

The Anthropic-maintained plugin follows exactly the documented layout: one subdirectory per skill, literal `SKILL.md` uppercase filename, frontmatter with `name` + `description`. This is the ground truth against which any claim about skill resolution must be measured.

Because the decision is prescribed by the upstream vendor, this ADR does not present Options Considered. There are no alternatives to evaluate — the only choice is to conform to the documented structure or keep shipping dead documentation. The architectural decision is made by Anthropic; arkitect's job here is to formalize it.

## Decision

Migrate all 46 skill files from `.claude/skills/<name>.md` (flat) to `.claude/skills/<name>/SKILL.md` (subdirectory) using `git mv` to preserve rename history. Fix the two hardcoded path references in executable docs that will break under the new layout. Fix the linter path construction built in plan-012. Make no content changes to any skill file.

### Concrete changes (plan-013 scope)

1. **46 `git mv` operations** — one per skill. Git auto-creates the intermediate subdirectory. Run with `core.ignorecase=false` set locally for the session to mitigate Windows case-folding on `SKILL.md` (see R1).
2. **Two hardcoded path references fixed:**
   - `.claude/agents/kerka.md:75` — "Follow `.claude/skills/deep-research.md` Steps 2–6" → `deep-research/SKILL.md`
   - `.claude/commands/kompact.md:60` — "Reload after compact: … `.claude/skills/postgres-patterns.md`" → `postgres-patterns/SKILL.md`
3. **Linter path construction corrected:**
   - `scripts/lib/lint-agent-frontmatter.ts:109` — change `join(skillsDir, ${skill}.md)` to `join(skillsDir, skill, 'SKILL.md')`
   - `scripts/lib/lint-agent-frontmatter.ts:4` — update docstring comment to reflect new path contract
4. **Linter fixture helper updated:**
   - `tests/lib/lint-agent-frontmatter.test.ts` — `writeSkill()` helper rewrites to `mkdirSync` the subdirectory then `writeFileSync` the `SKILL.md` file. Expected final test count: 13/13 green after the fixture update.
5. **Rules doc updated:**
   - `.claude/rules/common/agents.md` "Skill Loading" section — path examples changed, link to `https://code.claude.com/docs/en/skills` and to this ADR added.
6. **Top-level CLAUDE.md** — grep for residual references to the flat path; update if found.

### Out of decision scope

The sequencing, risk matrix, verification protocol, and commit ordering are konstruct's job in plan-013. This ADR fixes the target state and the rationale; konstruct decides how to get there safely.

## Supersede Rationale

ADR-012 is partially superseded, not fully superseded, because its two claims are independent and only one was wrong.

**Claim preserved (still authoritative).** YAML `skills:` frontmatter must be a block list, not a comma-separated scalar. Plan-012 landed the fix across all 16 agent files. The agent-metadata-sync hook, the frontmatter serializer, the documentation in `rules/common/agents.md` about list syntax, and the linter's YAML-parsing logic all stand. Nothing in ADR-013 touches YAML syntax.

**Claim replaced (wrong).** Skill files live at `.claude/skills/<name>.md`. This assumption drove the linter's path construction (`join(skillsDir, ${skill}.md)`) and was never empirically tested against the native loader. ADR-013 replaces it with `.claude/skills/<name>/SKILL.md`.

**Why partial, not full.** A full supersede would force readers of the YAML syntax rule to follow a redirect chain and lose context. The YAML list syntax is a distinct, correct, and still-enforced decision that deserves its own canonical ADR. Fully superseding ADR-012 would also invite confusion about whether the plan-012 commits should be reverted — they should not. Plan-012's work is real progress and remains load-bearing.

**Why not amend ADR-012 in place.** The harness treats ADRs as append-only once shipped (feedback memory `feedback_no_half_done.md` and the doks workflow enforce this). ADR-012 is already committed (proposed status, but the document is in the tree). Editing it retroactively to add a path correction would rewrite history and break the audit trail that shows what we believed on the morning of 2026-04-14 versus what we discovered that afternoon.

**Relationship graph:**

```
ADR-011 (ADR-011-skill-loading-enforcement.md)
   |
   | superseded in full by ADR-012 (wrong premise: "no native loader exists")
   v
ADR-012 (ADR-012-skill-frontmatter-syntax-fix.md)
   |
   | YAML list syntax claim: STILL AUTHORITATIVE
   | Path resolution claim:  PARTIALLY SUPERSEDED by ADR-013
   v
ADR-013 (this document)
```

Future readers asking "why do skills use block-list syntax?" get ADR-012. Future readers asking "why do skills live in subdirectories?" get ADR-013. Readers asking both get both, and the relationship is explicit in each document's frontmatter and Status section.

## Consequences

### What changes

**Runtime behavior.** For the first time since the harness was built, sub-agents actually receive the skill content declared in their frontmatter. The 46-skill catalog transitions from aspirational documentation to functional knowledge-in-context. Concretely:

- kody's next invocation has `coding-standards`, `receiving-code-review`, `git-workflow`, `github-ops`, and `regex-vs-llm-structured-text` injected into its startup context.
- alchemik's next invocation has `search-first`, `continuous-learning-v2`, `skill-stocktake`, `agent-eval`, `prompt-optimizer`, `skill-comply`, `workspace-surface-audit`, and `cost-aware-llm-pipeline` injected.
- All 14 other agents likewise receive their declared skills.

**Developer experience.** The linter correctly validates the real path, so drift back to the flat layout is caught in CI / `/medik`. Future skill additions must follow the subdirectory convention by construction; the linter refuses to accept a flat file.

**Distribution.** Plan-010's bootstrap script (Sprint D) will distribute functional skills to new projects instead of dead files. This is load-bearing for the harness's "infrastructure, not product" identity — the thing we are distributing has to actually work.

**Documentation.** `.claude/rules/common/agents.md` Skill Loading section gains explicit link to the Anthropic docs, so the next person who touches skill resolution has a direct upstream source rather than having to reverse-engineer it.

**Repository shape.** `.claude/skills/` grows 46 subdirectories. `git log --follow` on any individual skill traces the rename back to its flat predecessor, preserving history.

### What breaks if not migrated

Sub-agents continue running with a degraded context that silently lacks the knowledge they were designed to have. There is no error message, no log line, no test failure — the loader fails silently and the agents continue behaving approximately correctly (because rules do reach them via CLAUDE.md, and their own system prompt is strong). The failure mode is invisible degradation: reviewers apply weaker conventions than they would with `coding-standards` in context, alchemik proposes evolutions without `search-first` discipline, doks syncs documentation without `docs-sync` patterns. The cost compounds over every sub-agent invocation and will never surface as a bug report because there is no broken surface to point at.

Not migrating also leaves plan-010's bootstrap distribution shipping known-broken infrastructure to new projects, which contradicts the harness's stated identity.

### What could go wrong (risk summary)

The full risk matrix lives in plan-013. Two items in particular belong in the ADR because they are architectural:

- **R1 — Git on Windows case-folds `SKILL.md` to `skill.md`.** Git's `core.ignorecase=true` (the Windows default) can normalize the uppercase filename on disk. The Anthropic loader requires literal uppercase `SKILL.md`. Plan-013 mitigates this by setting `core.ignorecase=false` locally before the migration and verifying post-mv with `git ls-files .claude/skills/` that the 46 committed paths contain literal `SKILL.md`. If any file is committed as lowercase, the migration is reversed and retried.

- **R5 — Post-migration empirical test fails.** The success gate for plan-013 is a post-migration kody spawn that returns `INJECTION_STATUS: WORKING` and quotes verbatim coding-standards content. If kody reports `BROKEN` after migration, something else is wrong (cache, Claude Code version, frontmatter edge case we did not anticipate), and the correct response is to roll back all three commits with `git revert` and investigate. **This test is the plan-013 go/no-go gate.**

### Rollback

All three plan-013 commits are mechanical and independently revertible. `git revert` returns the tree to its current state with:

- 46 skill files back at flat paths
- Two doc references back to flat paths
- Linter back to flat-path validation
- Fixture helper back to flat-path writes

No schema changes, no data migration, no state in SQLite to undo. Rollback cost is one PR.

## Non-goals

This ADR and plan-013 explicitly do **not** cover:

- **Commands migration.** Anthropic docs confirm `.claude/commands/*.md` remain flat and backward-compatible. Commands are resolved differently and do not require subdirectories. No change.
- **Skill pruning.** All 46 skills in the catalog are actively declared by at least one agent (44) or command (2: `strategic-compact` via `/kompact`, `verification-loop` via `/chekpoint`). The Plan agent's earlier "unreferenced" flags were false positives against the rules doc `Command-Level Skills` section. Zero prunes in plan-013.
- **Skill content edits.** All 46 files already have valid `name` + `description` frontmatter. Plan-013 touches structure only. Content quality reviews belong to `/evolve`, `skill-stocktake`, and `agent-eval`, not to this migration.
- **ADR-012 amendment.** ADRs are append-only once shipped. Plan-012 landed in commits `ac45f15`, `5379ba5`, `db5429e`, `dea0a63`. ADR-012 stays as-is; ADR-013 partially supersedes it from the outside.
- **Claude Code cache invalidation.** If the current Claude Code session caches sub-agent resolution, new session starts after the merge pick up the new layout. Plan-013 documents a one-time "restart Claude Code after merge" step in the Commit 3 message; no code change required.
- **SubagentStart hook usage.** ADR-012's follow-up mentions this hook for future `additionalContext` injection. Still out of scope here. The native `skills:` mechanism is now sufficient.
- **Commands-level skill documentation changes beyond the rules doc.** The `/kompact` and `/chekpoint` command files themselves don't need structural edits — only the `rules/common/agents.md` Skill Loading section and the two hardcoded references in kerka.md and kompact.md.

## Checklist Verification

- [x] **Requirements documented.** 46 skill files migrate flat → subdirectory. Two hardcoded references fixed. Linter path fixed. Fixture helper updated. Rules doc updated. Zero content edits. Zero prunes.
- [x] **Alternatives evaluated.** None, by design. Upstream vendor prescribes the structure; deviation is not a valid option. This is formalization of a pre-decided migration.
- [x] **Evidence anchored.** Official docs URL quoted verbatim with the "Each skill is a directory" sentence and scope table. Plugin cache path inspected and cited. Empirical kody spawn result quoted with `INJECTION_STATUS: BROKEN` as canonical proof.
- [x] **Data model specified.** No schema changes. File-system shape change only: `<name>.md` → `<name>/SKILL.md`. Frontmatter schema unchanged.
- [x] **Component responsibilities defined.** Native Claude Code sub-agent loader resolves skills at `.claude/skills/<name>/SKILL.md`. Linter at `scripts/lib/lint-agent-frontmatter.ts` validates the resolved path exists. Rules doc at `.claude/rules/common/agents.md` documents the contract for human maintainers. `agent-metadata-sync.js` continues to mirror `skills:` field contents into `CLAUDE.md` without caring about path structure.
- [x] **Error handling strategy.** Linter surfaces missing-path violations at lint time. Loader silently injects nothing at runtime if a path is missing — this is an upstream behavior we cannot change, which is exactly why the linter must catch drift pre-commit.
- [x] **Testing strategy.** Plan-013 verifies via: (1) full Vitest suite green post-Commit-2; (2) `npx tsx scripts/lint-agent-frontmatter.ts` reports 16/16 OK against new structure; (3) `git ls-files .claude/skills/` shows 46 paths with literal `SKILL.md` uppercase; (4) pre-migration kody spawn reproducing `INJECTION_STATUS: BROKEN`; (5) post-migration kody spawn producing `INJECTION_STATUS: WORKING` with verbatim coding-standards quote — this is the go/no-go gate.
- [x] **Migration path.** Three commits, back-to-back for Commits 1 and 2 (tests break between them and must not be pushed mid-flight), then Commit 3 with ADR + docs. Full mechanical migration, no data transform, no dist rebuild required beyond the normal linter TypeScript compile.
- [x] **Windows compatibility.** R1 (case-folding) addressed by `core.ignorecase=false` local session setting plus post-mv verification via `git ls-files`. No hook latency concerns. No new runtime code paths.
- [x] **Observability planned.** Success measurable via the post-migration kody spawn. Formal telemetry is the linter; ad-hoc telemetry is inspecting sub-agent output for skill-informed behavior.
- [x] **Rollback plan.** `git revert` on the three plan-013 commits. No stateful changes to undo.

## Review date

**2026-07-14** — three months from proposal. Success criteria: all 46 skills committed at `.claude/skills/<name>/SKILL.md`; post-migration kody spawn reports `INJECTION_STATUS: WORKING`; linter validates the new path contract; no regressions in `agent-metadata-sync` tests; plan-010 bootstrap distributes functional skills to any new project onboarded in the review window.

At review time, the arkitect memory entry about "check upstream docs before proposing infrastructure" (established in ADR-012 and reinforced here) should be re-evaluated: did it prevent any additional drift in the intervening three months, or is a stricter guard needed?
