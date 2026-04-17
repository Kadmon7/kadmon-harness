import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/pr-created.js");

function runHook(input: object): {
  code: number;
  stdout: string;
  stderr: string;
} {
  const r = spawnSync("node", [HOOK], {
    encoding: "utf8",
    input: JSON.stringify(input),
  });
  return { code: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

describe("pr-created", () => {
  it("logs PR URL to stderr when gh pr create output contains a PR link", () => {
    const r = runHook({
      tool_input: { command: "gh pr create --title test" },
      tool_response: {
        stdout:
          "Creating pull request...\nhttps://github.com/Kadmon7/kadmon-harness/pull/42\n",
      },
    });
    expect(r.code).toBe(0);
    expect(r.stderr).toContain(
      "https://github.com/Kadmon7/kadmon-harness/pull/42",
    );
    expect(r.stderr).toContain("gh pr view 42");
  });

  it("exits 0 silently when gh pr create output has no URL", () => {
    const r = runHook({
      tool_input: { command: "gh pr create --title test" },
      tool_response: { stdout: "Error: no remote configured" },
    });
    expect(r.code).toBe(0);
    expect(r.stderr).toBe("");
  });

  it("exits 0 when command is not gh pr create", () => {
    const r = runHook({
      tool_input: { command: "npm test" },
      tool_response: { stdout: "https://github.com/owner/repo/pull/1" },
    });
    expect(r.code).toBe(0);
    expect(r.stderr).toBe("");
  });

  it("exits 0 when tool_response is missing", () => {
    const r = runHook({
      tool_input: { command: "gh pr create --title test" },
    });
    expect(r.code).toBe(0);
  });

  it("exits 0 when tool_response.stdout is missing", () => {
    const r = runHook({
      tool_input: { command: "gh pr create --title test" },
      tool_response: { exit_code: 0 },
    });
    expect(r.code).toBe(0);
  });

  it("exits 0 on empty input", () => {
    const r = runHook({});
    expect(r.code).toBe(0);
  });
});
