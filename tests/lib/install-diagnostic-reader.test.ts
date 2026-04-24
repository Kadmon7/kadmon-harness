// TDD [feniks] — Phase 3: readTypedInstallDiagnostics typed reader (ADR-028)
// Step 3.1 RED — write tests first, module not yet implemented.

import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Dynamic import — deferred so the RED run fails with module-not-found, not
// a top-level syntax error.
async function importReader() {
  return import(
    path.resolve("scripts/lib/install-diagnostic-reader.js")
  ) as Promise<{
    readTypedInstallDiagnostics: (
      logDir?: string,
      limit?: number,
    ) => Array<{ _v: number; rootDir?: string; symlinks?: unknown; timestamp?: string; [key: string]: unknown }>;
  }>;
}

// ---- Fixture helpers -------------------------------------------------------

const TEMP_DIR = path.join(
  os.tmpdir(),
  `kadmon-reader-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
);

afterEach(() => {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function setupDir(): void {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function logPath(): string {
  return path.join(TEMP_DIR, "install-diagnostic.log");
}

/** Write raw JSONL lines directly to the log (bypass the writer so we can
 *  force legacy entries without `_v`). */
function writeLine(obj: Record<string, unknown>): void {
  fs.appendFileSync(logPath(), JSON.stringify(obj) + "\n");
}

/** Minimal valid v1.3 entry with _v: 1 */
function mkV1Entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    _v: 1,
    rootDir: "/fake/root",
    symlinks: [],
    timestamp: new Date().toISOString(),
    platform: "linux",
    nodeVersion: "v20.0.0",
    ok: true,
    ...overrides,
  };
}

/** Legacy entry — same shape but no `_v` field */
function mkLegacyEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    rootDir: "/legacy/root",
    symlinks: [],
    timestamp: new Date().toISOString(),
    platform: "linux",
    nodeVersion: "v18.0.0",
    ok: true,
    ...overrides,
  };
}

/** Corrupt entry — missing required fields */
function mkCorruptEntry(): Record<string, unknown> {
  return {
    _v: 1,
    platform: "win32",
    ok: false,
    // deliberately missing rootDir, symlinks, timestamp
  };
}

// ---- Tests -----------------------------------------------------------------

describe("readTypedInstallDiagnostics", () => {
  // (a) valid v1.3 entry with `_v: 1`
  it("returns VersionedInstallReport[] with _v preserved for v1.3 entries", async () => {
    setupDir();
    writeLine(mkV1Entry());

    const { readTypedInstallDiagnostics } = await importReader();
    const entries = readTypedInstallDiagnostics(TEMP_DIR);

    expect(entries).toHaveLength(1);
    expect(entries[0]!._v).toBe(1);
    expect(entries[0]!.rootDir).toBe("/fake/root");
    expect(entries[0]!.symlinks).toEqual([]);
    expect(typeof entries[0]!.timestamp).toBe("string");
  });

  // (b) legacy entry sans `_v` — must be cast as { _v: 0, ...original }
  it("casts legacy entries (no _v) as { _v: 0, ...original }", async () => {
    setupDir();
    writeLine(mkLegacyEntry());

    const { readTypedInstallDiagnostics } = await importReader();
    const entries = readTypedInstallDiagnostics(TEMP_DIR);

    expect(entries).toHaveLength(1);
    expect(entries[0]!._v).toBe(0);
    expect(entries[0]!.rootDir).toBe("/legacy/root");
    // Original fields must be preserved
    expect(entries[0]!.platform).toBe("linux");
    expect(entries[0]!.ok).toBe(true);
  });

  // (c) corrupt entry — missing required field `rootDir` → dropped with stderr warning
  it("drops entries missing rootDir and writes a stderr warning", async () => {
    setupDir();
    writeLine(mkCorruptEntry());

    const stderrLines: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      stderrLines.push(String(chunk));
      return true;
    });

    const { readTypedInstallDiagnostics } = await importReader();
    const entries = readTypedInstallDiagnostics(TEMP_DIR);

    expect(entries).toHaveLength(0);
    expect(stderrLines.some((l) => l.includes("rootDir"))).toBe(true);
  });

  it("drops entries missing symlinks and writes a stderr warning", async () => {
    setupDir();
    writeLine({ _v: 1, rootDir: "/r", timestamp: new Date().toISOString() /* no symlinks */ });

    const stderrLines: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      stderrLines.push(String(chunk));
      return true;
    });

    const { readTypedInstallDiagnostics } = await importReader();
    const entries = readTypedInstallDiagnostics(TEMP_DIR);

    expect(entries).toHaveLength(0);
    expect(stderrLines.some((l) => l.includes("symlinks") || l.includes("warn"))).toBe(true);
  });

  it("drops entries missing timestamp and writes a stderr warning", async () => {
    setupDir();
    writeLine({ _v: 1, rootDir: "/r", symlinks: [] /* no timestamp */ });

    const stderrLines: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      stderrLines.push(String(chunk));
      return true;
    });

    const { readTypedInstallDiagnostics } = await importReader();
    const entries = readTypedInstallDiagnostics(TEMP_DIR);

    expect(entries).toHaveLength(0);
    expect(stderrLines.length).toBeGreaterThan(0);
  });

  // (d) mixed file — all three types coexist
  it("handles mixed file: keeps valid v1.3 + legacy, drops corrupt", async () => {
    setupDir();
    writeLine(mkV1Entry({ rootDir: "/v1" }));          // valid v1.3
    writeLine(mkLegacyEntry({ rootDir: "/legacy" }));  // legacy → _v: 0
    writeLine(mkCorruptEntry());                        // corrupt → dropped

    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const { readTypedInstallDiagnostics } = await importReader();
    const entries = readTypedInstallDiagnostics(TEMP_DIR);

    expect(entries).toHaveLength(2);

    const v1 = entries.find((e) => e.rootDir === "/v1");
    expect(v1!._v).toBe(1);

    const legacy = entries.find((e) => e.rootDir === "/legacy");
    expect(legacy!._v).toBe(0);
  });

  // never throws on individual entry failures
  it("never throws on individual entry failures", async () => {
    setupDir();
    writeLine(mkCorruptEntry());
    writeLine(mkCorruptEntry());

    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const { readTypedInstallDiagnostics } = await importReader();
    expect(() => readTypedInstallDiagnostics(TEMP_DIR)).not.toThrow();
  });

  it("returns [] on outer failure (non-existent logDir)", async () => {
    const { readTypedInstallDiagnostics } = await importReader();
    const entries = readTypedInstallDiagnostics(
      path.join(TEMP_DIR, "does-not-exist"),
    );
    expect(entries).toEqual([]);
  });

  it("respects the limit parameter", async () => {
    setupDir();
    for (let i = 0; i < 5; i++) {
      writeLine(mkV1Entry({ rootDir: `/r${i}` }));
    }

    const { readTypedInstallDiagnostics } = await importReader();
    const entries = readTypedInstallDiagnostics(TEMP_DIR, 3);
    expect(entries).toHaveLength(3);
    expect(entries[2]!.rootDir).toBe("/r4");
  });

  it("returns [] and does not throw when log file is empty", async () => {
    setupDir();
    fs.writeFileSync(logPath(), "");

    const { readTypedInstallDiagnostics } = await importReader();
    expect(() => readTypedInstallDiagnostics(TEMP_DIR)).not.toThrow();
    expect(readTypedInstallDiagnostics(TEMP_DIR)).toEqual([]);
  });
});
