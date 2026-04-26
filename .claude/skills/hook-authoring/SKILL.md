---
name: hook-authoring
description: Reference for authoring or debugging Kadmon Harness hook scripts (`.claude/hooks/scripts/*.js`). Covers Plugin-Mode Runtime Resolution (ADR-010 Phase 1) — how lifecycle hooks (session-start, session-end-all, pre-compact-save) resolve `dist/scripts/lib/*.js` via `KADMON_RUNTIME_ROOT` in plugin mode versus the 3-level walk in local-dev mode — and Windows compatibility deep detail (`${HOOK_CMD_PREFIX}`, plugin cache path, hooks.json generator). USE WHEN editing a lifecycle hook (session-start, session-end-all, pre-compact-save). USE WHEN debugging KADMON_RUNTIME_ROOT or dist/ resolution. USE WHEN editing `.claude-plugin/hooks.json`. USE WHEN troubleshooting Windows hook PATH or plugin-cache path issues. USE WHEN modifying `scripts/generate-plugin-hooks.ts` or `ensure-dist.js`. Make sure to load this skill whenever the user mentions hook plugin runtime, plugin mode resolution, lifecycle hook dist resolution, hook command prefix, or Windows hook PATH — even without saying "hook-authoring". Do NOT skip this skill if the task touches hook installation location, the plugin cache directory layout, or how hooks find compiled TypeScript at runtime.
requires_tools: []
---

# Hook Authoring Reference

Authoritative reference for the runtime resolution and platform-compatibility contract of Kadmon Harness hooks. Content here was previously inlined in `.claude/rules/common/hooks.md` and moved to on-demand loading 2026-04-26 to reduce auto-load footprint (see plan at `~/.claude/plans/se-puede-algo-entre-sunny-crayon.md`).

The full 22-hook catalog and 8 shared-modules table live in `.claude/hooks/CATALOG.md` (non-auto-loaded, read on-demand per ADR-035). The exit-code table, performance budgets, safety rules, and Windows compatibility short rules remain in `.claude/rules/common/hooks.md` (auto-loaded). This skill covers only the deep runtime/platform mechanics.

## Plugin-Mode Runtime Resolution (ADR-010 Phase 1)

- Lifecycle hooks (session-start, session-end-all, pre-compact-save) import from `dist/scripts/lib/*.js` at runtime.
- **Local-dev mode**: `ensure-dist.js#resolveRootDir()` walks 3 levels up from `import.meta.url` to find the repo root.
- **Plugin mode**: `.claude-plugin/hooks.json` sets `KADMON_RUNTIME_ROOT=${CLAUDE_PLUGIN_DATA}` via the generated command prefix, so `resolveRootDir()` points at the plugin cache (`~/.claude/plugins/cache/kadmon-harness/...`). Required — the plugin cache directory does NOT have a predictable depth, so the relative walk would fail.
- MUST leave `KADMON_RUNTIME_ROOT` unset in local dev — the 3-level walk works from repo layout.
- Changing the hook install location (moving `dist/` or the canonical root symlinks) requires updating `ensure-dist.js#resolveRootDir()` and the hooks.json generator in `scripts/generate-plugin-hooks.ts`.

## Windows Compatibility (deep detail)

- All 22 registered hooks run via `${HOOK_CMD_PREFIX}` in `.claude-plugin/hooks.json`, which injects the Node.js PATH and `KADMON_RUNTIME_ROOT` in plugin mode (ADR-010 Phase 1). In local-dev mode the repo-root prefix is resolved via `ensure-dist.js#resolveRootDir()`.

The two short rules that remain in `rules/common/hooks.md` (`KADMON_DISABLED_HOOKS` env var support, `parseStdin()` helper) are mid-task essentials and stay there.

## When to consult this skill

- Adding a new lifecycle hook (must resolve `dist/` correctly in both modes)
- Renaming or moving `dist/`, the canonical root symlinks, or changing the plugin cache layout
- Debugging "module not found" errors from a hook in plugin mode but not local-dev mode (or vice versa)
- Editing `scripts/generate-plugin-hooks.ts` (the hooks.json generator) — its output must keep the `${HOOK_CMD_PREFIX}` contract intact
- Troubleshooting hook execution on Windows where PATH or plugin cache path resolution fails

---

Source rule file: `.claude/rules/common/hooks.md` — sections moved here 2026-04-26 to reduce auto-load footprint. See plan at `~/.claude/plans/se-puede-algo-entre-sunny-crayon.md` for context.
