import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/deps-change-reminder.js");

function runHook(input: object): { code: number; stderr: string } {
  try {
    execFileSync("node", [HOOK], {
      encoding: "utf8",
      input: JSON.stringify(input),
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { code: 0, stderr: "" };
  } catch (err: unknown) {
    const e = err as { status: number; stderr: string };
    return { code: e.status ?? 1, stderr: e.stderr ?? "" };
  }
}

describe("deps-change-reminder", () => {
  it("warns when file_path is package.json with dependency changes", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/package.json",
        new_string: '"dependencies": { "zod": "^3.0.0" }',
      },
    });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("package.json modified");
  });

  it("warns for nested package.json paths with dependency changes", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/packages/core/package.json",
        new_string: '"devDependencies": { "vitest": "^2.0.0" }',
      },
    });
    expect(r.code).toBe(1);
  });

  it("allows package.json edits that do not touch dependencies", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/package.json",
        new_string: '"scripts": { "build": "tsc" }',
      },
    });
    expect(r.code).toBe(0);
  });

  it("allows non-package.json files", () => {
    const r = runHook({
      tool_input: { file_path: "/project/src/index.ts" },
    });
    expect(r.code).toBe(0);
  });

  it("allows files with package.json in directory name", () => {
    const r = runHook({
      tool_input: { file_path: "/project/package.json.bak/config.ts" },
    });
    expect(r.code).toBe(0);
  });

  it("exits 0 when file_path is empty", () => {
    const r = runHook({ tool_input: { file_path: "" } });
    expect(r.code).toBe(0);
  });

  it("exits 0 on empty input", () => {
    const r = runHook({});
    expect(r.code).toBe(0);
  });
});
