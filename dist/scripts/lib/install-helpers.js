// Pure helpers for the install.sh / install.ps1 bootstrap (plan-010 Phase 3).
// All exports are pure functions: deterministic, no I/O side effects, no input
// mutation. Shell scripts delegate to install-apply.ts (Phase 4) which calls
// these primitives via npx tsx — this keeps merge logic in TypeScript so it is
// testable, type-checked, and identical across bash / PowerShell entry points.
import path from "node:path";
// ─── Prototype-pollution defense (plan-010 Phase 4 spektr review 2026-04-20) ─
/**
 * Keys that must never survive JSON.parse → spread round-trips. A malicious
 * settings.json with `"__proto__": {...}` would otherwise persist on disk and
 * could pollute downstream consumers that use unsafe deep-merge. Filter at
 * boundary + as defense-in-depth inside mergeSettingsJson.
 */
const FORBIDDEN_KEYS = [
    "__proto__",
    "constructor",
    "prototype",
];
/**
 * Copy own enumerable keys from `src` into a fresh object, filtering any key
 * in FORBIDDEN_KEYS. Preserves ordinary prototype (not null-proto) so the
 * result works seamlessly with JSON.stringify and ordinary JS consumers.
 */
export function safeAssign(src) {
    const out = {};
    for (const [k, v] of Object.entries(src)) {
        if (!FORBIDDEN_KEYS.includes(k)) {
            out[k] = v;
        }
    }
    return out;
}
/**
 * Detect the current OS platform, narrowed to the 3 platforms Kadmon supports.
 * Throws on unknown platforms (e.g. freebsd, sunos, aix) — callers must handle
 * the failure explicitly rather than silently degrading to an unsupported path.
 */
export function detectPlatform() {
    const p = process.platform;
    if (p === "win32" || p === "darwin" || p === "linux") {
        return p;
    }
    throw new Error(`Unsupported platform: ${p}. Kadmon supports win32, darwin, linux.`);
}
/**
 * Core merge logic: union of harness + target with harness-first ordering and
 * exact-string dedup. Inputs are never mutated; a new array is always returned.
 * Extracted to avoid duplication between mergePermissionsDeny and
 * mergePermissionsAllow (ADR-021 Q1 — identical shape, identical semantics).
 */
function mergePermissionsCore(harness, target) {
    const targetSet = new Set(target);
    const merged = [];
    const seen = new Set();
    for (const rule of harness) {
        if (!seen.has(rule)) {
            merged.push(rule);
            seen.add(rule);
        }
    }
    for (const rule of target) {
        if (!seen.has(rule)) {
            merged.push(rule);
            seen.add(rule);
        }
    }
    const added = [];
    let dedupedCount = 0;
    for (const rule of harness) {
        if (targetSet.has(rule)) {
            dedupedCount++;
        }
        else {
            added.push(rule);
        }
    }
    return { merged, added, dedupedCount };
}
/**
 * Merge two permissions.deny lists with predictable ordering: harness rules
 * appear first in declaration order, then any target-only rules. Inputs are
 * never mutated; a new array is always returned.
 */
export function mergePermissionsDeny(harness, target) {
    return mergePermissionsCore(harness, target);
}
/**
 * Merge two permissions.allow lists with identical semantics to
 * mergePermissionsDeny: harness rules appear first (harness-first ordering),
 * then any target-only rules. Inputs are never mutated; a new array is always
 * returned. Dedup is exact-string equality — order does not affect semantics
 * for allow rules (ADR-021 Q1 red-flag 1).
 */
export function mergePermissionsAllow(harness, target) {
    return mergePermissionsCore(harness, target);
}
/**
 * Deep-merge ONLY permissions.deny from harness into target, preserving every
 * other top-level key (hooks, mcpServers, statusLine, etc.) untouched. Returns
 * a new object — inputs are never mutated. Never touches settings.local.json
 * (caller's responsibility to pass the correct file).
 */
export function mergeSettingsJson(harness, target, _opts) {
    const harnessDeny = harness.permissions?.deny ?? [];
    const targetDeny = target.permissions?.deny ?? [];
    const { merged } = mergePermissionsDeny(harnessDeny, targetDeny);
    // Spread target first to preserve every unrelated key, then layer the merged
    // permissions block on top. permissions.allow + other keys survive intact.
    // safeAssign filters `__proto__`/`constructor`/`prototype` at spread boundaries
    // so a malicious target JSON cannot persist a poisoned key through the merge
    // (spektr HIGH finding, 2026-04-20).
    const result = safeAssign(target);
    const targetPermissions = target.permissions ?? {};
    result.permissions = {
        ...safeAssign(targetPermissions),
        deny: merged,
    };
    return result;
}
/**
 * Compute the canonical .claude/* paths inside a target project directory.
 * Throws on empty or null/undefined input — install scripts must validate the
 * target up front, not silently produce broken paths.
 */
export function resolveTargetPaths(cwd) {
    if (cwd === null || cwd === undefined || cwd === "") {
        throw new Error("resolveTargetPaths: cwd is required and must be a non-empty string.");
    }
    return {
        rules: path.join(cwd, ".claude", "rules"),
        settings: path.join(cwd, ".claude", "settings.json"),
        settingsLocal: path.join(cwd, ".claude", "settings.local.json"),
    };
}
