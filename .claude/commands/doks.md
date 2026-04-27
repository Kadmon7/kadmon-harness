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
Keep all 3 documentation layers in sync with code after implementation changes (Layer 1 public docs, Layer 2 commands, Layer 3 skills+agents). Not just counts — behavioral descriptions must match what the code actually does. Rules are out of scope (Amendment 2026-04-26 to ADR-032): they are hand-curated operational logic updated only via deliberate ADR. Absorbs the former /update-docs with K-naming convention.

## Steps
1. Invoke **doks agent** (opus) — agent runs Step 0 profile detection + per-layer eligibility (ADR-032 + Amendment 2026-04-26).
2. Scan recent git commits for behavioral AND structural changes.
2a. Per-layer eligibility computed (Layer 1 always writable; `.claude/rules/` NEVER edited; Layers 2-3 cwd-only in consumer).
3. **Layer 1 — Public docs**: Update CLAUDE.md, README.md (always writable, project-root files).
4. **Layer 2 — Commands**: Update command .md files if their workflows changed (consumer profile: cwd-only enumeration; plugin-provided commands not listed).
5. **Layer 3 — Skills + Agents**: Check skills/agents that reference changed hooks/features (consumer profile: cwd-only enumeration; plugin-provided components not listed).
6. **Rules surface check (read-only)**: If a hook/feature change affects a behavior described in `.claude/rules/`, surface as a NOTE in output. NEVER edit rule files (Amendment 2026-04-26 — rules are hand-curated via ADR; auto-edit causes silent drift per research-008).
7. Self-verify: grep for feature keywords, check for stale references, validate counts (cwd-only in consumer profile — never traverse `~/.claude/plugins/cache/`).
8. Commit documentation updates separately from code.

## Output
List of docs updated across Layers 1-3 + rules surface NOTEs (read-only) + verification results + commit hash. Output begins with `Detected: <profile> (source: ...)` and a per-layer eligibility summary (ADR-032 + Amendment 2026-04-26).
