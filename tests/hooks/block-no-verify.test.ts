import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/block-no-verify.js");

function runHook(
  input: object,
  env?: Record<string, string>,
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync("node", [HOOK], {
      encoding: "utf8",
      input: JSON.stringify(input),
      stdio: ["pipe", "pipe", "pipe"],
      ...(env ? { env: { ...process.env, ...env } } : {}),
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout: string; stderr: string; status: number };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      exitCode: e.status ?? 1,
    };
  }
}

describe("block-no-verify", () => {
  it("blocks --no-verify", () => {
    const r = runHook({
      session_id: "t",
      tool_name: "Bash",
      tool_input: { command: "git commit --no-verify" },
    });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toContain("--no-verify");
  });

  it("blocks --no-gpg-sign", () => {
    const r = runHook({
      session_id: "t",
      tool_name: "Bash",
      tool_input: { command: "git push --no-gpg-sign" },
    });
    expect(r.exitCode).toBe(2);
  });

  it("allows normal git commands", () => {
    const r = runHook({
      session_id: "t",
      tool_name: "Bash",
      tool_input: { command: 'git commit -m "test"' },
    });
    expect(r.exitCode).toBe(0);
  });

  it("allows non-git commands", () => {
    const r = runHook({
      session_id: "t",
      tool_name: "Bash",
      tool_input: { command: "npm test" },
    });
    expect(r.exitCode).toBe(0);
  });

  it("cannot be disabled via KADMON_DISABLED_HOOKS (security-critical)", () => {
    const r = runHook(
      {
        session_id: "t",
        tool_name: "Bash",
        tool_input: { command: "git commit --no-verify" },
      },
      { KADMON_DISABLED_HOOKS: "block-no-verify" },
    );
    expect(r.exitCode).toBe(2); // Still blocks — NEVER_DISABLE protects this hook
  });
});
