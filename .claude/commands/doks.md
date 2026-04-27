---
description: Sync ALL project documentation with recent code changes — docs, rules, commands, skills
agent: doks
---

## Arguments
- `harness | consumer` — explicit profile override (highest precedence). Optional.
- `KADMON_DOKS_PROFILE=harness|consumer` — env var fallback (agent-level override).
- `KADMON_PROJECT_PROFILE=harness|web|cli` — umbrella env var (lower precedence).
- `KADMON_SKANNER_PROFILE=harness|web|cli` — back-compat env var (lowest of the env layers, ADR-031).
- Without args: profile detected from filesystem markers via `detectProjectProfile`.

Precedence (top wins): explicit arg → `KADMON_DOKS_PROFILE` → `KADMON_PROJECT_PROFILE` → `KADMON_SKANNER_PROFILE` → markers → fallback consumer (ADR-032).

## Purpose
Keep all 4 layers of documentation in sync with code after implementation changes. Not just counts — behavioral descriptions must match what the code actually does. Absorbs the former /update-docs with K-naming convention.

## Steps
1. Invoke **doks agent** (opus) — agent runs Step 0 profile detection + per-layer eligibility (ADR-032).
2. Scan recent git commits for behavioral AND structural changes.
2a. Per-layer eligibility computed (Layer 1 always writable; Layer 2 harness-only; Layers 3-4 cwd-only in consumer).
3. **Layer 1 — Public docs**: Update CLAUDE.md, README.md (always writable, project-root files).
4. **Layer 2 — Rules**: Update .claude/rules/common/hooks.md, agents.md, development-workflow.md if affected (SKIP with NOTE in consumer profile — rules are harness-shared; install.sh re-run resyncs).
5. **Layer 3 — Commands**: Update command .md files if their workflows changed (consumer profile: cwd-only enumeration; plugin-provided commands not listed).
6. **Layer 4 — Skills + Agents**: Check skills/agents that reference changed hooks/features (consumer profile: cwd-only enumeration; plugin-provided components not listed).
7. Self-verify: grep for feature keywords, check for stale references, validate counts (cwd-only in consumer profile — never traverse `~/.claude/plugins/cache/`).
8. Commit documentation updates separately from code.

## Output
List of docs updated across all layers + verification results + commit hash. Output begins with `Detected: <profile> (source: ...)` and a per-layer eligibility summary (ADR-032).
