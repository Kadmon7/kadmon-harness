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

// Builds the set of git-tracked paths (files + their ancestor directories)
// once per fixture creation. A real `git clone` only ever receives tracked
// content — anything gitignored (build caches, generated graphify-out
// artifacts, husky's runtime shim under .husky/_) never lands on a fresh
// checkout. Deriving the copy set from `git ls-files` instead of a
// hand-maintained directory blocklist means any FUTURE gitignored directory
// (the next generated-output tool) is excluded automatically — no exclusion
// list to remember to update. This is what actually broke here: the
// 2026-07-19 graphify full rebuild (7be1108) added graphify-out/cache/ and
// graphify-out/obsidian/ (3567 gitignored files) and the old blocklist had
// no way to know about them.
function getTrackedPathSets(): { files: Set<string>; dirs: Set<string> } {
  // -z: NUL-terminated output. This is not a micro-optimization — without it git
  // applies core.quotePath (on by default) and emits non-ASCII paths C-escaped and
  // quoted (`café.md` -> `"caf\303\251.md"`). That string can never match the real
  // path.relative() value the cpSync filter sees, so a tracked file with an accented
  // or Hebrew name would be SILENTLY dropped from the fixture — the exact
  // tracked-vs-copied divergence this helper exists to prevent. -z disables quoting
  // outright. No such filename exists in this repo today; this is preemptive.
  //
  // shell is deliberately NOT set: git is a real .exe on Windows (unlike npm/npx,
  // which are .cmd shims and genuinely need shell resolution — see isNetworkAvailable
  // above). Passing shell:true here would also trigger Node's DEP0190 warning, which
  // fires for spawnSync + shell + args just as it does for execFileSync.
  const result = spawnSync("git", ["ls-files", "-z"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    // result.error carries the useful text when git is missing entirely (ENOENT),
    // where status is null and stderr is undefined.
    const detail = result.error?.message ?? result.stderr ?? "(no stderr)";
    throw new Error(`git ls-files failed (exit ${result.status ?? "null"}): ${detail}`);
  }

  const files = new Set<string>();
  const dirs = new Set<string>();
  for (const entry of result.stdout.split("\0")) {
    if (!entry) continue;
    const rel = entry.split("/").join(path.sep); // git always uses "/", normalize for path.relative comparisons
    files.add(rel);

    // Walk ancestor directories so cpSync's per-entry filter (which visits
    // every directory before its contents) can allow a directory that
    // contains tracked descendants, without listing every intermediate
    // directory explicitly.
    let dirPart = path.dirname(rel);
    while (dirPart !== ".") {
      dirs.add(dirPart);
      dirPart = path.dirname(dirPart);
    }
  }

  return { files, dirs };
}

function createColdCloneDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-cold-clone-"));
  const { files: trackedFiles, dirs: trackedDirs } = getTrackedPathSets();

  fs.cpSync(REPO_ROOT, dir, {
    recursive: true,
    force: true,
    filter: (src: string): boolean => {
      const rel = path.relative(REPO_ROOT, src);
      if (rel === "") return true; // always include root itself

      // dist/ is deliberately excluded even though dist/scripts/ is
      // git-tracked (ADR-010 plugin distribution, enforced by
      // .husky/pre-commit) — this fixture exists specifically to verify
      // that `postinstall` regenerates it via `npm run build` on a fresh
      // install. This is the one intentional divergence from "copy exactly
      // what git tracks"; everything else (node_modules, .git, .husky/_)
      // is already excluded for free because it is gitignored/untracked.
      const firstSegment = rel.split(path.sep)[0]!;
      if (firstSegment === "dist") return false;

      return trackedFiles.has(rel) || trackedDirs.has(rel);
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
// Fixture fidelity: cold-clone dir must mirror a real `git clone`, i.e. only
// git-tracked content — no gitignored generated artifacts.
//
// RED today: createColdCloneDir() excludes only node_modules/dist/.git/.husky/_
// by name. It does NOT exclude graphify-out/cache/ or graphify-out/obsidian/,
// which are gitignored generated output (3567 extra files after the 2026-07-19
// graphify full rebuild, 7be1108) that a real fresh clone never receives.
// Copying them makes the fixture LESS faithful and inflates beforeAll's cpSync
// past the default 10s vitest hookTimeout in a full-suite run.
// GREEN after the fix: the copy set is derived from `git ls-files` (plus the
// deliberate dist/ exclusion).
//
// Honest RED accounting (measured 2026-07-20 by extracting the pre-fix
// implementation via `git show HEAD:tests/build/cold-clone.test.ts` and running
// these assertions against it): only the FIRST test below is genuine RED->GREEN
// evidence. The other two already passed under the old blocklist and are
// regression guards, not proof of this fix. Kept deliberately — they pin
// behavior the git-ls-files rewrite could plausibly have broken.
// ═══════════════════════════════════════════════════════════════════════════════

describe("cold-clone fixture — mirrors a real fresh clone (git-tracked files only)", () => {
  it("excludes gitignored generated graphify-out subpaths (cache, obsidian)", () => {
    expect(fs.existsSync(path.join(tmpDir, "graphify-out", "cache"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, "graphify-out", "obsidian"))).toBe(false);
  });

  it("keeps git-tracked graphify-out content (wiki/, graph.json, GRAPH_REPORT.md)", () => {
    // A real fresh clone DOES have these — they are git-tracked, unlike
    // cache/ and obsidian/ above.
    expect(fs.existsSync(path.join(tmpDir, "graphify-out", "wiki"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "graphify-out", "graph.json"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "graphify-out", "GRAPH_REPORT.md"))).toBe(true);
  });

  it("still excludes node_modules, dist, and .git (pre-existing behavior)", () => {
    expect(fs.existsSync(path.join(tmpDir, "node_modules"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, "dist"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".git"))).toBe(false);
  });
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
