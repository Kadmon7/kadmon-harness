---
number: 34
title: /chekpoint diff-scope-aware Phase 1 + Phase 2a routing
date: 2026-04-26
status: accepted
route: A
plan: plan-034-chekpoint-phase1-diff-scope.md
---

# ADR-034: /chekpoint diff-scope-aware Phase 1 + Phase 2a routing

**Deciders**: Ych-Kadmon (architect), arkitect (proposer)

## Context

`/chekpoint` is the harness's commit + verification + review gate, defined in `.claude/commands/chekpoint.md` (v1.3.0). The full tier executes Phase 1 (build + typecheck + test + lint) then Phase 2a (typescript-reviewer + spektr + orakle in parallel) then Phase 2b (kody consolidator) then Phase 3 (BLOCK gate) then Phase 4 (commit + push). Two inefficiencies recur on every commit:

1. **Phase 1 mechanical waste**. Build + typecheck + tests + lint always run regardless of diff content. For docs-only commits (`CLAUDE.md`, `.claude/rules/**/*.md`, ADRs, plan files) this burns ~90s of wall time on irrelevant work — none of those file paths affect the build, the type graph, the test suite, or the lint targets.
2. **Phase 2a reviewer waste**. The full tier ALWAYS invokes spektr + orakle in parallel with the language reviewer. Empirical evidence (plan-032 ship 2026-04-26 commit `8484ee2`) shows orakle returning "Verdict: APPROVE — zero database touch. No SQL, schema, migration, or Supabase/sql.js client code in the diff" — 100% noise. spektr ran on a non-security-surface diff and returned 0 CRITICAL, 0 HIGH, 2 MEDIUM defense-in-depth findings — marginal value. Cost-per-full-tier invocation is ~$3-5; on diffs without DB or security surface, ~$2 of that is unconditionally wasted.

The decision is to introduce a single content-based diff classifier and wire it into both phases, so each invocation runs only the gates the diff actually needs.

### Empirical evidence driving the design

Concrete data from plan-032 ship 2026-04-26 (representative single-language TS commit, no DB, no auth/exec/SQL):

| Reviewer | Output | Value |
|---|---|---|
| typescript-reviewer | 1 WARN (real, fixed), 3 NOTE (factual) | High — TS files were the diff substance |
| spektr | 0 CRITICAL, 0 HIGH, 2 MEDIUM (defense-in-depth, not blockers) | Marginal — no auth/exec/SQL/path surface |
| orakle | "APPROVE — zero database touch" | None — no SQL/schema/Supabase code in diff |
| kody (consolidator) | 1 WARN consolidation + Upstream BLOCK Preservation rule applied | High — final synthesizer always relevant |

Conclusion: 1 of 3 specialists was high-value, 1 was marginal, 1 was pure noise. The other two ran by mandate, not because the diff content needed them. Phase 1 likewise ran the full TS toolchain on a commit whose only material change could have been resolved with a `git diff` scan. The chosen design routes by content.

## Decision

Adopt a **single combined diff-scope helper** with two consumer sites in `/chekpoint`:

**Helper** — `getDiffScope(stagedFiles: string[], fileContents?: Record<string, string>): DiffScope` exported from `scripts/lib/detect-project-language.ts` (additive — no rename, sits beside `detectProjectLanguage`, `getToolchain`, `detectProjectProfile`).

