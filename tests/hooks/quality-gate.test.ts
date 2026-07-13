import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/quality-gate.js");

function runHook(
  input: object,
  opts?: { cwd?: string; timeout?: number },
): { code: number; stdout: string; stderr: string } {
  const r = spawnSync("node", [HOOK], {
    encoding: "utf8",
    input: JSON.stringify(input),
    cwd: opts?.cwd,
    timeout: opts?.timeout,
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

  // ─── AUD-31: direct-bin invocation ──────────────────────────────────────────

  it("exits 0 for a real .ts file using the direct-bin eslint path (resolved from this repo's node_modules)", () => {
    // The point of this test is that it does not hang or crash: eslint's
    // real JS entry (node_modules/eslint/bin/eslint.js) is now invoked via
    // `node <entry>` instead of `npx eslint`, which on Windows previously
    // threw ENOENT for a bare `execFileSync("npx", ...)` call (npx.cmd
    // cannot be spawned without shell:true — see resolve-bin.js). Exit code
    // stays 0 either way (lint output is informational), so the exit-code
    // assertion alone would pass even if eslint silently never ran; the
    // resolveBin() unit tests (resolve-bin.test.ts) are what actually prove
    // the real local eslint entry is resolved and used.
    const r = runHook({
      tool_input: { file_path: path.resolve("scripts/dashboard.ts") },
    });
    expect(r.code).toBe(0);
  });

  it("still exits 0 when invoked from a cwd with no resolvable local eslint install (npx fallback preserved)", () => {
    const isolated = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-noeslint-"));
    try {
      const r = runHook(
        { tool_input: { file_path: path.join(isolated, "whatever.ts") } },
        { cwd: isolated, timeout: 20000 },
      );
      expect(r.code).toBe(0);
    } finally {
      fs.rmSync(isolated, { recursive: true, force: true });
    }
  });
});
