---
number: 31
title: Project-agnostic /skanner stack via runtime profile detection
date: 2026-04-25
status: accepted
route: A
plan: plan-031-project-agnostic-skanner-stack.md
---

# ADR-031: Project-agnostic /skanner stack via runtime profile detection

**Deciders**: Ych-Kadmon (architect), arkitect (proposer)

## Context

Three components in the harness — `kartograf`, `arkonte`, and the `/skanner` command — were originally adopted from `affaan-m/everything-claude-code` (ECC) with the explicit intent of being reusable in any consumer project (Kadmon-Sports, ToratNetz, KAIRON). The upstream sources (`/tmp/everything-claude-code/agents/e2e-runner.md` for kartograf and `/tmp/everything-claude-code/agents/performance-optimizer.md` for arkonte) are project-agnostic by design — generic Playwright + Agent Browser for kartograf, generic Web Vitals + Big-O + React patterns for arkonte.

Drift detected during 2026-04-25 audit:

- `.claude/commands/skanner.md` Phase 1b (lines 30-37) hardcodes 5 harness-only scenarios: session lifecycle, instinct lifecycle, hook chain, no-context-guard enforcement, cost tracking.
- `.claude/agents/arkonte.md` line 13 claims expertise across "sql.js, and Supabase"; line 22 lists hook latency optimization as primary expertise; lines 127-135 contain a Hook Latency Budget table (observe<50ms / no-context-guard<100ms / others<500ms) tied to the harness hook taxonomy; line 40 references `npx tsx scripts/dashboard.ts`; lines 92-98 carry a sql.js subsection inside the primary Database Performance area.
- `.claude/agents/kartograf.md` is mostly project-agnostic at the agent level (Test Modes section already distinguishes Harness Mode / Web App Mode / Agent Browser Stagehand). The drift in kartograf's surface is downstream — `/skanner` is the entry point that hardcodes harness scenarios, so even a generic kartograf cannot escape the harness assumption when invoked through `/skanner`.

Net effect: dropping the harness into a Kadmon-Sports or ToratNetz workspace and running `/skanner` yields scenarios and budgets that don't exist in those projects. The components advertise project-agnosticism but cannot deliver it without manual edits per consumer.

A separate ECC agent (`code-reviewer.md`) was *not* adopted as kody. Kody is a different architectural role — the Phase 2b consolidator in `/chekpoint` (per `.claude/rules/common/agents.md` "Consolidator boundary" section), with hard-coded references to `typescript-reviewer`, `python-reviewer`, `spektr`, and `orakle` (the upstream Phase 2a specialists), plus pipeline contract references to `/abra-kdabra`. Refactoring kody to a project-agnostic shape would break `/chekpoint` orchestration. Kody is therefore explicitly out of scope for this ADR.

Existing infrastructure to reuse:

- `scripts/lib/detect-project-language.ts` (ADR-020) already implements a file-marker scan returning `typescript | python | mixed | unknown`. Extension is cheaper than a parallel detector.
- `KADMON_PROJECT_LANGUAGE` env var is the established override pattern. Mirror as `KADMON_SKANNER_PROFILE`.

## Decision

Adopt **runtime profile detection** for `kartograf`, `arkonte`, and `/skanner` with three profiles. The agent files remain single-source-of-truth; profile-specific sections branch at runtime based on detected markers.

**Profiles**:

1. **Harness profile** — markers: presence of `scripts/lib/state-store.ts` OR `hooks/observe-pre.ts` OR `data/observations.jsonl`. Activates harness-specific scenarios (session/instinct/hook lifecycle, no-context-guard, cost tracking) and the Hook Latency Budget table (observe<50ms / no-context-guard<100ms / others<500ms).
2. **Web app profile** — markers: `package.json` containing react/next/vite OR `pyproject.toml` declaring FastAPI/Django. Activates auth/CRUD/search/realtime scenarios and Web Vitals targets (LCP/FID/CLS).
3. **CLI/library profile** — markers: `package.json` with a `bin` field, no UI dependency markers. Activates generic scenarios (CLI invocation/exit code, config load, IO contract).

**Detection contract**: each agent emits `Detected: <profile>` as the first line of every run. Override via env var `KADMON_SKANNER_PROFILE=harness|web|cli` or explicit command argument `/skanner web|harness|cli`. Env var beats markers; argument beats env var. Detection itself is a function in extended `detect-project-language.ts` (or a sibling `detect-skanner-profile.ts` if cohesion suggests separation during plan-031 implementation).

**Kody exemption**: kody remains harness-coupled by design. Kody is the `/chekpoint` Phase 2b consolidator with explicit dependencies on `typescript-reviewer`, `python-reviewer`, `spektr`, `orakle`, and the `/abra-kdabra` ADR/plan pipeline contract. It is not a 1:1 equivalent of ECC's `code-reviewer.md` and refactoring it to project-agnostic would break consolidator behavior. Kody is excluded from this ADR's scope and the `/chekpoint` architecture is unchanged.

## Alternatives Considered

### Alternative 1: Install-time detection
- **Pros**: simplest agent files (no runtime branches); each consumer project gets a single tailored copy at install time.
- **Cons**: same agent file needs multiple variants in source; doesn't survive consumer project type changes (e.g. CLI → web migration); install logic balloons in `install.sh` / `install.ps1`; tests must cover install variants.
- **Why not**: complexity moves from agent files to install scripts without net reduction, and stale variants drift silently when consumer projects evolve.

