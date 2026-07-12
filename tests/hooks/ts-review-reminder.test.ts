import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/ts-review-reminder.js");
const SESSION_ID = `test-tsr-${Date.now()}`;
const OBS_DIR = path.join(os.tmpdir(), "kadmon", SESSION_ID);
const OBS_FILE = path.join(OBS_DIR, "observations.jsonl");

function writeObs(events: object[]): void {
  fs.mkdirSync(OBS_DIR, { recursive: true });
  fs.writeFileSync(
    OBS_FILE,
    events.map((e) => JSON.stringify(e)).join("\n") + "\n",
  );
}

function runHook(input: object): {
  code: number;
  stdout: string;
  stderr: string;
} {
  try {
    const stdout = execFileSync("node", [HOOK], {
      encoding: "utf8",
      input: JSON.stringify(input),
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err: unknown) {
    const e = err as { status: number; stdout: string; stderr: string };
    return {
      code: e.status ?? 1,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
    };
  }
}

describe("ts-review-reminder", () => {
  afterEach(() => {
    fs.rmSync(OBS_DIR, { recursive: true, force: true });
  });

  it("exits 0 for non-ts files", () => {
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { file_path: "README.md" },
    });
    expect(r.code).toBe(0);
  });

  it("exits 0 for .ts file with fewer than 10 edits", () => {
    writeObs([
      { toolName: "Edit", filePath: "a.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "b.ts", eventType: "tool_pre" },
    ]);
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { file_path: "c.ts" },
    });
    expect(r.code).toBe(0);
  });

  it("warns after 10+ .ts edits without review", () => {
    writeObs([
      { toolName: "Edit", filePath: "a.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "b.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "c.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "d.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "e.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "f.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "g.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "h.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "i.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "j.ts", eventType: "tool_pre" },
    ]);
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { file_path: "k.ts" },
    });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("review");
  });

  it("exits 0 after 10+ edits if kody was invoked", () => {
    writeObs([
      { toolName: "Edit", filePath: "a.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "b.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "c.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "d.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "e.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "f.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "g.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "h.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "i.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "j.ts", eventType: "tool_pre" },
      {
        toolName: "Agent",
        eventType: "tool_pre",
        metadata: { agentType: "kody" },
      },
    ]);
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { file_path: "k.ts" },
    });
    expect(r.code).toBe(0);
  });

  it("exits 0 after 10+ edits if typescript-reviewer was invoked", () => {
    writeObs([
      { toolName: "Edit", filePath: "a.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "b.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "c.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "d.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "e.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "f.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "g.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "h.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "i.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "j.ts", eventType: "tool_pre" },
      {
        toolName: "Agent",
        eventType: "tool_pre",
        metadata: { agentType: "typescript-reviewer" },
      },
    ]);
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { file_path: "k.ts" },
    });
    expect(r.code).toBe(0);
  });

  // ─── Python branching (plan-020 Phase B) ───────────────────────────────────

  it("warns after 10+ .py edits without review", () => {
    writeObs([
      { toolName: "Edit", filePath: "a.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "b.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "c.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "d.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "e.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "f.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "g.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "h.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "i.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "j.py", eventType: "tool_pre" },
    ]);
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { file_path: "k.py" },
    });
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/review/i);
  });

  it("warns on mixed .ts + .py edits totaling >=10", () => {
    writeObs([
      { toolName: "Edit", filePath: "a.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "b.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "c.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "d.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "e.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "f.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "g.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "h.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "i.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "j.py", eventType: "tool_pre" },
    ]);
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { file_path: "k.py" },
    });
    expect(r.code).toBe(1);
  });

  it("exits 0 after 10+ .py edits if python-reviewer was invoked", () => {
    writeObs([
      { toolName: "Edit", filePath: "a.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "b.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "c.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "d.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "e.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "f.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "g.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "h.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "i.py", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "j.py", eventType: "tool_pre" },
      {
        toolName: "Agent",
        eventType: "tool_pre",
        metadata: { agentType: "python-reviewer" },
      },
    ]);
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { file_path: "k.py" },
    });
    expect(r.code).toBe(0);
  });

  it("warning text uses language-agnostic 'code edits' wording", () => {
    writeObs([
      { toolName: "Edit", filePath: "a.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "b.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "c.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "d.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "e.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "f.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "g.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "h.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "i.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "j.ts", eventType: "tool_pre" },
    ]);
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { file_path: "k.ts" },
    });
    expect(r.code).toBe(1);
    // Wording should be agnostic — not hardcoded ".ts"
    expect(r.stderr).toMatch(/code edits/i);
  });

  // AUD-15 (2026-07-12 audit) — session_id from stdin must be validated
  // against /^[a-zA-Z0-9_-]+$/ before being used to build a filesystem path.
  // Regression test: plant a decoy observations.jsonl OUTSIDE the kadmon
  // sandbox at the location a "../" session_id resolves to, with 10+ .ts
  // edits and no reviewer entry. Pre-fix, this hook did
  // `path.join(os.tmpdir(), "kadmon", sid, "observations.jsonl")` with no
  // validation, so it would read the decoy and warn (exit 1). Post-fix, the
  // malformed session_id is rejected by safeSessionDir() before any escaped
  // path is touched, and the hook fails open (exit 0) — the same contract as
  // a missing session_id.
  it("does not read observations from a path outside the kadmon sandbox for a traversal session_id", () => {
    const escapedName = `evil-tsr-${Date.now()}`;
    const escapedDir = path.join(os.tmpdir(), escapedName);
    fs.mkdirSync(escapedDir, { recursive: true });
    const decoyEvents = Array.from({ length: 10 }, (_, i) => ({
      toolName: "Edit",
      filePath: `decoy${i}.ts`,
      eventType: "tool_pre",
    }));
    fs.writeFileSync(
      path.join(escapedDir, "observations.jsonl"),
      decoyEvents.map((e) => JSON.stringify(e)).join("\n") + "\n",
    );
    try {
      const r = runHook({
        session_id: `../${escapedName}`,
        tool_input: { file_path: "k.ts" },
      });
      // Fails open — same contract as a missing session_id — instead of
      // reading the decoy and warning about the 10+ unreviewed edits.
      expect(r.code).toBe(0);
    } finally {
      fs.rmSync(escapedDir, { recursive: true, force: true });
    }
  });
});
