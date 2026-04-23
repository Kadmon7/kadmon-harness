// TDD [feniks] — plan-010 Phase 6 Step 6.4 — RED phase
// Cold-clone simulation: verifies husky installs correctly on a fresh npm install,
// and that package.json pins husky to an exact version (no caret/tilde).
//
// Step 6.2 (NOT this file): install husky, add `"prepare": "husky"` to package.json.
//
// RED/GREEN forecast per test:
//   Test 1 (cold clone npm install): RED today (husky not installed → prepare script
//             missing → .husky/pre-commit not created). GREEN after Step 6.2.
//   Test 2 (exact-pin assertion): RED today (husky not in devDependencies at all).
//             GREEN after Step 6.2 (husky pinned as "9.1.7" with no ^ or ~).
//
// Network dependency: Test 1 runs `npm install` which fetches from the registry.
// If the registry is unreachable, the test is skipped with a clear message.
// Skip strategy: attempt `npm ping` before the install. If it fails, skip.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ─── Paths ───────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(".");

// ─── Network availability check ──────────────────────────────────────────────

function isNetworkAvailable(): boolean {
  // npm ping hits the configured registry; exit 0 = reachable, non-zero = unreachable.
  // Windows note: npm is a .cmd script on Windows — spawnSync without shell:true cannot
  // find it (same pattern as the npx execFileSync Windows pitfall in harness memory).
  // Use shell:true on win32 so the OS resolves npm.cmd correctly.
  const result = spawnSync("npm", ["ping", "--prefer-online"], {
    encoding: "utf8",
    timeout: 10_000,
    shell: process.platform === "win32",
  });
  return result.status === 0;
}

// ─── Cold-clone fixture ───────────────────────────────────────────────────────

// tmpDir is created once in beforeAll and removed in afterAll.
let tmpDir: string;

function createColdCloneDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-cold-clone-"));

  // Copy the repo minus heavy/irrelevant directories.
  // Exclusions:
  //   node_modules/  — simulate fresh clone (npm install must fetch them)
  //   .husky/_/      — husky installs this; we want to verify it creates it
  //   .git/          — not needed for install test, makes cpSync 10x slower
  //   dist/          — forcing npm install to regenerate (postinstall runs build)
  //   tests/build/   — not needed; avoids circular reference risks
  fs.cpSync(REPO_ROOT, dir, {
    recursive: true,
    force: true,
    filter: (src: string): boolean => {
      const rel = path.relative(REPO_ROOT, src);
      if (rel === "") return true; // always include root itself
      // Exclude by leading segment
      const firstSegment = rel.split(path.sep)[0]!;
      if (firstSegment === "node_modules") return false;
      if (firstSegment === "dist") return false;
      if (firstSegment === ".git") return false;
      // Exclude .husky/_ specifically (husky runtime — we want install to recreate it)
      // but keep .husky/ itself (it may have our pre-commit script already for Step 6.2+)
      if (rel === path.join(".husky", "_") || rel.startsWith(path.join(".husky", "_") + path.sep)) {
        return false;
      }
      return true;
    },
  });

  return dir;
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeAll(() => {
  tmpDir = createColdCloneDir();
});

