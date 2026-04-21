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
const FORBIDDEN_KEYS: readonly string[] = [
  "__proto__",
  "constructor",
  "prototype",
];

/**
 * Copy own enumerable keys from `src` into a fresh object, filtering any key
 * in FORBIDDEN_KEYS. Preserves ordinary prototype (not null-proto) so the
 * result works seamlessly with JSON.stringify and ordinary JS consumers.
 */
export function safeAssign<T extends Record<string, unknown>>(src: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (!FORBIDDEN_KEYS.includes(k)) {
      out[k] = v;
    }
  }
  return out as T;
}

/** Platforms Kadmon Harness supports. Narrower than NodeJS.Platform on purpose. */
export type SupportedPlatform = "win32" | "darwin" | "linux";

/**
 * Detect the current OS platform, narrowed to the 3 platforms Kadmon supports.
 * Throws on unknown platforms (e.g. freebsd, sunos, aix) — callers must handle
 * the failure explicitly rather than silently degrading to an unsupported path.
 */
export function detectPlatform(): SupportedPlatform {
  const p = process.platform;
  if (p === "win32" || p === "darwin" || p === "linux") {
    return p;
  }
  throw new Error(
    `Unsupported platform: ${p}. Kadmon supports win32, darwin, linux.`,
  );
}

export interface MergeDenyResult {
  /** Final union (harness rules first, then target-only rules). */
  merged: string[];
  /** Harness rules NOT already present in target (the new additions). */
  added: string[];
  /** Harness rules already present in target (the overlap). */
  dedupedCount: number;
}

/**
 * Merge two permissions.deny lists with predictable ordering: harness rules
 * appear first in declaration order, then any target-only rules. Inputs are
 * never mutated; a new array is always returned.
 */
export function mergePermissionsDeny(
  harness: readonly string[],
  target: readonly string[],
): MergeDenyResult {
  const targetSet = new Set(target);
  const merged: string[] = [];
  const seen = new Set<string>();

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

  const added: string[] = [];
  let dedupedCount = 0;
  for (const rule of harness) {
    if (targetSet.has(rule)) {
      dedupedCount++;
    } else {
      added.push(rule);
    }
  }

  return { merged, added, dedupedCount };
}

export interface SettingsJsonLike {
  permissions?: {
    deny?: readonly string[];
    allow?: readonly string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface MergeSettingsOpts {
  forceDenySync?: boolean;
}

/**
 * Deep-merge ONLY permissions.deny from harness into target, preserving every
 * other top-level key (hooks, mcpServers, statusLine, etc.) untouched. Returns
 * a new object — inputs are never mutated. Never touches settings.local.json
 * (caller's responsibility to pass the correct file).
 */
export function mergeSettingsJson(
  harness: SettingsJsonLike,
  target: SettingsJsonLike,
  _opts?: MergeSettingsOpts,
): SettingsJsonLike {
  const harnessDeny = harness.permissions?.deny ?? [];
  const targetDeny = target.permissions?.deny ?? [];
  const { merged } = mergePermissionsDeny(harnessDeny, targetDeny);

  // Spread target first to preserve every unrelated key, then layer the merged
  // permissions block on top. permissions.allow + other keys survive intact.
  // safeAssign filters `__proto__`/`constructor`/`prototype` at spread boundaries
  // so a malicious target JSON cannot persist a poisoned key through the merge
  // (spektr HIGH finding, 2026-04-20).
  const result: SettingsJsonLike = safeAssign(target as Record<string, unknown>);
  const targetPermissions = target.permissions ?? {};
  result.permissions = {
    ...safeAssign(targetPermissions as Record<string, unknown>),
    deny: merged,
  };

  return result;
}

export interface TargetPaths {
  rules: string;
  settings: string;
  settingsLocal: string;
}

/**
 * Compute the canonical .claude/* paths inside a target project directory.
 * Throws on empty or null/undefined input — install scripts must validate the
 * target up front, not silently produce broken paths.
 */
export function resolveTargetPaths(cwd: string): TargetPaths {
  if (cwd === null || cwd === undefined || cwd === "") {
    throw new Error(
      "resolveTargetPaths: cwd is required and must be a non-empty string.",
    );
  }
  return {
    rules: path.join(cwd, ".claude", "rules"),
    settings: path.join(cwd, ".claude", "settings.json"),
    settingsLocal: path.join(cwd, ".claude", "settings.local.json"),
  };
}
