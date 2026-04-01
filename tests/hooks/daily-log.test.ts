import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// daily-log.js will be a sibling ESM module in hooks/scripts/
// We test it by importing the functions directly
const DAILY_LOG_MODULE = path.resolve(".claude/hooks/scripts/daily-log.js");

// Helper to dynamically import the module
async function loadModule() {
  const mod = await import(`file://${DAILY_LOG_MODULE.replace(/\\/g, "/")}`);
  return mod;
}

describe("daily-log", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `kadmon-daily-log-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("appendDailyLog creates log file with correct format", async () => {
    const { appendDailyLog } = await loadModule();
    appendDailyLog(
      {
        sessionId: "abc12345-dead-beef-1234-567890abcdef",
        summary: "Edited 3 files for memory improvements",
        tasks: ["[pending] Implement post-compact hook"],
        topFiles: ["session-start.js", "pre-compact-save.js"],
        commits: ["feat(hooks): add daily log writer"],
      },
      testDir,
    );

    const today = new Date().toISOString().slice(0, 10);
    const logPath = path.join(testDir, "logs", `${today}.md`);
    expect(fs.existsSync(logPath)).toBe(true);

    const content = fs.readFileSync(logPath, "utf8");
    expect(content).toContain(`# ${today}`);
    expect(content).toContain("abc12345");
    expect(content).toContain("Edited 3 files for memory improvements");
    expect(content).toContain("session-start.js");
    expect(content).toContain("[pending] Implement post-compact hook");
    expect(content).toContain("feat(hooks): add daily log writer");
  });

  it("appendDailyLog appends multiple entries to same file", async () => {
    const { appendDailyLog } = await loadModule();

    appendDailyLog(
      {
        sessionId: "s1111111-uuid-1234",
        summary: "First entry",
        tasks: [],
        topFiles: [],
        commits: [],
      },
      testDir,
    );
    appendDailyLog(
      {
        sessionId: "s2222222-uuid-5678",
        summary: "Second entry",
        tasks: [],
        topFiles: [],
        commits: [],
      },
      testDir,
    );

    const today = new Date().toISOString().slice(0, 10);
    const logPath = path.join(testDir, "logs", `${today}.md`);
    const content = fs.readFileSync(logPath, "utf8");

    expect(content).toContain("s1111111");
    expect(content).toContain("First entry");
    expect(content).toContain("s2222222");
    expect(content).toContain("Second entry");
  });

  it("appendDailyLog handles empty fields gracefully", async () => {
    const { appendDailyLog } = await loadModule();

    expect(() =>
      appendDailyLog(
        {
          sessionId: "empty-test",
          summary: "",
          tasks: [],
          topFiles: [],
          commits: [],
        },
        testDir,
      ),
    ).not.toThrow();

    const today = new Date().toISOString().slice(0, 10);
    const logPath = path.join(testDir, "logs", `${today}.md`);
    expect(fs.existsSync(logPath)).toBe(true);
  });

  it("readTodayLog returns content when log exists", async () => {
    const { appendDailyLog, readTodayLog } = await loadModule();

    appendDailyLog(
      {
        sessionId: "readtest-uuid-1234",
        summary: "Test reading",
        tasks: [],
        topFiles: ["file.ts"],
        commits: [],
      },
      testDir,
    );

    const content = readTodayLog(testDir);
    expect(content).toContain("readtest");
    expect(content).toContain("Test reading");
  });

  it("readTodayLog returns empty string when no log exists", async () => {
    const { readTodayLog } = await loadModule();
    const content = readTodayLog(testDir);
    expect(content).toBe("");
  });

  it("creates logs/ subdirectory if it does not exist", async () => {
    const { appendDailyLog } = await loadModule();
    const freshDir = path.join(testDir, "fresh-memory");

    appendDailyLog(
      {
        sessionId: "mkdir-test",
        summary: "Should create dirs",
        tasks: [],
        topFiles: [],
        commits: [],
      },
      freshDir,
    );

    const logsDir = path.join(freshDir, "logs");
    expect(fs.existsSync(logsDir)).toBe(true);
  });
});
