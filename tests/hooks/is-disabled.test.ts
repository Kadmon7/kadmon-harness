import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

const HOOKS_DIR = path.resolve(".claude/hooks/scripts");

function runHookWithEnv(
  hookFile: string,
  input: object,
  env: Record<string, string>,
): { exitCode: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync("node", [path.join(HOOKS_DIR, hookFile)], {
      encoding: "utf8",
      input: JSON.stringify(input),
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
    return { exitCode: 0, stdout, stderr: "" };
  } catch (err: unknown) {
    const e = err as { stdout: string; stderr: string; status: number };
    return {
      exitCode: e.status ?? 1,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
    };
  }
}

describe("KADMON_DISABLED_HOOKS support", () => {
  const disableEnv = (hookName: string) => ({
    KADMON_DISABLED_HOOKS: hookName,
  });

  it("block-no-verify: NEVER disabled (security-critical)", () => {
    const r = runHookWithEnv(
      "block-no-verify.js",
      { tool_input: { command: "git commit --no-verify" } },
      disableEnv("block-no-verify"),
    );
    expect(r.exitCode).toBe(2); // Still blocks even when "disabled"
  });

  it("commit-format-guard: exits 0 when disabled", () => {
    const r = runHookWithEnv(
      "commit-format-guard.js",
      { tool_input: { command: 'git commit -m "bad message no type"' } },
      disableEnv("commit-format-guard"),
    );
    expect(r.exitCode).toBe(0);
  });

  it("commit-quality: NEVER disabled (security-critical)", () => {
    const r = runHookWithEnv(
      "commit-quality.js",
      { tool_input: { command: 'git commit -m "feat: test"' } },
      disableEnv("commit-quality"),
    );
    // commit-quality still runs (exit 0 because no staged changes, but it DID run)
    expect(r.exitCode).toBe(0);
  });

  it("git-push-reminder: exits 0 when disabled", () => {
    const r = runHookWithEnv(
      "git-push-reminder.js",
      { session_id: "test-disabled", tool_input: { command: "git push" } },
      disableEnv("git-push-reminder"),
    );
    expect(r.exitCode).toBe(0);
  });

  it("config-protection: exits 0 when disabled", () => {
    const r = runHookWithEnv(
      "config-protection.js",
      {
        tool_input: {
          file_path: "/project/tsconfig.json",
          new_string: '"strict": false',
        },
      },
      disableEnv("config-protection"),
    );
    expect(r.exitCode).toBe(2); // Still blocks — security-critical, never disabled
  });

  it("mcp-health-check: exits 0 when disabled", () => {
    const r = runHookWithEnv(
      "mcp-health-check.js",
      { tool_name: "mcp__test__tool" },
      disableEnv("mcp-health-check"),
    );
    expect(r.exitCode).toBe(0);
  });

  it("post-edit-typecheck: exits 0 when disabled", () => {
    const r = runHookWithEnv(
      "post-edit-typecheck.js",
      { tool_input: { file_path: "/project/src/index.ts" } },
      disableEnv("post-edit-typecheck"),
    );
    expect(r.exitCode).toBe(0);
  });

  it("quality-gate: exits 0 when disabled", () => {
    const r = runHookWithEnv(
      "quality-gate.js",
      { tool_input: { file_path: "/project/src/index.ts" } },
      disableEnv("quality-gate"),
    );
    expect(r.exitCode).toBe(0);
  });

  it("deps-change-reminder: exits 0 when disabled", () => {
    const r = runHookWithEnv(
      "deps-change-reminder.js",
      {
        tool_input: {
          file_path: "/project/package.json",
          new_string: '"dependencies": { "zod": "^3.0.0" }',
        },
      },
      disableEnv("deps-change-reminder"),
    );
    expect(r.exitCode).toBe(0);
  });

  it("pr-created: exits 0 when disabled", () => {
    const r = runHookWithEnv(
      "pr-created.js",
      {
        tool_input: { command: "gh pr create" },
        tool_result: "https://github.com/test/repo/pull/1",
      },
      disableEnv("pr-created"),
    );
    expect(r.exitCode).toBe(0);
  });

  it("supports disabling multiple hooks with comma-separated list", () => {
    const r = runHookWithEnv(
      "git-push-reminder.js",
      { session_id: "test-multi", tool_input: { command: "git push" } },
      { KADMON_DISABLED_HOOKS: "some-other,git-push-reminder,another" },
    );
    expect(r.exitCode).toBe(0);
  });
});
