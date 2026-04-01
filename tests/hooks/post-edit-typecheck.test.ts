import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/post-edit-typecheck.js");

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

describe("post-edit-typecheck", () => {
  it("exits 0 when file_path is empty", () => {
    const r = runHook({ tool_input: { file_path: "" } });
    expect(r.code).toBe(0);
  });

  it("exits 0 for non-.ts extensions", () => {
    const r = runHook({ tool_input: { file_path: "/project/src/index.js" } });
    expect(r.code).toBe(0);
  });

  it("exits 0 for .json files", () => {
    const r = runHook({
      tool_input: { file_path: "/project/package.json" },
    });
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
      tool_input: { file_path: "/project/dist/scripts/lib/store.ts" },
    });
    expect(r.code).toBe(0);
  });

  it("exits 0 for valid .ts file (tsc runs)", () => {
    const r = runHook({
      tool_input: { file_path: path.resolve("scripts/dashboard.ts") },
    });
    // Always exits 0 — tsc errors are informational only
    expect(r.code).toBe(0);
  });

  it("exits 0 on empty input", () => {
    const r = runHook({});
    expect(r.code).toBe(0);
  });
});
