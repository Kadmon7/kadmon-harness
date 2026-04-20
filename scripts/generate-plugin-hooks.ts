#!/usr/bin/env node
// Build-time helper: read .claude/settings.json hook entries and emit
// .claude-plugin/hooks.json (plan-010 Phase 2 Step 2.3).
//
// Idempotent — running twice produces byte-identical output. Designed to be
// invoked from package.json or pre-commit when settings.json changes; not from
// install.sh (install scripts only rewrite the ${HOOK_CMD_PREFIX} placeholder).
//
// Output shape per ADR-010 §"Plugin manifest structure":
//   { "hooks": { "<EventType>": [ { matcher?, hooks: [ {type, command, env} ] } ] } }
//
// All commands are rewritten to use:
//   ${HOOK_CMD_PREFIX} ${CLAUDE_PLUGIN_ROOT}/.claude/hooks/scripts/<script>.js
// with env: { KADMON_RUNTIME_ROOT: "${CLAUDE_PLUGIN_DATA}" } so lifecycle
// hooks find dist/ via the env-var primitive (Phase 1).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const SETTINGS_PATH = path.join(REPO_ROOT, ".claude", "settings.json");
const OUTPUT_PATH = path.join(REPO_ROOT, ".claude-plugin", "hooks.json");

const KADMON_ENV = { KADMON_RUNTIME_ROOT: "${CLAUDE_PLUGIN_DATA}" };

// Settings.json hook entry as it appears in source.
interface SourceHookCommand {
  type: string;
  command: string;
  [key: string]: unknown;
}

interface SourceMatcherGroup {
  matcher?: string;
  hooks: SourceHookCommand[];
}

interface SourceSettings {
  hooks?: Record<string, SourceMatcherGroup[]>;
  [key: string]: unknown;
}

// Plugin hooks.json output entry — flat per ADR-010 example. Each entry
// carries its own `matcher` field so PreToolUse/PostToolUse hooks scoped to
// specific tool types (Bash, Edit|Write, mcp__) preserve that scope after the
// flatten.
interface PluginHookEntry {
  name: string;
  matcher?: string;
  command: string;
  env: Record<string, string>;
}

interface PluginHooksManifest {
  hooks: Record<string, PluginHookEntry[]>;
}

/**
 * Extract the hook script filename from a settings.json command string.
 * Source commands look like:
 *   cd "$(git rev-parse --show-toplevel)" && PATH="$PATH:/c/Program Files/nodejs" node .claude/hooks/scripts/SCRIPT.js
 */
function extractScriptName(command: string): string | null {
  const match = command.match(/\.claude\/hooks\/scripts\/([\w-]+\.js)/);
  // match[1] is non-null when match is non-null — the regex contains exactly
  // one capture group, so RegExpMatchArray[1] is guaranteed defined here.
  return match ? match[1]! : null;
}

/**
 * Rewrite a source command into the plugin form with placeholders for
 * install.sh / install.ps1 to substitute at install time.
 */
function rewriteCommand(source: string): string | null {
  const scriptName = extractScriptName(source);
  if (!scriptName) return null;
  return `\${HOOK_CMD_PREFIX} \${CLAUDE_PLUGIN_ROOT}/.claude/hooks/scripts/${scriptName}`;
}

function buildPluginManifest(source: SourceSettings): PluginHooksManifest {
  const result: PluginHooksManifest = { hooks: {} };

  if (!source.hooks) return result;

  for (const [eventType, matcherGroups] of Object.entries(source.hooks)) {
    const entries: PluginHookEntry[] = [];

    for (const group of matcherGroups) {
      for (const hook of group.hooks) {
        if (hook.type !== "command") continue;
        const scriptName = extractScriptName(hook.command);
        if (!scriptName) continue;
        const newCommand = rewriteCommand(hook.command);
        if (!newCommand) continue;

        // Strip the .js extension to derive the canonical hook name. Mirrors
        // the rules/common/hooks.md catalog ("session-start", "observe-pre",
        // "block-no-verify", etc.) so the plugin manifest stays consistent
        // with the human-facing docs.
        const name = scriptName.replace(/\.js$/, "");

        const entry: PluginHookEntry = {
          name,
          command: newCommand,
          env: { ...KADMON_ENV },
        };
        if (group.matcher !== undefined && group.matcher !== "") {
          entry.matcher = group.matcher;
        }
        entries.push(entry);
      }
    }

    if (entries.length > 0) {
      result.hooks[eventType] = entries;
    }
  }

  return result;
}

function main(): void {
  if (!fs.existsSync(SETTINGS_PATH)) {
    throw new Error(`Settings not found: ${SETTINGS_PATH}`);
  }

  const raw = fs.readFileSync(SETTINGS_PATH, "utf8");
  let source: SourceSettings;
  try {
    source = JSON.parse(raw) as SourceSettings;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `generate-plugin-hooks: settings.json contains invalid JSON (${msg}). ` +
        `Path: ${SETTINGS_PATH}`,
    );
  }

  const manifest = buildPluginManifest(source);

  // Pretty-print with stable 2-space indent so diffs stay readable.
  const json = JSON.stringify(manifest, null, 2) + "\n";

  // Ensure target dir exists.
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, json);

  // Emit summary to stdout for build/CI logs.
  let totalHooks = 0;
  for (const entries of Object.values(manifest.hooks)) {
    totalHooks += entries.length;
  }
  console.log(
    `generate-plugin-hooks: wrote ${path.relative(REPO_ROOT, OUTPUT_PATH)} ` +
      `(${Object.keys(manifest.hooks).length} event types, ${totalHooks} hooks)`,
  );
}

main();
