import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Top-level dynamic import — vitest freshly loads each test file
const { logHookError, getHookErrors } = (await import(
  path.resolve(".claude/hooks/scripts/hook-logger.js")
)) as {
  logHookError: (
    hookName: string,
    error: unknown,
    context?: Record<string, unknown>,
    logDir?: string,
  ) => void;
  getHookErrors: (
    logDir?: string,
    limit?: number,
  ) => Array<Record<string, unknown>>;
};

const TEMP_DIR = path.join(
  os.tmpdir(),
  `kadmon-hook-logger-test-${Date.now()}`,
);

afterEach(() => {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
});

function setup(): void {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

describe("logHookError", () => {
  it("creates hook-errors.log and writes a valid JSON line", () => {
    setup();
    logHookError(
      "session-start",
      new Error("import failed"),
      undefined,
      TEMP_DIR,
    );
    const logPath = path.join(TEMP_DIR, "hook-errors.log");
    expect(fs.existsSync(logPath)).toBe(true);

    const content = fs.readFileSync(logPath, "utf8").trim();
    const entry = JSON.parse(content);
    expect(entry.hook).toBe("session-start");
    expect(entry.error).toBe("import failed");
    expect(entry.timestamp).toBeDefined();
  });

  it("appends multiple entries to the same file", () => {
    setup();
    logHookError("hook-a", new Error("err1"), undefined, TEMP_DIR);
    logHookError("hook-b", new Error("err2"), undefined, TEMP_DIR);

    const logPath = path.join(TEMP_DIR, "hook-errors.log");
    const lines = fs.readFileSync(logPath, "utf8").trim().split("\n");
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).hook).toBe("hook-a");
    expect(JSON.parse(lines[1]).hook).toBe("hook-b");
  });

  it("includes timestamp, hook name, error, and optional context", () => {
    setup();
    logHookError(
      "pre-compact",
      new Error("db locked"),
      { phase: "persist" },
      TEMP_DIR,
    );

    const logPath = path.join(TEMP_DIR, "hook-errors.log");
    const entry = JSON.parse(fs.readFileSync(logPath, "utf8").trim());
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(entry.hook).toBe("pre-compact");
    expect(entry.error).toBe("db locked");
    expect(entry.context).toEqual({ phase: "persist" });
  });

  it("handles non-Error objects gracefully", () => {
    setup();
    logHookError("test-hook", "string error", undefined, TEMP_DIR);
    logHookError("test-hook", null, undefined, TEMP_DIR);
    logHookError("test-hook", { code: 42 }, undefined, TEMP_DIR);

    const logPath = path.join(TEMP_DIR, "hook-errors.log");
    const lines = fs.readFileSync(logPath, "utf8").trim().split("\n");
    expect(lines.length).toBe(3);
    expect(JSON.parse(lines[0]).error).toBe("string error");
    expect(JSON.parse(lines[1]).error).toBe("null");
    expect(JSON.parse(lines[2]).error).toBe("[object Object]");
  });

  it("includes stack trace truncated to 3 lines for Error objects", () => {
    setup();
    logHookError("test-hook", new Error("with stack"), undefined, TEMP_DIR);

    const logPath = path.join(TEMP_DIR, "hook-errors.log");
    const entry = JSON.parse(fs.readFileSync(logPath, "utf8").trim());
    expect(entry.stack).toBeDefined();
    const stackLines = entry.stack.split("\n");
    expect(stackLines.length).toBeLessThanOrEqual(3);
  });
});

describe("getHookErrors", () => {
  it("reads entries and returns them parsed", () => {
    setup();
    logHookError("hook-a", new Error("err1"), undefined, TEMP_DIR);
    logHookError("hook-b", new Error("err2"), undefined, TEMP_DIR);

    const entries = getHookErrors(TEMP_DIR);
    expect(entries.length).toBe(2);
    expect(entries[0].hook).toBe("hook-a");
    expect(entries[1].hook).toBe("hook-b");
  });

  it("returns empty array when log file does not exist", () => {
    const entries = getHookErrors(path.join(TEMP_DIR, "nonexistent"));
    expect(entries).toEqual([]);
  });

  it("respects limit parameter", () => {
    setup();
    logHookError("a", new Error("1"), undefined, TEMP_DIR);
    logHookError("b", new Error("2"), undefined, TEMP_DIR);
    logHookError("c", new Error("3"), undefined, TEMP_DIR);

    const entries = getHookErrors(TEMP_DIR, 2);
    expect(entries.length).toBe(2);
    expect(entries[0].hook).toBe("b");
    expect(entries[1].hook).toBe("c");
  });
});