**Return shape** (typed result, mirrors ADR-031's `detectSkannerProfile` pattern):

```typescript
interface DiffScope {
  // Phase 1 mechanical gates
  needsBuild: boolean;
  needsTypecheck: boolean;
  needsTests: boolean;
  needsLint: boolean;

  // Phase 2a reviewer-relevance gates
  needsTypescriptReviewer: boolean;
  needsPythonReviewer: boolean;
  needsOrakle: boolean;       // SQL / schema / migration / Supabase / sql.js
  needsSpektr: boolean;       // auth / keys / exec / file paths / SQL string building

  // Always-on: kody (consolidator), regardless of which specialists fired
  rationale: Record<string, string>; // gate name → human-readable reason
}
```

**Consumer site 1 — Phase 1** (`.claude/commands/chekpoint.md` lines 32-53). Before running the toolchain, call `getDiffScope()` and skip any mechanical step whose corresponding `needs*` flag is false. Default to TRUE on uncertainty (conservative-by-default invariant).

**Consumer site 2 — Phase 2a** (`.claude/commands/chekpoint.md` lines 55-85). Replace "Always invoke spektr + orakle in parallel" with conditional invocation gated on `needsSpektr` / `needsOrakle`. Language reviewer routing already content-aware via file extension. kody (Phase 2b) always runs as consolidator regardless of which specialists fired.

**Detection rules** (file-pattern primary, content-keyword secondary):

| Gate | File-pattern signal | Content-keyword signal |
|---|---|---|
| `needsBuild` | `*.ts`, `*.tsx`, `tsconfig.json`, `package.json` | — |
| `needsTypecheck` | `*.ts`, `*.tsx`, `*.py` | — |
| `needsTests` | any production source file under `src/`, `scripts/`, `.claude/hooks/scripts/` | — |
| `needsLint` | `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.py` | — |
| `needsTypescriptReviewer` | `*.ts`, `*.tsx`, `*.js`, `*.jsx` | — |
| `needsPythonReviewer` | `*.py` | — |
| `needsOrakle` | `*.sql`, `migrations/**`, `**/schema*.{ts,sql,py}`, `**/state-store.ts` | `supabase.from`, `sql\``, `FROM `, `JOIN `, `INSERT INTO`, `CREATE TABLE`, `pgvector` |
| `needsSpektr` | `**/auth/**`, `**/security/**`, `**/permissions*.{ts,json}`, `.claude/settings*.json` | `execSync`, `execFileSync`, `child_process`, `eval(`, `Function(`, `path.resolve`, `readFileSync`, secret-shaped strings |

**User overrides** (escape hatches, always available):
- `/chekpoint full --force-spektr` — invoke spektr regardless of detection
- `/chekpoint full --force-orakle` — invoke orakle regardless of detection
- `/chekpoint full --force-all` — restore current always-on behavior

**Authority**: `getDiffScope()` is the runtime authority. The "Tier Selection" table in `.claude/rules/common/development-workflow.md` becomes descriptive (matches behavior, but heuristics are the source of truth). Drift between table and helper resolves via this ADR amendment.

## Alternatives Considered

### Alternative 1: Status quo (full tier always runs everything)
- **Pros**: Paranoid coverage; zero implementation cost; no detection bugs possible
- **Cons**: 50%+ of Phase 2a invocations empirically noise (plan-032 evidence); Phase 1 mechanical waste universal on docs-only commits; ~$2 burned per non-DB-non-security commit
- **Why not**: Cost-per-commit unjustified for single-user productivity tool. Empirical evidence shows the noise rate is high enough that "always-on" is a worse default than "content-routed".

### Alternative 2: Two separate helpers + two ADRs (Phase 1 helper, Phase 2a helper)
- **Pros**: Smaller blast radius per ship; bisect-friendly; can land Phase 1 early and defer Phase 2a
- **Cons**: Helper logic is identical (file-pattern detection from staged diff); DRY violation; two ADRs + two plans + two PRs for one coherent concept; Phase 1 gates and Phase 2a gates derive from the same staged-files input
- **Why not**: Artificial split is worse than slightly bigger blast radius. The staged-files input is identical; the only thing that varies is which gate names the consumer reads.

### Alternative 3 (chosen): Single combined helper, Phase 1 + Phase 2a wiring
- **Pros**: DRY; ship together = consistent UX; single TDD test surface; single ADR; one mental model ("what does this diff need?"); rationale field is debuggable
- **Cons**: Bigger blast radius (2 phases of /chekpoint touched in one ship); slightly harder to bisect if regression appears
- **Why chosen**: The conceptual unit is "what does this diff actually need" — that question has one answer per commit, so it should be computed once and consumed twice. Mitigates blast radius via TDD coverage on the helper itself + override flags as immediate escape hatch.

### Alternative 4: AI-driven reviewer routing (LLM decides which reviewers to invoke)
- **Pros**: Could catch subtle cases (TS file imports SQL builder library indirectly)
- **Cons**: Latency + cost overhead exceeds savings; non-deterministic across runs; debugging "why did the LLM route this here" is harder than reading a pure-function output
- **Why not**: Deterministic file-pattern + keyword detection is sufficient for ~95% of cases. The remaining 5% are caught by the user override flags. Adding an LLM hop on every commit defeats the cost-saving motivation.

## Consequences

### Positive
- Docs-only commits skip Phase 1 mechanical work (~90s wall-time savings per commit)
- Non-DB / non-security commits skip orakle + spektr invocations (~$2 cost savings per commit, plus ~30-60s wall-time savings on Agent spawn + analysis)
- Single TDD test surface — every routing decision is a unit test on `getDiffScope()`, not an integration test on `/chekpoint`
- `rationale` field makes "why did this fire / not fire" trivially debuggable for the user
- Conservative-by-default — uncertain gates run, never skip
- User overrides (`--force-spektr`, `--force-orakle`) are first-class, not workarounds
- Reusable for plan-035+ (any future command that wants content-based gating shares the same helper)

### Negative
- Two consumer sites in `/chekpoint` change in one ship — bisecting a regression requires reading both phase wirings
- File-pattern + keyword heuristics will eventually miss a real edge case (e.g., `.ts` file that builds SQL via a fluent API where keywords are abstracted away). Mitigation: user override flags + content-keyword fallback layer
- `development-workflow.md` "Tier Selection" table becomes descriptive — drift risk with the helper if either is edited in isolation

### Risks
1. **R1: file-pattern detection misses a real concern** (e.g., `.ts` file imports an SQL builder library; orakle would have caught the resulting query but the diff has no direct SQL string). Mitigation: layered detection — file-pattern primary + content-keyword secondary (`supabase.from`, `sql\``, `FROM `, `JOIN `, `INSERT INTO`); user override (`--force-orakle`) as escape hatch.
2. **R2: Phase 2a conditional adds latency to /chekpoint full when ALL specialists are needed** (e.g., commit touches `.ts` + `.py` + SQL + auth). Mitigation: same parallel invocation as today — conditional only changes WHICH agents fire, not WHEN. Worst case latency identical to current behavior.
3. **R3: rule-spec drift between `development-workflow.md` "Tier Selection" table and `getDiffScope()` heuristics**. Mitigation: document `getDiffScope()` as the runtime authority; mark the table as descriptive; updates to either route through a single ADR amendment.
4. **R4: helper grows over time and becomes a maintenance hotspot**. Mitigation: pure function with full unit-test coverage; additive-only changes (new patterns appended, never reshuffled); new patterns require a small ADR amendment so the rationale is captured.
5. **R5: ts-reviewer and python-reviewer overlap kody's coverage on style/idiom checks**. Pre-existing concern, not introduced by this ADR. Noted as accepted complexity; orthogonal to diff-scope routing.

### Migration

- `getDiffScope()` is additive — no breaking changes to `detect-project-language.ts` exports
- `/chekpoint` markdown body updates Phase 1 + Phase 2a sections; commit format and footer (`Reviewed: full|lite|skip`) unchanged
- Initial roll-out: `--force-all` flag available as an emergency revert to current behavior without rolling back the ADR
- TDD coverage required on the helper before either consumer site is wired (feniks if `/abra-kdabra` Route A produces a TDD signal)

## References

- ADR-020 (runtime language detection) — sibling pattern; `detectProjectLanguage` lives in the same module as `getDiffScope`
- ADR-031 (project-agnostic /skanner stack) — precedent for typed-result detector pattern in `detect-project-language.ts`
- ADR-032 (doks project-agnostic) — most recent ADR; tone and structure template
- `.claude/commands/chekpoint.md` lines 32-53 (Phase 1) and lines 55-85 (Phase 2a) — consumer sites
- `.claude/rules/common/development-workflow.md` — "/chekpoint Tiers" section becomes descriptive
- `scripts/lib/detect-project-language.ts` — implementation site (additive export)
- Empirical reference: plan-032 ship 2026-04-26 commit `8484ee2` — orakle/spektr noise evidence
- `docs/plans/plan-034-chekpoint-phase1-diff-scope.md` — implementation plan (rewritten in same number to expand scope from Phase 1 only to Phase 1 + Phase 2a)

## Plan reference

Implementation plan: `docs/plans/plan-034-chekpoint-phase1-diff-scope.md`. The plan rewrite expands the original Phase 1 design with a second consumer site (Phase 2a wiring) — the helper itself, TDD coverage, and `rationale` debugging field stay as designed in the original plan.
