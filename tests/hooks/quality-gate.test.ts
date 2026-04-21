import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/quality-gate.js");

function runHook(input: object): { code: number; stdout: string; stderr: string } {
  const r = spawnSync("node", [HOOK], {
    encoding: "utf8",
    input: JSON.stringify(input),
  });
  return {
    code: r.status ?? 1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

describe("quality-gate", () => {
  it("exits 0 when file_path is empty", () => {
    const r = runHook({ tool_input: { file_path: "" } });
    expect(r.code).toBe(0);
  });

  it("exits 0 for non-ts/js extensions", () => {
    const r = runHook({
      tool_input: { file_path: "/project/data.json" },
    });
    expect(r.code).toBe(0);
  });

  it("exits 0 for markdown files", () => {
    const r = runHook({
      tool_input: { file_path: "/project/README.md" },
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
      tool_input: { file_path: "/project/dist/index.js" },
    });
    expect(r.code).toBe(0);
  });

  it("exits 0 for .claude paths", () => {
    const r = runHook({
      tool_input: { file_path: "/project/.claude/hooks/scripts/hook.js" },
    });
    expect(r.code).toBe(0);
  });

  it("exits 0 for .ts file (eslint runs or fails silently)", () => {
    const r = runHook({
      tool_input: { file_path: path.resolve("scripts/dashboard.ts") },
    });
    expect(r.code).toBe(0);
  });

  it("exits 0 on empty input", () => {
    const r = runHook({});
    expect(r.code).toBe(0);
  });

  // ─── Python branching (plan-020 Phase B) ───────────────────────────────────

  it("runs a Python linter path for .py files (does not silently exit 0)", () => {
    const r = runHook({
      tool_input: { file_path: path.resolve("tests/fixtures/lang-py/example.py") },
    });
    expect(r.code).toBe(0);
    // Stderr must contain evidence of the Python branch executing (ruff, or missing-tool warning).
    expect(r.stderr).toMatch(/ruff|python/i);
  });

  it("exits 0 for .py under node_modules without invoking ruff", () => {
    const r = runHook({
      tool_input: { file_path: "/project/node_modules/pkg/lib.py" },
    });
    expect(r.code).toBe(0);
    expect(r.stderr).not.toMatch(/ruff/i);
  });
});
