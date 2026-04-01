import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/post-edit-format.js");

function runHook(
  input: object,
  env?: Record<string, string>,
): { code: number; stdout: string } {
  try {
    const stdout = execFileSync("node", [HOOK], {
      encoding: "utf8",
      input: JSON.stringify(input),
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
    return { code: 0, stdout };
  } catch (err: unknown) {
    const e = err as { status: number; stdout: string };
    return { code: e.status ?? 1, stdout: e.stdout ?? "" };
  }
}

describe("post-edit-format", () => {
  it("exits 0 when file_path is empty", () => {
    const r = runHook({ tool_input: { file_path: "" } });
    expect(r.code).toBe(0);
  });

  it("exits 0 for non-ts/js/json files", () => {
    const r = runHook({ tool_input: { file_path: "/project/README.md" } });
    expect(r.code).toBe(0);
  });

  it("exits 0 for node_modules paths", () => {
    const r = runHook({
      tool_input: { file_path: "/project/node_modules/lib/index.ts" },
    });
    expect(r.code).toBe(0);
  });

  it("exits 0 for dist paths", () => {
    const r = runHook({
      tool_input: { file_path: "/project/dist/index.js" },
    });
    expect(r.code).toBe(0);
  });

  it("exits 0 for non-existent file", () => {
    const r = runHook({
      tool_input: {
        file_path: "/nonexistent/path/file.ts",
      },
    });
    expect(r.code).toBe(0);
  });

  it("exits 0 for existing .ts file (prettier runs or fails silently)", () => {
    // Use a real file in the project that exists
    const r = runHook({
      tool_input: {
        file_path: path.resolve("vitest.config.ts"),
      },
    });
    expect(r.code).toBe(0);
  });

  it("skips when hook is disabled via env var", () => {
    const r = runHook(
      {
        tool_input: {
          file_path: path.resolve("vitest.config.ts"),
        },
      },
      { KADMON_DISABLED_HOOKS: "post-edit-format" },
    );
    expect(r.code).toBe(0);
  });

  it("exits 0 on empty input", () => {
    const r = runHook({});
    expect(r.code).toBe(0);
  });
});
