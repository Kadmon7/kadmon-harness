// TDD [feniks] — plan-010 Phase 3 Step 3.1 — RED phase
// Tests for scripts/lib/install-helpers.ts pure library.
//
// RED/GREEN forecast per test group:
//   ALL tests: RED today — scripts/lib/install-helpers.ts does not exist.
//   Vitest will report "Cannot find module" at import time (expected RED state).
//   GREEN after Step 3.2 (implement scripts/lib/install-helpers.ts).
//
// Exports under test:
//   detectPlatform()         → 'win32' | 'darwin' | 'linux'
//   mergePermissionsDeny()   → { merged, added, dedupedCount }
//   mergeSettingsJson()      → Record<string, unknown> (deep-merge only permissions.deny)
//   resolveTargetPaths()     → { rules, settings, settingsLocal }
// (generateHookCommand was removed 2026-04-21 as dead code — Claude Code
//  resolves ${HOOK_CMD_PREFIX} internally, so install.sh never needed to
//  rewrite it. Verified by dogfood-plugin-session E2E 21/21 hooks fire
//  with the placeholder literal in hooks.json.)

import { describe, it, expect, expectTypeOf, afterEach } from "vitest";
import path from "node:path";

import {
  detectPlatform,
  mergePermissionsDeny,
  mergePermissionsAllow,
  mergeSettingsJson,
  resolveTargetPaths,
} from "../../scripts/lib/install-helpers.js";

// ─── process.platform mock helpers ───────────────────────────────────────────

type SupportedPlatform = "win32" | "darwin" | "linux";

function mockPlatform(value: string): void {
  Object.defineProperty(process, "platform", {
    value,
    configurable: true,
    writable: true,
  });
}

