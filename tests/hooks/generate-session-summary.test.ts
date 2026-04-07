import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Import the module under test (JS hook, no type declarations)
const summaryModule =
  // @ts-expect-error -- JS hook file without type declarations
  await import("../../.claude/hooks/scripts/generate-session-summary.js");
const { generateSummary, extractBashFiles } = summaryModule;

const TMP_DIR = path.join(os.tmpdir(), "kadmon-test-summary");
const OBS_FILE = path.join(TMP_DIR, "observations.jsonl");

function writeObs(events: object[]): void {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(
    OBS_FILE,
    events.map((e) => JSON.stringify(e)).join("\n") + "\n",
  );
}

describe("extractBashFiles", () => {
  it("extracts redirect targets", () => {
    const files = extractBashFiles('echo "hello" > output.txt');
    expect(files.has("output.txt")).toBe(true);
  });

  it("extracts append redirect targets", () => {
    const files = extractBashFiles("echo data >> log.txt");
    expect(files.has("log.txt")).toBe(true);
  });

  it("extracts cp destinations", () => {
    const files = extractBashFiles("cp src/a.ts src/b.ts");
    expect(files.has("src/b.ts")).toBe(true);
  });

  it("extracts mv destinations", () => {
    const files = extractBashFiles("mv old.js new.js");
    expect(files.has("new.js")).toBe(true);
  });

  it("extracts touch targets", () => {
    const files = extractBashFiles("touch .gitkeep");
    expect(files.has(".gitkeep")).toBe(true);
  });

  it("ignores flags starting with -", () => {
    const files = extractBashFiles("cp -r src/ dest/");
    expect(files.has("-r")).toBe(false);
  });

  it("ignores /dev/ paths", () => {
    const files = extractBashFiles("echo test > /dev/null");
    expect(files.has("/dev/null")).toBe(false);
  });

  it("ignores glob patterns with *", () => {
    const files = extractBashFiles("ls > *.txt");
    expect(files.has("*.txt")).toBe(false);
  });

  it("returns empty set for non-file commands", () => {
    const files = extractBashFiles("git status");
    expect(files.size).toBe(0);
  });
});

describe("generateSummary", () => {
  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("returns empty result for missing file", () => {
    const result = generateSummary("/nonexistent/path/obs.jsonl");
    expect(result.summary).toBe("");
    expect(result.tasks).toEqual([]);
    expect(result.topFiles).toEqual([]);
    expect(result.bashFiles).toEqual([]);
  });

  it("returns empty result for empty file", () => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.writeFileSync(OBS_FILE, "");
    const result = generateSummary(OBS_FILE);
    expect(result.summary).toBe("");
    expect(result.tasks).toEqual([]);
  });

  it("populates topFiles from Edit/Write events", () => {
    writeObs([
      {
        eventType: "tool_pre",
        toolName: "Edit",
        filePath: "/project/src/index.ts",
        metadata: {},
      },
      {
        eventType: "tool_pre",
        toolName: "Write",
        filePath: "/project/src/utils.ts",
        metadata: {},
      },
    ]);
    const result = generateSummary(OBS_FILE);
    expect(result.topFiles).toContain("index.ts");
    expect(result.topFiles).toContain("utils.ts");
  });

  it("populates bashFiles from Bash commands", () => {
    writeObs([
      {
        eventType: "tool_pre",
        toolName: "Bash",
        filePath: null,
        metadata: { command: "touch .gitkeep" },
      },
      {
        eventType: "tool_pre",
        toolName: "Bash",
        filePath: null,
        metadata: { command: 'cat > /tmp/test.json << EOF\n{"a":1}\nEOF' },
      },
    ]);
    const result = generateSummary(OBS_FILE);
    expect(result.bashFiles).toContain(".gitkeep");
  });

  it("infers task from commit message when no Agent/Skill events", () => {
    writeObs([
      {
        eventType: "tool_pre",
        toolName: "Bash",
        filePath: null,
        metadata: { command: 'git commit -m "feat(hooks): add timeouts"' },
      },
    ]);
    const result = generateSummary(OBS_FILE);
    expect(result.tasks.length).toBeGreaterThan(0);
    expect(result.tasks[0]).toContain("feat(hooks)");
  });

  it("infers 'Developed and tested' when edits + tests", () => {
    writeObs([
      {
        eventType: "tool_pre",
        toolName: "Edit",
        filePath: "/p/src/a.ts",
        metadata: {},
      },
      {
        eventType: "tool_pre",
        toolName: "Bash",
        filePath: null,
        metadata: { command: "npx vitest run" },
      },
    ]);
    const result = generateSummary(OBS_FILE);
    expect(result.tasks).toContain("Developed and tested code changes");
  });

  it("infers 'Code exploration' for read-only sessions", () => {
    writeObs([
      {
        eventType: "tool_pre",
        toolName: "Read",
        filePath: "/p/src/a.ts",
        metadata: {},
      },
      {
        eventType: "tool_pre",
        toolName: "Read",
        filePath: "/p/src/b.ts",
        metadata: {},
      },
    ]);
    const result = generateSummary(OBS_FILE);
    expect(result.tasks).toContain("Code exploration and research");
  });

  it("uses Agent descriptions as tasks when present", () => {
    writeObs([
      {
        eventType: "tool_pre",
        toolName: "Agent",
        filePath: null,
        metadata: {
          agentType: "Explore",
          description: "Audit database layer",
        },
      },
    ]);
    const result = generateSummary(OBS_FILE);
    expect(result.tasks).toContain("Audit database layer");
  });

  it("puts commit message first in summary", () => {
    writeObs([
      {
        eventType: "tool_pre",
        toolName: "Edit",
        filePath: "/p/src/a.ts",
        metadata: {},
      },
      {
        eventType: "tool_pre",
        toolName: "Bash",
        filePath: null,
        metadata: { command: 'git commit -m "fix(db): resolve race"' },
      },
    ]);
    const result = generateSummary(OBS_FILE);
    expect(result.summary.startsWith("Committed:")).toBe(true);
  });

  it("counts tool failures correctly", () => {
    writeObs([
      {
        eventType: "tool_pre",
        toolName: "Bash",
        filePath: null,
        metadata: { command: "npm run build" },
      },
      {
        eventType: "tool_post",
        toolName: "Bash",
        success: false,
        error: "Exit code 1",
      },
    ]);
    const result = generateSummary(OBS_FILE);
    expect(result.summary).toContain("1 tool failure");
  });
});
