#!/usr/bin/env node
// CLI entry point invoked by install.sh / install.ps1 via `npx tsx`.
// Plan-010 Phase 4.3 (narrowed by plan-019 2026-04-20).
//
// Responsibilities (post-narrowing):
//   1. Merge harness CANONICAL_DENY_RULES into target's .claude/settings.json
//      (preserves unrelated keys via mergeSettingsJson from install-helpers).
//   2. Register the kadmon-harness plugin in the user's ~/.claude/settings.json
//      — write extraKnownMarketplaces[kadmon-harness] + enabledPlugins entries
//      so Claude Code auto-discovers the plugin (ADR-019 Ruta Y — symlinks at
//      plugin root handle component distribution; this handles registration).
//
// NEVER touches:
//   - settings.local.json (install.sh's responsibility — template-only, user-owned)
//   - .kadmon-version / .gitignore (install.sh writes those directly)
//   - agents/skills/commands (plugin distributes via symlinks per ADR-019)
//
// Args parsed manually then validated via Zod (project convention — external
// boundary gets Zod validation, internal pure helpers stay strongly typed).
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { mergeSettingsJson, safeAssign, } from "./install-helpers.js";
import { CANONICAL_DENY_RULES } from "./install-manifest.js";
// ─── Paths ────────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// install-apply.ts lives at scripts/lib/ — repo root is 2 levels up.
const REPO_ROOT = path.resolve(__dirname, "..", "..");
// ─── CLI args ─────────────────────────────────────────────────────────────────
const argSchema = z.object({
    target: z.string().min(1, "--target <path> is required and must be non-empty"),
    userSettings: z.string().optional(),
    forcePermissionsSync: z.boolean().default(false),
});
function parseArgs(argv) {
    let target = "";
    let userSettings;
    let forcePermissionsSync = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--target") {
            const next = argv[i + 1];
            if (next === undefined) {
                throw new Error("--target requires a path argument");
            }
            target = next;
            i++;
        }
        else if (arg === "--user-settings") {
            const next = argv[i + 1];
            if (next === undefined) {
                throw new Error("--user-settings requires a path argument");
            }
            userSettings = next;
            i++;
        }
        else if (arg === "--force-permissions-sync") {
            forcePermissionsSync = true;
        }
    }
    // Env var fallback for --user-settings (used by install-sh.test.ts via env)
    if (userSettings === undefined) {
        const envOverride = process.env["KADMON_USER_SETTINGS_PATH"];
        if (envOverride !== undefined && envOverride.length > 0) {
            userSettings = envOverride;
        }
    }
    return argSchema.parse({ target, userSettings, forcePermissionsSync });
}
// ─── File I/O helpers ─────────────────────────────────────────────────────────
function readJsonOrEmpty(filePath) {
    if (!fs.existsSync(filePath)) {
        return {};
    }
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (raw.length === 0) {
        return {};
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`install-apply: failed to parse JSON at ${filePath}: ${msg}`);
    }
    // Reject non-object JSON (arrays, null, scalars) — user settings must be an
    // object per Claude Code contract. Also strips prototype-pollution keys at
    // the external boundary (spektr 2026-04-20 HIGH finding).
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`install-apply: JSON at ${filePath} must be an object, got ${Array.isArray(parsed) ? "array" : typeof parsed}`);
    }
    return safeAssign(parsed);
}
function writeJson(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}
function applyProjectSettings(targetProject, forceSync) {
    const projectSettingsPath = path.join(targetProject, ".claude", "settings.json");
    const targetSettings = readJsonOrEmpty(projectSettingsPath);
    // Harness source: only permissions.deny matters for this merge. The merger
    // preserves every other target key untouched.
    const harnessSettings = {
        permissions: { deny: [...CANONICAL_DENY_RULES] },
    };
    const merged = mergeSettingsJson(harnessSettings, targetSettings, {
        forceDenySync: forceSync,
    });
    writeJson(projectSettingsPath, merged);
    const finalDeny = merged.permissions?.deny ?? [];
    const existingDeny = targetSettings.permissions?.deny ?? [];
    return {
        projectDenyCount: finalDeny.length,
        projectAdded: finalDeny.length - existingDeny.length,
    };
}
function applyUserSettings(userSettingsPath) {
    // readJsonOrEmpty sanitizes __proto__/constructor/prototype at the boundary.
    const existing = readJsonOrEmpty(userSettingsPath);
    // Spread into sanitized objects (defense-in-depth — inputs were already
    // sanitized at the boundary, but safeAssign on every spread preserves the
    // guarantee even if the input is stretched by a future refactor).
    const extraMarkets = safeAssign((existing.extraKnownMarketplaces ?? {}));
    const enabled = safeAssign((existing.enabledPlugins ?? {}));
    const marketplaceKey = "kadmon-harness";
    const pluginKey = "kadmon-harness@kadmon-harness";
    let marketplaceAdded = false;
    if (extraMarkets[marketplaceKey] === undefined) {
        extraMarkets[marketplaceKey] = { path: REPO_ROOT };
        marketplaceAdded = true;
    }
    let enabledAdded = false;
    if (enabled[pluginKey] !== true) {
        enabled[pluginKey] = true;
        enabledAdded = true;
    }
    const updated = {
        ...safeAssign(existing),
        extraKnownMarketplaces: extraMarkets,
        enabledPlugins: enabled,
    };
    writeJson(userSettingsPath, updated);
    return {
        userMarketplaceAdded: marketplaceAdded,
        userEnabledPluginAdded: enabledAdded,
        userSettingsPath,
    };
}
export function runInstallApply(argv) {
    const parsed = parseArgs(argv);
    const projectResult = applyProjectSettings(parsed.target, parsed.forcePermissionsSync);
    const userSettingsPath = parsed.userSettings ?? path.join(os.homedir(), ".claude", "settings.json");
    const userResult = applyUserSettings(userSettingsPath);
    return { ...projectResult, ...userResult };
}
function main() {
    try {
        // argv[0] = node, argv[1] = install-apply.ts — skip those.
        const args = process.argv.slice(2);
        const summary = runInstallApply(args);
        console.log(JSON.stringify(summary, null, 2));
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`install-apply: ${msg}`);
        process.exit(1);
    }
}
// Only invoke main when run directly (not when imported by tests).
const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === __filename) {
    main();
}
