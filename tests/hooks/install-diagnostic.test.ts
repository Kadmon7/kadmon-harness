import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { InstallHealthReport } from "../../scripts/lib/install-health.js";

const { logInstallDiagnostic, readInstallDiagnostics } = (await import(
  path.resolve(".claude/hooks/scripts/install-diagnostic.js")
)) as {
  logInstallDiagnostic: (
    report: InstallHealthReport,
    logDir?: string,
  ) => void;
  readInstallDiagnostics: (
    logDir?: string,
    limit?: number,
  ) => Array<Record<string, unknown>>;
};

const TEMP_DIR = path.join(
  os.tmpdir(),
  `kadmon-install-diagnostic-test-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`,
);

afterEach(() => {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
});

function setup(): void {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function mkReport(overrides: Partial<InstallHealthReport> = {}): InstallHealthReport {
  return {
    rootDir: "/fake/root",
    platform: "linux",
    nodeVersion: "v20.0.0",
    runtimeRootEnv: null,
    inPluginCache: false,
    symlinks: [],
    distPresent: true,
    distStale: { stale: false, reason: "ok" },
    anomalies: [],
    ok: true,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("logInstallDiagnostic", () => {
  it("creates install-diagnostic.log and writes a JSON line when logDir is provided", () => {
    setup();
    logInstallDiagnostic(mkReport(), TEMP_DIR);

    const logPath = path.join(TEMP_DIR, "install-diagnostic.log");
    expect(fs.existsSync(logPath)).toBe(true);
    const entry = JSON.parse(fs.readFileSync(logPath, "utf8").trim());
    expect(entry.rootDir).toBe("/fake/root");
    expect(entry.ok).toBe(true);
  });

  it("appends multiple reports across invocations", () => {
    setup();
    logInstallDiagnostic(mkReport({ rootDir: "/r1" }), TEMP_DIR);
    logInstallDiagnostic(mkReport({ rootDir: "/r2" }), TEMP_DIR);
    logInstallDiagnostic(mkReport({ rootDir: "/r3" }), TEMP_DIR);

    const lines = fs
      .readFileSync(path.join(TEMP_DIR, "install-diagnostic.log"), "utf8")
      .trim()
      .split("\n");
    expect(lines.length).toBe(3);
  });

  it("persists the full report shape (no field drop)", () => {
    setup();
    const report = mkReport({
      runtimeRootEnv: "/x/plugins/cache",
      inPluginCache: true,
      anomalies: ["canonical-link:agents:text_file (14b)"],
      ok: false,
    });
    logInstallDiagnostic(report, TEMP_DIR);

    const entry = JSON.parse(
      fs
        .readFileSync(path.join(TEMP_DIR, "install-diagnostic.log"), "utf8")
        .trim(),
    );
    expect(entry.inPluginCache).toBe(true);
    expect(entry.anomalies).toEqual(["canonical-link:agents:text_file (14b)"]);
    expect(entry.ok).toBe(false);
  });

  it("suppresses writes to the production log when VITEST is set and no logDir override", () => {
    const realHome = os.homedir();
    const prodLogPath = path.join(realHome, ".kadmon", "install-diagnostic.log");
    const sizeBefore = fs.existsSync(prodLogPath)
      ? fs.statSync(prodLogPath).size
      : 0;

    const originalVitest = process.env.VITEST;
    const originalTestDb = process.env.KADMON_TEST_DB;
    delete process.env.KADMON_TEST_DB;
    process.env.VITEST = "true";
    try {
      logInstallDiagnostic(mkReport({ rootDir: "/should-not-leak" }));
    } finally {
      if (originalVitest === undefined) delete process.env.VITEST;
      else process.env.VITEST = originalVitest;
      if (originalTestDb !== undefined)
        process.env.KADMON_TEST_DB = originalTestDb;
    }

    const sizeAfter = fs.existsSync(prodLogPath)
      ? fs.statSync(prodLogPath).size
      : 0;
    expect(sizeAfter).toBe(sizeBefore);
  });

  it("never throws on invalid logDir (silent failure)", () => {
    expect(() =>
      logInstallDiagnostic(mkReport(), "/definitely/not/a/real/dir/path"),
    ).not.toThrow();
  });
});

describe("readInstallDiagnostics", () => {
  it("reads stored entries and returns them parsed", () => {
    setup();
    logInstallDiagnostic(mkReport({ rootDir: "/a" }), TEMP_DIR);
    logInstallDiagnostic(mkReport({ rootDir: "/b" }), TEMP_DIR);

    const entries = readInstallDiagnostics(TEMP_DIR);
    expect(entries.length).toBe(2);
    expect(entries[0]!.rootDir).toBe("/a");
    expect(entries[1]!.rootDir).toBe("/b");
  });

  it("returns empty array when log does not exist", () => {
    expect(readInstallDiagnostics(path.join(TEMP_DIR, "nope"))).toEqual([]);
  });

  it("respects limit parameter", () => {
    setup();
    for (let i = 0; i < 5; i++) {
      logInstallDiagnostic(mkReport({ rootDir: `/r${i}` }), TEMP_DIR);
    }
    const entries = readInstallDiagnostics(TEMP_DIR, 2);
    expect(entries.length).toBe(2);
    expect(entries[0]!.rootDir).toBe("/r3");
    expect(entries[1]!.rootDir).toBe("/r4");
  });
});
