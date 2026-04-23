import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  writeRotatingJsonlLog,
  readRotatingJsonlLog,
} from "../../scripts/lib/rotating-jsonl-log.js";

const TEMP_DIR = path.join(
  os.tmpdir(),
  `kadmon-rotating-jsonl-test-${Date.now()}`,
);

afterEach(() => {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
});

function setup(): string {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  return path.join(TEMP_DIR, "test.log");
}

describe("writeRotatingJsonlLog", () => {
  it("creates the file and writes one JSON line", () => {
    const logPath = setup();
    writeRotatingJsonlLog(logPath, { hook: "a", error: "e1" });

    expect(fs.existsSync(logPath)).toBe(true);
    const content = fs.readFileSync(logPath, "utf8").trim();
    const entry = JSON.parse(content);
    expect(entry.hook).toBe("a");
    expect(entry.error).toBe("e1");
  });

  it("appends subsequent entries on separate lines", () => {
    const logPath = setup();
    writeRotatingJsonlLog(logPath, { hook: "a" });
    writeRotatingJsonlLog(logPath, { hook: "b" });
    writeRotatingJsonlLog(logPath, { hook: "c" });

    const lines = fs.readFileSync(logPath, "utf8").trim().split("\n");
    expect(lines.length).toBe(3);
    expect(JSON.parse(lines[0]!).hook).toBe("a");
    expect(JSON.parse(lines[1]!).hook).toBe("b");
    expect(JSON.parse(lines[2]!).hook).toBe("c");
  });

  it("creates parent directory if it does not exist", () => {
    const nested = path.join(TEMP_DIR, "a", "b", "c", "nested.log");
    writeRotatingJsonlLog(nested, { hook: "x" });
    expect(fs.existsSync(nested)).toBe(true);
  });

  it("defaults to 100KB / 50 lines rotation policy (matches hook-logger)", () => {
    const logPath = setup();

    const paddedEntry = JSON.stringify({
      hook: "pre-fill",
      error: "x".repeat(560),
      timestamp: new Date().toISOString(),
    });
    fs.writeFileSync(
      logPath,
      Array.from({ length: 200 }, () => paddedEntry).join("\n") + "\n",
    );
    expect(fs.statSync(logPath).size).toBeGreaterThan(100_000);

    writeRotatingJsonlLog(logPath, { hook: "trigger", error: "new" });

    const lines = fs.readFileSync(logPath, "utf8").trim().split("\n");
    expect(lines.length).toBe(51);
  });

  it("respects custom maxSizeBytes and keepLines options", () => {
    const logPath = setup();
    const entry = JSON.stringify({ n: 1 });
    fs.writeFileSync(
      logPath,
      Array.from({ length: 20 }, () => entry).join("\n") + "\n",
    );

    writeRotatingJsonlLog(
      logPath,
      { hook: "trigger" },
      { maxSizeBytes: 100, keepLines: 5 },
    );

    const lines = fs.readFileSync(logPath, "utf8").trim().split("\n");
    expect(lines.length).toBe(6);
  });

  it("preserves most recent entries when truncating", () => {
    const logPath = setup();

    const pad = "x".repeat(530);
    const prefillLines = Array.from({ length: 200 }, (_, i) =>
      JSON.stringify({ n: i, pad }),
    );
    fs.writeFileSync(logPath, prefillLines.join("\n") + "\n");
    expect(fs.statSync(logPath).size).toBeGreaterThan(100_000);

    writeRotatingJsonlLog(logPath, { n: 999, tag: "new" });

    const entries = readRotatingJsonlLog(logPath);
    expect(entries.length).toBe(51);
    expect(entries[0]!.n).toBe(150);
    expect(entries[50]!.tag).toBe("new");
  });

  it("does not rotate below the size threshold", () => {
    const logPath = setup();
    for (let i = 0; i < 10; i++) {
      writeRotatingJsonlLog(logPath, { n: i });
    }
    const lines = fs.readFileSync(logPath, "utf8").trim().split("\n");
    expect(lines.length).toBe(10);
  });

  it("never throws on invalid paths (silent failure)", () => {
    const invalid = path.join("/this/path/absolutely/does/not/exist", "x.log");
    expect(() => writeRotatingJsonlLog(invalid, { x: 1 })).not.toThrow();
  });
});

describe("readRotatingJsonlLog", () => {
  it("returns all entries parsed from a valid log", () => {
    const logPath = setup();
    writeRotatingJsonlLog(logPath, { hook: "a" });
    writeRotatingJsonlLog(logPath, { hook: "b" });

    const entries = readRotatingJsonlLog(logPath);
    expect(entries.length).toBe(2);
    expect(entries[0]!.hook).toBe("a");
    expect(entries[1]!.hook).toBe("b");
  });

  it("returns empty array when file does not exist", () => {
    expect(
      readRotatingJsonlLog(path.join(TEMP_DIR, "missing.log")),
    ).toEqual([]);
  });

  it("respects limit parameter returning last N entries", () => {
    const logPath = setup();
    for (let i = 0; i < 10; i++) {
      writeRotatingJsonlLog(logPath, { n: i });
    }

    const entries = readRotatingJsonlLog(logPath, 3);
    expect(entries.length).toBe(3);
    expect(entries[0]!.n).toBe(7);
    expect(entries[2]!.n).toBe(9);
  });

  it("skips corrupted JSON lines without losing valid ones", () => {
    const logPath = setup();
    const mixed =
      [
        JSON.stringify({ hook: "v1" }),
        "not json at all",
        JSON.stringify({ hook: "v2" }),
        "{broken",
        JSON.stringify({ hook: "v3" }),
      ].join("\n") + "\n";
    fs.writeFileSync(logPath, mixed);

    const entries = readRotatingJsonlLog(logPath);
    expect(entries.length).toBe(3);
    expect(entries[0]!.hook).toBe("v1");
    expect(entries[1]!.hook).toBe("v2");
    expect(entries[2]!.hook).toBe("v3");
  });

  it("returns empty array on unreadable path (silent failure)", () => {
    expect(readRotatingJsonlLog("/definitely/not/a/real/path.log")).toEqual(
      [],
    );
  });
});