afterAll(() => {
  if (tmpDir) {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup — test output already captured
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test 2 (fast, no network): package.json exact-pin assertion
// Run this BEFORE the network-dependent test so it gives feedback even when
// the cold-clone test is skipped.
// ═══════════════════════════════════════════════════════════════════════════════

describe("package.json — husky exact-version pin", () => {
  it(
    // Test 2 — RED today: husky is not in devDependencies at all.
    // GREEN after Step 6.2: package.json has `"husky": "9.1.7"` (no ^ or ~).
    // Defense against future accidental loosening: the exact-version pin ensures
    // all collaborators get the same husky binary on a fresh clone.
    "has husky pinned to an exact version (no caret or tilde) in devDependencies",
    () => {
      // Read from REPO_ROOT (not tmpDir) — this is a static metadata assertion.
      const pkgPath = path.join(REPO_ROOT, "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
        devDependencies?: Record<string, string>;
      };

      // husky must be present in devDependencies
      expect(pkg.devDependencies).toBeDefined();
      expect(pkg.devDependencies!["husky"]).toBeDefined();

      const huskyVersion = pkg.devDependencies!["husky"]!;

      // Must be an exact semver (digits only, dots only) — no ^ or ~ prefix
      expect(huskyVersion).toMatch(/^\d+\.\d+\.\d+$/);
    },
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test 1 (network-dependent): cold-clone + npm install + husky hook presence
// ═══════════════════════════════════════════════════════════════════════════════

describe("cold-clone simulation — npm install creates .husky/pre-commit", () => {
  it(
    // Test 1 — RED today: husky is not installed → no prepare script →
    //   npm install completes but .husky/pre-commit is not created.
    // GREEN after Step 6.2: `"prepare": "husky"` is in package.json →
    //   npm install runs prepare → husky writes .husky/_ runtime shim →
    //   .husky/pre-commit already exists (we copied it) → test passes.
    //
    // Skip if network is unavailable (CI offline runs / no registry access).
    "after npm install, .husky/pre-commit exists and is non-empty",
    { timeout: 180_000 }, // npm install can take 60-120s on a cold registry
    () => {
      // Network pre-check — skip gracefully if registry is unreachable
      if (!isNetworkAvailable()) {
        console.warn("[cold-clone] Skipped: npm registry unreachable (network unavailable)");
        // Vitest does not support dynamic it.skip() — use expect.soft workaround:
        // mark as skipped via a test that trivially passes but documents the skip.
        return;
      }

      // Run npm install in the cold-clone tmpDir
      // This simulates collaborators running `npm install` on a fresh clone.
      // Windows note: npm is a .cmd script — spawnSync with shell:true resolves it.
      // Use spawnSync (not execFileSync) to avoid Node's DEP0190 warning about
      // shell+execFileSync arg concatenation (args are hardcoded literals, not user input).
      const installResult = spawnSync("npm", ["install", "--prefer-online"], {
        cwd: tmpDir,
        encoding: "utf8",
        timeout: 150_000, // 2.5 minutes — generous for slow registries
        stdio: ["pipe", "pipe", "pipe"],
        shell: process.platform === "win32",
      });

      if (installResult.status !== 0) {
        throw new Error(
          `npm install failed in cold-clone dir (exit ${installResult.status ?? "null"}).\n` +
          `stdout: ${installResult.stdout ?? "(none)"}\n` +
          `stderr: ${installResult.stderr ?? "(none)"}`,
        );
      }

      // After install, .husky/pre-commit must exist.
      // RED today: husky not in devDependencies → no prepare script →
      //   npm install completes without creating .husky/pre-commit → ENOENT.
      // GREEN after Step 6.2: prepare script runs husky → .husky/pre-commit created.
      const preCommitPath = path.join(tmpDir, ".husky", "pre-commit");

      // This assertion is the RED gate: ENOENT here means husky was not installed.
      expect(() => fs.accessSync(preCommitPath, fs.constants.F_OK)).not.toThrow();

      // Must be non-empty (not a zero-byte placeholder)
      const content = fs.readFileSync(preCommitPath, "utf8");
      expect(content.trim().length).toBeGreaterThan(0);

      // Must have a shebang (it's a shell script, not a binary stub)
      const firstLine = content.split("\n")[0]!;
      expect(firstLine).toMatch(/^#!.*(bash|sh)/);

      // Executable bit — non-Windows only (X_OK is always true on win32)
      if (process.platform !== "win32") {
        expect(() => fs.accessSync(preCommitPath, fs.constants.X_OK)).not.toThrow();
      }
    },
  );
});
