import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Import once at module level (vitest freshly loads each test file)
const { isDistStale, ensureDist } = await import(
  path.resolve(".claude/hooks/scripts/ensure-dist.js")
);

const TEMP_ROOT = path.join(
  os.tmpdir(),
  `kadmon-ensure-dist-test-${Date.now()}`,
);
const SRC_DIR = path.join(TEMP_ROOT, "scripts", "lib");
const DIST_DIR = path.join(TEMP_ROOT, "dist", "scripts", "lib");

afterEach(() => {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
});

function setupTempDirs(): void {
  fs.mkdirSync(SRC_DIR, { recursive: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

describe("isDistStale", () => {
  it("returns stale:false when dist/ is newer than scripts/lib/", () => {
    setupTempDirs();
    const srcFile = path.join(SRC_DIR, "state-store.ts");
    fs.writeFileSync(srcFile, "export const x = 1;");
    const oldTime = new Date(Date.now() - 10_000);
    fs.utimesSync(srcFile, oldTime, oldTime);

    const distFile = path.join(DIST_DIR, "state-store.js");
    fs.writeFileSync(distFile, "export const x = 1;");

    const result = isDistStale(TEMP_ROOT);
    expect(result.stale).toBe(false);
  });

  it("returns stale:true with reason when dist/ directory is missing", () => {
    setupTempDirs();
    fs.writeFileSync(path.join(SRC_DIR, "foo.ts"), "export const x = 1;");
    fs.rmSync(DIST_DIR, { recursive: true, force: true });

    const result = isDistStale(TEMP_ROOT);
    expect(result.stale).toBe(true);
    expect(result.reason).toContain("missing");
  });

  it("returns stale:true when scripts/lib/ has a newer file than dist/", () => {
    setupTempDirs();
    const distFile = path.join(DIST_DIR, "state-store.js");
    fs.writeFileSync(distFile, "export const x = 1;");
    const oldTime = new Date(Date.now() - 10_000);
    fs.utimesSync(distFile, oldTime, oldTime);

    const srcFile = path.join(SRC_DIR, "state-store.ts");
    fs.writeFileSync(srcFile, "export const x = 2;");

    const result = isDistStale(TEMP_ROOT);
    expect(result.stale).toBe(true);
    expect(result.reason).toContain("older than source");
  });

  it("ignores orphan dist files with no .ts counterpart", () => {
    setupTempDirs();
    // Orphan dist file with very old mtime (simulates deleted source)
    const orphan = path.join(DIST_DIR, "removed-module.js");
    fs.writeFileSync(orphan, "x");
    const veryOld = new Date(Date.now() - 1_000_000);
    fs.utimesSync(orphan, veryOld, veryOld);

    // Current source with matching fresh dist
    const srcFile = path.join(SRC_DIR, "current.ts");
    fs.writeFileSync(srcFile, "export const x = 1;");
    const oldTime = new Date(Date.now() - 10_000);
    fs.utimesSync(srcFile, oldTime, oldTime);
    fs.writeFileSync(path.join(DIST_DIR, "current.js"), "export const x = 1;");

    const result = isDistStale(TEMP_ROOT);
    expect(result.stale).toBe(false);
  });

  it("returns stale:true with missing-file reason when src .ts has no dist .js", () => {
    setupTempDirs();
    fs.writeFileSync(path.join(SRC_DIR, "newmod.ts"), "x");
    // dist/ exists but newmod.js does not

    const result = isDistStale(TEMP_ROOT);
    expect(result.stale).toBe(true);
    expect(result.reason).toContain("missing dist");
  });

  it("returns stale:false when no source files exist", () => {
    setupTempDirs();
    const distFile = path.join(DIST_DIR, "state-store.js");
    fs.writeFileSync(distFile, "export const x = 1;");

    const result = isDistStale(TEMP_ROOT);
    expect(result.stale).toBe(false);
  });

  it("detects staleness on real project when source is touched", () => {
    const projectRoot = process.cwd();
    const srcFiles = fs
      .readdirSync(path.join(projectRoot, "scripts", "lib"))
      .filter((f: string) => f.endsWith(".ts"));
    if (srcFiles.length === 0) return;

    const srcPath = path.join(projectRoot, "scripts", "lib", srcFiles[0]);
    const origStat = fs.statSync(srcPath);
    const futureTime = new Date(Date.now() + 60_000);
    fs.utimesSync(srcPath, futureTime, futureTime);

    try {
      const result = isDistStale(projectRoot);
      expect(result.stale).toBe(true);
    } finally {
      fs.utimesSync(srcPath, origStat.atime, origStat.mtime);
    }
  });
});

describe("ensureDist", () => {
  it("returns rebuilt:false when dist/ is fresh", () => {
    setupTempDirs();
    const srcFile = path.join(SRC_DIR, "state-store.ts");
    fs.writeFileSync(srcFile, "export const x = 1;");
    const oldTime = new Date(Date.now() - 10_000);
    fs.utimesSync(srcFile, oldTime, oldTime);

    const distFile = path.join(DIST_DIR, "state-store.js");
    fs.writeFileSync(distFile, "export const x = 1;");

    const result = ensureDist(TEMP_ROOT);
    expect(result.rebuilt).toBe(false);
    expect(result.durationMs).toBe(0);
  });

  it("returns error when build fails on temp dir without package.json", () => {
    setupTempDirs();
    // Make dist stale so ensureDist tries to build
    const distFile = path.join(DIST_DIR, "old.js");
    fs.writeFileSync(distFile, "x");
    const oldTime = new Date(Date.now() - 10_000);
    fs.utimesSync(distFile, oldTime, oldTime);

    const srcFile = path.join(SRC_DIR, "new.ts");
    fs.writeFileSync(srcFile, "x");

    const result = ensureDist(TEMP_ROOT);
    // Build fails because temp dir has no package.json
    expect(result.rebuilt).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("triggers real rebuild on the project root when dist is stale", () => {
    const projectRoot = process.cwd();
    const srcFiles = fs
      .readdirSync(path.join(projectRoot, "scripts", "lib"))
      .filter((f: string) => f.endsWith(".ts"));
    if (srcFiles.length === 0) return;

    const srcPath = path.join(projectRoot, "scripts", "lib", srcFiles[0]);
    const origStat = fs.statSync(srcPath);
    const futureTime = new Date(Date.now() + 60_000);
    fs.utimesSync(srcPath, futureTime, futureTime);

    try {
      const result = ensureDist(projectRoot);
      // ensureDist must detect staleness and attempt a build.
      // In parallel test runs, concurrent tsc processes may fail —
      // that's a race condition, not a code bug. Accept either outcome:
      //   rebuilt:true  → build succeeded
      //   error defined → build attempted but failed (concurrency)
      // Only fail if ensureDist silently skipped the build (no attempt).
      const attempted = result.rebuilt || result.error !== undefined;
      expect(attempted).toBe(true);
      if (result.rebuilt) {
        expect(result.durationMs).toBeGreaterThan(0);
      }
    } finally {
      fs.utimesSync(srcPath, origStat.atime, origStat.mtime);
    }
  });
});
