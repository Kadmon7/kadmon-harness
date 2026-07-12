import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/observe-pre.js");
const SESSION_ID = `test-obs-${Date.now()}`;
const OBS_DIR = path.join(os.tmpdir(), "kadmon", SESSION_ID);
const OBS_FILE = path.join(OBS_DIR, "observations.jsonl");

function runHook(input: object): number {
  try {
    execFileSync("node", [HOOK], {
      encoding: "utf8",
      input: JSON.stringify(input),
      stdio: ["pipe", "pipe", "pipe"],
    });
    return 0;
  } catch (err: unknown) {
    return (err as { status: number }).status ?? 1;
  }
}

describe("observe-pre", () => {
  afterEach(() => {
    fs.rmSync(OBS_DIR, { recursive: true, force: true });
  });

  it("creates observations JSONL file", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Read",
      tool_input: { file_path: "src/index.ts" },
    });
    expect(fs.existsSync(OBS_FILE)).toBe(true);
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    const event = JSON.parse(lines[0]);
    expect(event.toolName).toBe("Read");
    expect(event.filePath).toBe("src/index.ts");
    expect(event.eventType).toBe("tool_pre");
  });

  it("appends multiple observations", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Read",
      tool_input: { file_path: "a.ts" },
    });
    runHook({
      session_id: SESSION_ID,
      tool_name: "Edit",
      tool_input: { file_path: "b.ts" },
    });
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
  });

  it("exits 0 always", () => {
    expect(
      runHook({
        session_id: SESSION_ID,
        tool_name: "Bash",
        tool_input: { command: "ls" },
      }),
    ).toBe(0);
  });

  it("exits 0 with no session_id", () => {
    expect(runHook({ tool_name: "Read" })).toBe(0);
  });

  it("captures agent name from description when tool is Agent", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Agent",
      tool_input: {
        description: "Explore codebase structure",
        subagent_type: "typescript-reviewer",
      },
    });
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    const event = JSON.parse(lines[0]);
    expect(event.toolName).toBe("Agent");
    expect(event.metadata.agentType).toBe("typescript-reviewer");
    expect(event.metadata.agentDescription).toBe("Explore codebase structure");
  });

  it("handles Agent without subagent_type gracefully", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Agent",
      tool_input: { description: "Some task" },
    });
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    const event = JSON.parse(lines[0]);
    expect(event.metadata.agentType).toBeNull();
    expect(event.metadata.agentDescription).toBe("Some task");
  });

  it("writes last_pre_ts.txt with valid timestamp", () => {
    const before = Date.now();
    runHook({
      session_id: SESSION_ID,
      tool_name: "Read",
      tool_input: { file_path: "src/index.ts" },
    });
    const tsFile = path.join(OBS_DIR, "last_pre_ts.txt");
    expect(fs.existsSync(tsFile)).toBe(true);
    const ts = parseInt(fs.readFileSync(tsFile, "utf8").trim(), 10);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(Date.now());
  });

  // Phase 1 RED — Skill.skill capture (plan-006 Phase 1)

  it("captures Skill.skill as metadata.skillName when toolName === 'Skill'", () => {
    const sid = "sess-phase1-red-a";
    const dir = path.join(os.tmpdir(), "kadmon", sid);
    const obsFile = path.join(dir, "observations.jsonl");
    try {
      runHook({
        session_id: sid,
        tool_name: "Skill",
        tool_input: { skill: "skill-creator:skill-creator" },
      });
      const lines = fs.readFileSync(obsFile, "utf8").trim().split("\n");
      const event = JSON.parse(lines[lines.length - 1]);
      expect(event.metadata.skillName).toBe("skill-creator:skill-creator");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("leaves skillName undefined for non-Skill tools", () => {
    const sid = "sess-phase1-red-b";
    const dir = path.join(os.tmpdir(), "kadmon", sid);
    const obsFile = path.join(dir, "observations.jsonl");
    try {
      runHook({
        session_id: sid,
        tool_name: "Edit",
        tool_input: { file_path: "/tmp/x.ts" },
      });
      const lines = fs.readFileSync(obsFile, "utf8").trim().split("\n");
      const event = JSON.parse(lines[lines.length - 1]);
      expect(event.metadata.skillName).toBeUndefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // AUD-06 (2026-07-12 audit §2 Cluster B) — capture tool_use_id so
  // session-end-all can correlate parallel Agent pre/post events by id.

  it("records toolUseId when tool_use_id is present in the payload", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Agent",
      tool_use_id: "toolu_abc123",
      tool_input: { subagent_type: "kody", description: "review" },
    });
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    const event = JSON.parse(lines[0]);
    expect(event.toolUseId).toBe("toolu_abc123");
  });

  it("omits toolUseId when tool_use_id is absent", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Read",
      tool_input: { file_path: "a.ts" },
    });
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    const event = JSON.parse(lines[0]);
    expect(event.toolUseId).toBeUndefined();
  });

  // AUD-02 (security MEDIUM, 2026-07-12 audit §3) — observe-pre must apply the
  // same scrubSecrets() (redact + truncate) as observe-post before persisting
  // metadata.command to observations.jsonl.

  it("scrubs Anthropic API key from metadata.command before persisting", () => {
    const token = "sk-ant-api03-abcdefghij1234567890ABCDEFGHIJ";
    runHook({
      session_id: SESSION_ID,
      tool_name: "Bash",
      tool_input: { command: `curl -H "Authorization: Bearer ${token}"` },
    });
    const raw = fs.readFileSync(OBS_FILE, "utf8");
    expect(raw).not.toContain(token);
    const event = JSON.parse(raw.trim().split("\n")[0]);
    expect(event.metadata.command).toContain("[REDACTED]");
  });

  it("scrubs generic key=value credentials from metadata.command", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Bash",
      tool_input: { command: "export API_KEY=SuperSecretValue12345 && ./deploy.sh" },
    });
    const raw = fs.readFileSync(OBS_FILE, "utf8");
    expect(raw).not.toContain("SuperSecretValue12345");
    const event = JSON.parse(raw.trim().split("\n")[0]);
    expect(event.metadata.command).toContain("[REDACTED]");
  });

  it("truncates metadata.command to 200 chars (observe-post parity)", () => {
    runHook({
      session_id: SESSION_ID,
      tool_name: "Bash",
      tool_input: { command: "echo " + "x".repeat(300) },
    });
    const lines = fs.readFileSync(OBS_FILE, "utf8").trim().split("\n");
    const event = JSON.parse(lines[0]);
    expect(event.metadata.command.length).toBeLessThanOrEqual(200);
  });

  it("sets skillName to null when Skill tool is invoked with no skill arg", () => {
    const sid = "sess-phase1-red-c";
    const dir = path.join(os.tmpdir(), "kadmon", sid);
    const obsFile = path.join(dir, "observations.jsonl");
    try {
      runHook({
        session_id: sid,
        tool_name: "Skill",
        tool_input: {},
      });
      const lines = fs.readFileSync(obsFile, "utf8").trim().split("\n");
      const event = JSON.parse(lines[lines.length - 1]);
      expect(event.metadata.skillName).toBeNull();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
