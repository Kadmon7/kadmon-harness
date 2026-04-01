import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/pr-created.js");

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

describe("pr-created", () => {
  it("logs PR URL when gh pr create output contains a PR link", () => {
    const r = runHook({
      tool_input: { command: "gh pr create --title test" },
      tool_result:
        "Creating pull request...\nhttps://github.com/Kadmon7/kadmon-harness/pull/42\n",
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain(
      "https://github.com/Kadmon7/kadmon-harness/pull/42",
    );
    expect(r.stdout).toContain("gh pr view 42");
  });

  it("exits 0 with no output when gh pr create has no URL in result", () => {
    const r = runHook({
      tool_input: { command: "gh pr create --title test" },
      tool_result: "Error: no remote configured",
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("");
  });

  it("exits 0 when command is not gh pr create", () => {
    const r = runHook({
      tool_input: { command: "npm test" },
      tool_result: "https://github.com/owner/repo/pull/1",
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("");
  });

  it("exits 0 when tool_result is missing", () => {
    const r = runHook({
      tool_input: { command: "gh pr create --title test" },
    });
    expect(r.code).toBe(0);
  });

  it("falls back to response field", () => {
    const r = runHook({
      tool_input: { command: "gh pr create --title test" },
      response: "https://github.com/owner/repo/pull/99",
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("pull/99");
  });

  it("exits 0 on empty input", () => {
    const r = runHook({});
    expect(r.code).toBe(0);
  });
});
