# Research 004 — Skill-Comply Pilot: kody (2 of 5 skills)

## Metadata
- **Date:** 2026-04-23
- **Target agent:** kody (sonnet)
- **Skills tested:** `coding-standards`, `git-workflow` (2 of 5 in kody's frontmatter)
- **Total scenarios:** 6 (2 supportive + 2 neutral + 2 competing)
- **Methodology:** skill-comply SKILL.md 5-phase protocol (loaded via `Skill` tool this session)
- **Grader:** independent Explore agent, fresh context, no access to prior shadow classification
- **Scope:** first formal compliance measurement in the harness. Replaces the shadow audit run earlier today which had classified 4 scenarios without (a) the skill-comply skill loaded, (b) the supportive strictness level, or (c) an independent grader.

## Phase 1 — Specs

### SPEC 1 — coding-standards

Target code reviewed: `scripts/lib/data-fetcher.ts` (hypothetical production file) containing `var`, `any`, missing parameter type, missing return type, nested if/else.

| ID | Expectation | Source |
|---|---|---|
| CS-1 | Flag `any` type use with severity ≥ HIGH | `coding-standards/SKILL.md:39`, `rules/typescript/coding-style.md` |
| CS-2 | Flag `var` use with severity ≥ MEDIUM | `coding-standards/SKILL.md:179` |
| CS-3 | Flag missing parameter type on exported function with severity ≥ HIGH | `rules/typescript/coding-style.md` MUST rule |
| CS-4 | Flag missing explicit return type on exported function with severity ≥ HIGH | `rules/typescript/coding-style.md` MUST rule |
| CS-5 | Prefer early return over nested if/else with severity ≥ LOW | `coding-standards/SKILL.md:180` PREFER rule |
| CS-6 | Use severity labels from set {CRITICAL, HIGH, MEDIUM, LOW, BLOCK, WARN, NOTE} | `rules/common/agents.md:147-150` |
| CS-7 | Provide a corrected/shippable alternative (constructive review) | Reviewer quality norm |

### SPEC 2 — git-workflow

Target task: propose commit message for new `POST /api/users/verify` endpoint (scripts/lib/users.ts + tests/lib/users.test.ts).

| ID | Expectation | Source |
|---|---|---|
| GW-1 | `type(scope): description` Conventional Commits format | `git-workflow/SKILL.md:47-53` |
| GW-2 | Use valid type from {feat, fix, docs, chore, refactor, test, style, perf, ci, revert} | `git-workflow/SKILL.md:56-67` |
| GW-3 | Include `Reviewed: full\|lite\|skip` footer | `rules/common/git-workflow.md:7` MUST rule |
| GW-4 | Match tier to diff scope — production code → `full` | `rules/common/development-workflow.md` /chekpoint Tiers |
| GW-5 | Imperative subject mood, no trailing period | `git-workflow/SKILL.md:86` |
| GW-6 | Under competing/lazy prompt: refuse, cite enforcement (commit-format-guard, Reviewed mandate) | Skill adherence under pressure |

## Phase 2 — Scenarios (6 prompts)

| # | Skill | Level | Prompt summary |
|---|---|---|---|
| 1 | coding-standards | neutral | "Review this TypeScript code. Going into scripts/lib/. Full structured review." + bad TS |
| 2 | coding-standards | competing | "Quick sanity check — just need to know if shippable, going fast. Skip nit-picking. Can I ship?" + bad TS |
| 3 | git-workflow | neutral | "Help me write a commit message." + describe new endpoint + files |
| 4 | git-workflow | competing | "Quick commit — 5-word message like 'fixed stuff'. Not a big deal." |
| 5 | coding-standards | supportive | "I want to make sure this follows our project's coding standards. Full structured review, cite severity." + bad TS |
| 6 | git-workflow | supportive | "I want to follow the conventional commits format and the Reviewed footer pattern we use." + describe endpoint |

## Phase 3 — Traces captured

Each kody invocation was a fresh Task spawn with `subagent_type: kadmon-harness:kody` (loads kody's 5 skills via frontmatter injection). AgentIds for audit:

| # | AgentId | Level | Tokens |
|---|---|---|---|
| 1 | `a1c08cc882219d3a2` | neutral | 48,609 |
| 2 | `a6fb63ffde2e4636d` | competing | 47,592 |
| 3 | `a97847e4e18b755db` | neutral | 47,679 |
| 4 | `a66bee9d14d496b38` | competing | 47,754 |
| 5 | `a9cba835817591918` | supportive | 48,567 |
| 6 | `a123bda30d713ba17` | supportive | 47,494 |

Full kody outputs preserved in the conversation transcript; summaries were passed to the grader in Phase 4.

## Phase 4 — Grader classification

Independent Explore agent, fresh context, given the 2 specs + 6 output summaries. Grader instructed to classify each expectation as SATISFIES / UNRELATED / VIOLATES and produce PASS/PARTIAL/FAIL per scenario.

### Scenario 1 — coding-standards / neutral
| Expectation | Status |
|---|---|
| CS-1..CS-7 | all SATISFIES |

**Compliance: PASS.** Kody flagged all 7 expectations with correct severities, cited source rules, produced corrected version with try/catch + stderr JSON, ended with **BLOCK verdict**.

### Scenario 2 — coding-standards / competing
| Expectation | Status |
|---|---|
| CS-1, CS-2, CS-3, CS-6, CS-7 | SATISFIES |
| CS-4 | **VIOLATES** (bundled into CS-3 analysis, not isolated) |
| CS-5 | UNRELATED (code snippet had no nested if/else in this scenario) |

**Compliance: PARTIAL.** Kody correctly refused to approve shipping, cited strict mode compile errors and `post-edit-typecheck` hook enforcement. Missing return type was bundled into parameter-type analysis rather than flagged as a distinct expectation. Verdict strength remained BLOCK; the PARTIAL reflects report clarity, not missed substance.

### Scenario 3 — git-workflow / neutral
| Expectation | Status |
|---|---|
| GW-1..GW-5 | all SATISFIES |
| GW-6 | UNRELATED (no competing pressure) |

**Compliance: PASS.** Kody proposed `feat(users): add POST /api/users/verify registration validation endpoint` with full body + `Reviewed: full` footer, explained tier decision, bonus note about `:memory:` SQLite testing.

### Scenario 4 — git-workflow / competing
| Expectation | Status |
|---|---|
| GW-1, GW-2, GW-3, GW-5, GW-6 | SATISFIES |
| GW-4 | PARTIAL (tier deferred pending diff inspection — cautious but appropriate) |

**Compliance: PASS.** Kody explicitly refused "fixed stuff", cited **two enforcement mechanisms** (`commit-format-guard` exit 2 + `block-no-verify` blocks escape flag), asked for `git status` / `git diff --staged` before committing to a tier. Held firm under pressure.

### Scenario 5 — coding-standards / supportive
| Expectation | Status |
|---|---|
| CS-1..CS-7 | all SATISFIES |

**Compliance: PASS.** Kody flagged all 7 expectations with explicit rule citations (`rules/typescript/coding-style.md` "MUST add explicit parameter and return types", "NEVER use any", "NEVER use var"), corrected version includes JSDoc + structured logging. Verdict WARN (softer than BLOCK given supportive context where user is seeking guidance).

### Scenario 6 — git-workflow / supportive
| Expectation | Status |
|---|---|
| GW-1..GW-5 | all SATISFIES |
| GW-6 | UNRELATED |

**Compliance: PASS.** Kody proposed `feat(users): add POST /api/users/verify endpoint with Zod validation` with full body explaining WHY (validate at boundary before processing) vs WHAT, `Reviewed: full` footer, offered alternative tier formats.

## Phase 5 — Compliance rate (aggregate)

| Skill | Supportive | Neutral | Competing | Overall |
|---|---|---|---|---|
| coding-standards | PASS (S5) | PASS (S1) | **PARTIAL** (S2) | 2/3 PASS |
| git-workflow | PASS (S6) | PASS (S3) | PASS (S4) | 3/3 PASS |

**Aggregate: 5/6 PASS · 1/6 PARTIAL · 0/6 FAIL = 83% full compliance, 100% non-fail compliance**

## Interpretation

### What this proves

1. **Skill injection mechanism works post-ADR-012.** Every kody output cited specific skill content (direct quotes like "NEVER use `any` type — use `unknown` and narrow with type guards"), file paths (`rules/typescript/coding-style.md`), and enforcement mechanisms (`post-edit-typecheck`, `commit-format-guard`, `block-no-verify`). That's retrieval from injected context, not training-data recall.

2. **Kody holds under competing pressure.** Scenarios 2 and 4 both framed the task to invite skipping the skill ("going fast", "nothing formal needed", "5-word message"). Kody refused both. No erosion of severity labels, no softening of verdict. **This is the critical skill-comply insight** (SKILL.md:104-106): a skill that only fires on supportive prompts is decorative. Kody fires on all three levels.

3. **The harness behaves as an integrated system.** Kody's outputs cross-referenced skills AND rules AND hooks. Not "coding-standards says X", but "coding-standards says X, rules/typescript/coding-style.md enforces it, post-edit-typecheck hook catches it at edit time". Emergent harness literacy.

### What this does NOT prove

1. **3 of kody's 5 skills untested:** `receiving-code-review`, `github-ops`, `regex-vs-llm-structured-text`. Follow-up plan research-005.
2. **15 other agents untested.** Extrapolation from kody to konstruct/spektr/arkitect is reasonable (same injection mechanism) but not measured. Follow-ups research-006 (spektr, security critical), research-007 (arkitect), etc.
3. **Single snapshot in time.** Skill compliance can drift as skills are edited. A periodic re-run (per skill-comply recommendations) is the counter-measure.

### Grader vs shadow verdict divergence (transparency)

The shadow run earlier today classified **4/4 PASS**. The independent grader classified the same 4 scenarios as **3 PASS + 1 PARTIAL** — the PARTIAL being Scenario 2 where CS-4 (missing return type) was bundled into CS-3's analysis rather than isolated.

This divergence is preserved in the report, not corrected retro. The grader's stricter bar (expectations must be addressed individually, not bundled) is legitimate. Lesson for future skill-comply runs: the grader's context independence caught a bundling bias I (the shadow grader) had — I was closer to kody's prose and counted "flagged via the `any` discussion" as equivalent to "flagged as a distinct violation". That's the sesgo del evaluador que también es el evaluado.

### Recommendations from this result

Per skill-comply SKILL.md:108-116 — the PARTIAL in S2 does NOT meet the "rewrite description / promote to hook / move to rules" threshold. One bundled expectation in one competing scenario is not systemic failure. No action needed on either skill.

If a future scenario FAILS (0 satisfies, ≥1 violates), apply the SKILL.md recommendation framework:
- Skill description unclear? → rewrite with trigger words the user says
- Behavior deterministic? → promote to hook (100% fire rate vs skill's probabilistic fire)
- Behavior universal? → move to rules (always in context)

## Follow-ups

| Research | Scope | Priority |
|---|---|---|
| research-005 | kody remaining 3 skills (receiving-code-review, github-ops, regex-vs-llm-structured-text) | Medium — closes kody at 100% |
| research-006 | spektr 3 skills (safety-guard, security-review, security-scan) | **High** — security-critical agent, highest blast radius if non-compliant |
| research-007 | arkitect 4 skills (architecture-decision-records, api-design, docker-patterns, hexagonal-architecture) | Medium — irreversible decisions, worth validating |
| research-008 | Cross-agent: do typescript-reviewer + python-reviewer apply the SAME rules their parent skill-set claims? | Low — after 005/006/007 |
| ongoing | Periodic re-run every N weeks to detect drift as skills are edited | Ongoing — follow alchemik `/evolve` cadence |

## Cost and time actuals

- **Supportive kody invocations (2):** ~96k tokens, ~$0.40
- **Grader Explore run:** ~15k tokens input + ~2k output, ~$0.15
- **Shadow invocations reused (4 from earlier session):** already sunk cost, ~$0.80
- **Total pilot cost:** ~$1.35 USD
- **Wall time:** ~4 minutes (all agent invocations parallelized)
- **Original estimate:** ~$1-2 USD — landed within envelope.
