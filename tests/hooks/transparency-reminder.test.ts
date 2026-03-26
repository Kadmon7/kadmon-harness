import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/transparency-reminder.js");

function runHook(input: object): { code: number; stdout: string } {
  try {
    const stdout = execFileSync("node", [HOOK], {
      encoding: "utf8",
      input: JSON.stringify(input),
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { code: 0, stdout };
  } catch (err: unknown) {
    const e = err as { status: number; stdout: string };
    return { code: e.status ?? 1, stdout: e.stdout ?? "" };
  }
}

describe("transparency-reminder", () => {
  it("warns with agent info when Agent tool is invoked", () => {
    const r = runHook({
      tool_name: "Agent",
      tool_input: {
        subagent_type: "code-reviewer",
        description: "Review recent changes",
      },
    });
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("code-reviewer");
  });

  it("exits 0 for non-Agent tools", () => {
    const r = runHook({
      tool_name: "Read",
      tool_input: { file_path: "src/index.ts" },
    });
    expect(r.code).toBe(0);
  });

  it("warns even without subagent_type", () => {
    const r = runHook({
      tool_name: "Agent",
      tool_input: { description: "General task" },
    });
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("transparency");
  });

  it("exits 0 on empty input", () => {
    const r = runHook({});
    expect(r.code).toBe(0);
  });
});
