import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/post-edit-typecheck.js");

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

  // ─── Python branching (plan-020 Phase B) ───────────────────────────────────

  it("runs a Python typecheck path for .py files (does not silently exit 0)", () => {
    // .py edit must trigger the Python branch: mypy → pyright → py_compile fallback.
    // When no Python tool is installed, the hook logs a warning to stderr and exits 0.
    // In any environment we expect either tool-output OR the fallback warning — never a silent pass.
    const r = runHook({
      tool_input: { file_path: path.resolve("tests/fixtures/lang-py/example.py") },
    });
    expect(r.code).toBe(0);
    // Stderr must contain evidence of the Python branch executing.
    // Accept: mypy invocation, pyright output, py_compile output, OR the fallback warning.
    expect(r.stderr).toMatch(/python|mypy|pyright|py_compile/i);
  });

  it("skips .py files under node_modules or dist", () => {
    const r = runHook({
      tool_input: { file_path: "/project/node_modules/pkg/lib.py" },
    });
    expect(r.code).toBe(0);
    // Must NOT invoke Python tools on dep paths
    expect(r.stderr).not.toMatch(/mypy|pyright|py_compile/i);
  });
});