function restorePlatform(original: string): void {
  Object.defineProperty(process, "platform", {
    value: original,
    configurable: true,
    writable: true,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// detectPlatform()
// ═══════════════════════════════════════════════════════════════════════════════

describe("detectPlatform()", () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    restorePlatform(originalPlatform);
  });

  it("returns process.platform when it is a supported value", () => {
    // Arrange / Act / Assert — cheapest contract: output matches actual platform
    // This test covers win32, darwin, or linux depending on the CI host.
    // A separate mock-based test covers each specific return value.
    const result = detectPlatform();
    expect(["win32", "darwin", "linux"]).toContain(result);
    // Also confirm type is string (guards against returning undefined)
    expect(typeof result).toBe("string");
  });

  it("returns 'win32' when process.platform is win32", () => {
    mockPlatform("win32");
    expect(detectPlatform()).toBe("win32");
  });

  it("returns 'darwin' when process.platform is darwin", () => {
    mockPlatform("darwin");
    expect(detectPlatform()).toBe("darwin");
  });

  it("returns 'linux' when process.platform is linux", () => {
    mockPlatform("linux");
    expect(detectPlatform()).toBe("linux");
  });

  it("throws on unknown platform (e.g. freebsd)", () => {
    mockPlatform("freebsd");
    expect(() => detectPlatform()).toThrow();
    // Error message must be descriptive
    expect(() => detectPlatform()).toThrowError(/freebsd|unsupported|platform/i);
  });

  it("return type is exactly 'win32' | 'darwin' | 'linux' (type-level contract)", () => {
    // expectTypeOf verifies the TypeScript return type at compile time
    expectTypeOf(detectPlatform).returns.toMatchTypeOf<SupportedPlatform>();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// mergePermissionsDeny(harness, target)
// ═══════════════════════════════════════════════════════════════════════════════

describe("mergePermissionsDeny()", () => {
  it("empty + empty → empty result, 0 added, 0 deduped", () => {
    const result = mergePermissionsDeny([], []);
    expect(result.merged).toEqual([]);
    expect(result.added).toEqual([]);
    expect(result.dedupedCount).toBe(0);
  });

  it("['a', 'b'] + empty → ['a', 'b'], 2 added, 0 deduped", () => {
    const result = mergePermissionsDeny(["a", "b"], []);
    expect(result.merged).toEqual(["a", "b"]);
    expect(result.added).toEqual(["a", "b"]);
    expect(result.dedupedCount).toBe(0);
  });

  it("['a'] + ['b'] → union ['a', 'b'], 1 added, target 'b' preserved, 0 deduped", () => {
    const result = mergePermissionsDeny(["a"], ["b"]);
    expect(result.merged).toContain("a");
    expect(result.merged).toContain("b");
    expect(result.merged).toHaveLength(2);
    expect(result.added).toHaveLength(1);
    expect(result.added).toContain("a");
    expect(result.dedupedCount).toBe(0);
  });

  it("['a', 'b'] + ['a', 'c'] → union ['a', 'b', 'c'], 1 added, 1 deduped", () => {
    const result = mergePermissionsDeny(["a", "b"], ["a", "c"]);
    expect(result.merged).toContain("a");
    expect(result.merged).toContain("b");
    expect(result.merged).toContain("c");
    expect(result.merged).toHaveLength(3);
    // Only 'b' was missing from target — 'a' was already there
    expect(result.added).toHaveLength(1);
    expect(result.added).toContain("b");
    expect(result.dedupedCount).toBe(1);
  });

  it("preserves order: harness rules come first, then target-only rules (predictable diff)", () => {
    // Harness: [x, y, z], Target: [y, w]
    // Expected order: x, y, z (harness rules first), then w (target-only)
    const result = mergePermissionsDeny(["x", "y", "z"], ["y", "w"]);
    // x must appear before w
    const xIdx = result.merged.indexOf("x");
    const wIdx = result.merged.indexOf("w");
    expect(xIdx).toBeGreaterThanOrEqual(0);
    expect(wIdx).toBeGreaterThanOrEqual(0);
    expect(xIdx).toBeLessThan(wIdx);
    // z must also appear before w
    const zIdx = result.merged.indexOf("z");
    expect(zIdx).toBeLessThan(wIdx);
  });

  it("return type matches { merged: string[]; added: string[]; dedupedCount: number }", () => {
    const result = mergePermissionsDeny([], []);
    expectTypeOf(result).toMatchTypeOf<{
      merged: string[];
      added: string[];
      dedupedCount: number;
    }>();
  });

  it("does not mutate the harness input array", () => {
    const harness = ["a", "b"];
    const original = [...harness];
    mergePermissionsDeny(harness, ["c"]);
    expect(harness).toEqual(original);
  });

  it("does not mutate the target input array", () => {
    const target = ["c", "d"];
    const original = [...target];
    mergePermissionsDeny(["a"], target);
    expect(target).toEqual(original);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// mergePermissionsAllow(harness, target)
// ═══════════════════════════════════════════════════════════════════════════════

describe("mergePermissionsAllow()", () => {
  // (a) empty + empty
  it("empty + empty → empty result, 0 added, 0 deduped", () => {
    const result = mergePermissionsAllow([], []);
    expect(result.merged).toEqual([]);
    expect(result.added).toEqual([]);
    expect(result.dedupedCount).toBe(0);
  });

  // (b) harness only (target empty) → all harness items, 0 deduped
  it("harness only (target empty) → all harness items in merged, 0 deduped", () => {
    const harness = ["Bash(git:*)", "Bash(npm:*)", "Skill(*:*)"];
    const result = mergePermissionsAllow(harness, []);
    expect(result.merged).toEqual(["Bash(git:*)", "Bash(npm:*)", "Skill(*:*)"]);
    expect(result.added).toEqual(["Bash(git:*)", "Bash(npm:*)", "Skill(*:*)"]);
    expect(result.dedupedCount).toBe(0);
  });

  // (c) target only (harness empty via empty array)
  it("target only (harness empty) → target items preserved, 0 added, 0 deduped", () => {
    const target = ["Bash(ls:*)", "Bash(pwd:*)"];
    const result = mergePermissionsAllow([], target);
    expect(result.merged).toContain("Bash(ls:*)");
    expect(result.merged).toContain("Bash(pwd:*)");
    expect(result.added).toEqual([]);
    expect(result.dedupedCount).toBe(0);
  });

  // (d) target with overlapping allows → dedup works
  it("['Bash(git:*)'] + ['Bash(git:*)', 'Bash(ls:*)'] → dedup works, 0 added, 1 deduped", () => {
    const result = mergePermissionsAllow(["Bash(git:*)"], ["Bash(git:*)", "Bash(ls:*)"]);
    // Merged should have exactly 2 unique items
    expect(result.merged).toHaveLength(2);
    expect(result.merged).toContain("Bash(git:*)");
    expect(result.merged).toContain("Bash(ls:*)");
    // 'Bash(git:*)' was already in target — not added, just deduped
    expect(result.added).toEqual([]);
    expect(result.dedupedCount).toBe(1);
  });

  // (e) target with disjoint allows → all included, no dedup
  it("disjoint harness + target → all items included, correct added count, 0 deduped", () => {
    const harness = ["Bash(git:*)", "Bash(npm:*)", "Skill(*:*)"];
    const target = ["Bash(ls:*)", "Bash(pwd:*)"];
    const result = mergePermissionsAllow(harness, target);
    // All 5 unique items present
    expect(result.merged).toHaveLength(5);
    // Harness items appear first
    const gitIdx = result.merged.indexOf("Bash(git:*)");
    const lsIdx = result.merged.indexOf("Bash(ls:*)");
    expect(gitIdx).toBeGreaterThanOrEqual(0);
    expect(lsIdx).toBeGreaterThanOrEqual(0);
    expect(gitIdx).toBeLessThan(lsIdx);
    // All harness items were added (none already in target)
    expect(result.added).toEqual(["Bash(git:*)", "Bash(npm:*)", "Skill(*:*)"]);
    expect(result.dedupedCount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// mergeSettingsJson(harness, target, opts?)
// ═══════════════════════════════════════════════════════════════════════════════

describe("mergeSettingsJson()", () => {
  const targetWithHooks = {
    hooks: {
      SessionStart: [{ type: "command", command: "node my-hook.js" }],
    },
    mcpServers: { myServer: { url: "http://localhost:4000" } },
    permissions: {
      deny: ["Read(./.env)"],
    },
  };

  it("preserves target's unrelated top-level keys (hooks, mcpServers) when merging permissions.deny", () => {
    const harness = {
      permissions: { deny: ["Bash(rm -rf /:*)"] },
    };

    const result = mergeSettingsJson(harness, targetWithHooks);

    // Target's unrelated keys must survive untouched
    expect(result).toHaveProperty("hooks");
    expect(result).toHaveProperty("mcpServers");
    // permissions.deny must be a union
    const deny = (result as { permissions: { deny: string[] } }).permissions.deny;
    expect(deny).toContain("Read(./.env)");
    expect(deny).toContain("Bash(rm -rf /:*)");
  });

  it("merges permissions.deny from both harness and target", () => {
    const harness = {
      permissions: { deny: ["a", "b"] },
    };
    const target = {
      permissions: { deny: ["b", "c"] },
    };

    const result = mergeSettingsJson(harness, target);
    const deny = (result as { permissions: { deny: string[] } }).permissions.deny;

    expect(deny).toContain("a");
    expect(deny).toContain("b");
    expect(deny).toContain("c");
    // 'b' should not be duplicated
    const bCount = deny.filter((d) => d === "b").length;
    expect(bCount).toBe(1);
  });

  it("returns a NEW object — never mutates harness or target inputs", () => {
    const harness = { permissions: { deny: ["a"] } };
    const target = { permissions: { deny: ["b"] }, hooks: {} };

    const harnessSnapshot = JSON.parse(JSON.stringify(harness)) as typeof harness;
    const targetSnapshot = JSON.parse(JSON.stringify(target)) as typeof target;

    const result = mergeSettingsJson(harness, target);

    // Result must be a new object
    expect(result).not.toBe(harness);
    expect(result).not.toBe(target);

    // Original inputs must be unchanged
    expect(harness).toEqual(harnessSnapshot);
    expect(target).toEqual(targetSnapshot);
  });

  it("harness with empty permissions.deny leaves target deny list intact", () => {
    const harness = { permissions: { deny: [] } };
    const target = { permissions: { deny: ["Read(./.env)", "Bash(wget:*)"] } };

    const result = mergeSettingsJson(harness, target);
    const deny = (result as { permissions: { deny: string[] } }).permissions.deny;

    expect(deny).toContain("Read(./.env)");
    expect(deny).toContain("Bash(wget:*)");
  });

  it("target missing permissions key entirely — harness deny rules are applied", () => {
    const harness = { permissions: { deny: ["Bash(rm -rf /:*)"] } };
    const target = { hooks: {} };

    const result = mergeSettingsJson(harness, target);
    const deny = (result as { permissions?: { deny?: string[] } }).permissions?.deny;

    expect(deny).toBeDefined();
    expect(deny).toContain("Bash(rm -rf /:*)");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// resolveTargetPaths(cwd)
// ═══════════════════════════════════════════════════════════════════════════════

describe("resolveTargetPaths()", () => {
  it("returns correct paths for a POSIX-style cwd", () => {
    // Use path.join + normalize to make this cross-platform safe
    const cwd = "/tmp/fake-target";
    const result = resolveTargetPaths(cwd);

    expect(result.rules).toBe(path.join(cwd, ".claude", "rules"));
    expect(result.settings).toBe(path.join(cwd, ".claude", "settings.json"));
    expect(result.settingsLocal).toBe(path.join(cwd, ".claude", "settings.local.json"));
  });

  it("returns correct paths for a Windows-style absolute cwd", () => {
    // Only assert structural correctness — the separators may vary per OS
    const cwd = "C:\\Users\\joe\\my-project";
    const result = resolveTargetPaths(cwd);

    // Each path must be rooted in cwd and contain the correct segment
    const normalCwd = path.normalize(cwd);
    expect(path.normalize(result.rules)).toContain(normalCwd);
    expect(result.settings).toContain("settings.json");
    expect(result.settingsLocal).toContain("settings.local.json");
  });

  it("throws on empty string cwd with a clear error message", () => {
    expect(() => resolveTargetPaths("")).toThrow();
    expect(() => resolveTargetPaths("")).toThrowError(/cwd|empty|required/i);
  });

  it("throws on null/undefined cwd with a clear error message", () => {
    // TypeScript callers can't pass null directly, but JS callers can at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => resolveTargetPaths(null as any)).toThrow();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => resolveTargetPaths(undefined as any)).toThrow();
  });

  it("settings.local.json is always separate from settings.json (no collision)", () => {
    const result = resolveTargetPaths("/tmp/fake-target");
    expect(result.settings).not.toBe(result.settingsLocal);
    expect(result.settings).not.toContain("local");
    expect(result.settingsLocal).toContain("local");
  });

  it("return type matches { rules: string; settings: string; settingsLocal: string }", () => {
    const result = resolveTargetPaths("/tmp/fake-target");
    expectTypeOf(result).toMatchTypeOf<{
      rules: string;
      settings: string;
      settingsLocal: string;
    }>();
  });

  it("handles cwd with trailing slash without doubling separators", () => {
    const cwd = "/tmp/trailing-slash/";
    const result = resolveTargetPaths(cwd);
    // Should not produce double-slash paths like /tmp/trailing-slash//.claude/
    expect(result.settings).not.toContain("//");
    expect(result.settings).toContain("settings.json");
  });

  it("handles cwd with embedded spaces (e.g. 'C:\\Command Center\\myproject')", () => {
    const cwd = "C:\\Command Center\\myproject";
    // Should not throw
    expect(() => resolveTargetPaths(cwd)).not.toThrow();
    const result = resolveTargetPaths(cwd);
    expect(result.settings).toContain("settings.json");
    expect(result.settingsLocal).toContain("settings.local.json");
  });
});