### Alternative 2: Per-project agent overrides
- **Pros**: base agent stays clean; consumer projects override only what differs.
- **Cons**: 2x file surface (base + override per profile); plugin distribution model (ADR-010) doesn't have a clean override channel; defeats the single-source-of-truth goal that motivated this ADR; ADR-019 install loader would need new symlink semantics.
- **Why not**: doubles maintenance surface for a problem solved cleanly by runtime branching.

### Alternative 3: Fork ECC agents back into harness as "external" examples
- **Pros**: zero risk of harness drift contaminating reusable agents; clean separation between ECC reference and harness specialization.
- **Cons**: loses harness-native features (Memory section, skill chaining, frontmatter contract per `_TEMPLATE.md.example`, ADR-017 template addendum); breaks ADR-020 language routing; consumer projects lose access to the `/skanner` orchestration shell.
- **Why not**: throws away harness integration in exchange for theoretical purity; consumers want the harness apparatus, just not its hardcoded scenarios.

## Consequences

### Positive
- `kartograf` + `arkonte` + `/skanner` deployable to any consumer project via the existing plugin distribution (ADR-010) without per-consumer edits.
- Single agent file per component — no install-time variants, no override layers.
- Reuses ADR-020 detection infrastructure rather than building a parallel scanner.
- Kody exemption is explicit and documented, preventing future "why didn't we refactor kody too" cycles.
- ECC's original project-agnostic intent is honored without abandoning harness integration.

### Negative
- Conditional sections in agent files mean larger files. kartograf is currently ~220 lines, arkonte ~230. Estimated post-refactor: ~280 lines each — still under the 400-line soft cap (well below the 800-line hard cap).
- Test surface grows: a profile-detection contract test is required to guard against regression; per-profile snapshot tests of `/skanner` Phase 1b output add to the suite.
- `rules/common/agents.md` catalog rows for kartograf and arkonte need a profile-aware trigger column, and the "Skills" column may diversify per profile.
- `_TEMPLATE.md.example` may need a "Profile-aware sections" optional block documented for future agents that want to follow the same pattern.

### Risks
1. **Misdetection in monorepos**: a workspace containing both a consumer project and a harness clone (e.g. someone debugging the harness from inside Kadmon-Sports) could match harness markers spuriously. **Mitigation**: env var override (`KADMON_SKANNER_PROFILE`) and explicit command argument always win over marker scan. Document in the agent's Output Format that detection is overridable, and emit `Detected: <profile> (source: markers|env|arg)` so the user can audit.
2. **Harness self-test breakage**: the harness itself is the canonical harness profile consumer; any regression in harness-mode detection breaks `/skanner` against the harness. **Mitigation**: harness markers (`state-store.ts`, `observe-pre.ts`, `observations.jsonl`) remain the default-on path when present; CI runs `/skanner` against the harness as part of `/medik` Check #14 capability-alignment (ADR-029) gating.
3. **Plugin distribution regressions**: ADR-010 plugin mode and ADR-019 install loader symlinks must continue to work after refactor. The `KADMON_RUNTIME_ROOT` env var resolution in plugin mode needs to be respected by the new detection function (it must read markers from the consumer's `cwd`, not from the plugin cache directory). **Mitigation**: detection function takes an explicit `cwd` parameter (default `process.cwd()`); plan-031 implementation includes a verification step that runs `/skanner` from a Kadmon-Sports clone with the harness installed as a plugin.
4. **Profile conflict (mixed signals)**: a project could match multiple profiles (e.g. a Next.js app that also has `state-store.ts` as a debugging copy). **Mitigation**: precedence order — explicit arg > env var > harness markers > web markers > cli markers > unknown (fallback: web). Detection function returns the first match in order; tie-breaker rule documented in the detection function's JSDoc.
5. **Documentation drift**: the agents catalog (`.claude/rules/common/agents.md`) and `/medik` Check #14 capability-alignment audit must reflect the new profile-aware behavior or they will flag false positives. **Mitigation**: plan-031 includes catalog update and a `/medik` test fixture covering all three profiles.

## References

- **ADR-010** (plugin distribution model) — referenced, not superseded. Plugin install path and `KADMON_RUNTIME_ROOT` resolution must continue to work; profile detection is consumer-cwd-based, not plugin-cache-based.
- **ADR-019** (install loader symlinks) — referenced, not superseded. Canonical root symlinks for `agents/`, `skills/`, `commands/` remain unchanged.
- **ADR-020** (runtime language detection) — extended. New harness markers (`state-store.ts`, `observe-pre.ts`, `observations.jsonl`) added to the detection module; `KADMON_SKANNER_PROFILE` mirrors the established `KADMON_PROJECT_LANGUAGE` override pattern.
- **ADR-029** (capability-alignment audit) — Check #14 must continue to pass after refactor. The check verifies skill `requires_tools:` against owner agent `tools:`; profile-aware skill loading does not change tool requirements, but plan-031 includes a Check #14 dry-run as a verification step.
- **`.claude/rules/common/agents.md` "Consolidator boundary"** — kody exemption anchor. Documents kody's role as `/chekpoint` Phase 2b consolidator with hardcoded specialist references, justifying its exclusion from this ADR.

## Plan reference

Implementation plan: `plan-031-project-agnostic-skanner-stack.md`.
