import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/quality-gate.js");

function runHook(
  input: object,
  opts?: { cwd?: string; timeout?: number; env?: Record<string, string> },
): { code: number; stdout: string; stderr: string } {
  const r = spawnSync("node", [HOOK], {
    encoding: "utf8",
    input: JSON.stringify(input),
    cwd: opts?.cwd,
    timeout: opts?.timeout,
    env: opts?.env ? { ...process.env, ...opts.env } : undefined,
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
    // AUD-38 item 3: the npx fallback previously relied on a REAL network
    // fetch attempt when eslint wasn't cached (up to ~20s offline before
    // npm's own resolution gives up). Force npm into offline mode so any
    // reachable npx invocation fails fast, locally, with no network wait —
    // this proves the same "still exits 0" contract without the flake/stall
    // risk. (On Windows this path already fails fast via ENOENT before ever
    // reaching npm — see resolve-bin.js header comment on the .cmd shim
    // footgun — so the offline env is a no-op safety net here and the real
    // payoff is on POSIX CI where npx IS directly executable.)
    const isolated = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-noeslint-"));
    try {
      const r = runHook(
        { tool_input: { file_path: path.join(isolated, "whatever.ts") } },
        {
          cwd: isolated,
          timeout: 8000,
          env: { npm_config_offline: "true" },
        },
      );
      expect(r.code).toBe(0);
    } finally {
      fs.rmSync(isolated, { recursive: true, force: true });
    }
  });

  // ─── AUD-35: ESLint 9 findings must actually surface ───────────────────────

  it("surfaces a real ESLint warning finding for a file with an unused var (AUD-35)", () => {
    const dir = fs.mkdtempSync(path.join(process.cwd(), "tests", "aud35-"));
    try {
      const violatingFile = path.join(dir, "unused.ts");
      fs.writeFileSync(
        violatingFile,
        "const unusedVar = 42;\nexport function foo(): number {\n  return 1;\n}\n",
      );
      const r = runHook({ tool_input: { file_path: violatingFile } });
      expect(r.code).toBe(0);
      // Old code (--no-eslintrc, ESLint-8-only flag) made the ESLint CLI
      // itself fail arg parsing before linting ever started, and only
      // forwarded stdout (never stderr, where that parse error landed) —
      // so no finding EVER surfaced. This proves the fix: a real warning
      // for a real violation now reaches the hook's own stderr.
      expect(r.stderr).toMatch(/unusedVar/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stays silent for a clean file with no lint findings (AUD-35)", () => {
    const dir = fs.mkdtempSync(path.join(process.cwd(), "tests", "aud35-"));
    try {
      const cleanFile = path.join(dir, "clean.ts");
      fs.writeFileSync(
        cleanFile,
        "export function foo(): number {\n  return 1;\n}\n",
      );
      const r = runHook({ tool_input: { file_path: cleanFile } });
      expect(r.code).toBe(0);
      expect(r.stderr).not.toMatch(/ESLint/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // ─── AUD-36: path.resolve parity (flag-injection hardening) ────────────────

  it("resolves a dash-prefixed relative path so ESLint doesn't misread it as a CLI flag (AUD-36)", () => {
    const dir = fs.mkdtempSync(path.join(process.cwd(), "tests", "aud36-"));
    try {
      const fileName = "-dangerous.ts";
      fs.writeFileSync(
        path.join(dir, fileName),
        "export function foo(): number {\n  return 1;\n}\n",
      );
      // Bare relative path starting with "-" — without path.resolve() this
      // is exactly the shape ESLint's CLI arg parser misreads as an unknown
      // flag ("Invalid option '-d'...", exit 2) instead of a filename.
      const r = runHook(
        { tool_input: { file_path: fileName } },
        { cwd: dir },
      );
      expect(r.code).toBe(0);
      expect(r.stderr).not.toMatch(/Invalid option/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // ─── AUD-39: --no-warn-ignored suppresses dormant ignore-pattern noise ─────

  it("does not surface ESLint's ignore-pattern warning for a root-level ignored .js file (AUD-39)", () => {
    // eslint.config.js's `ignores: ["*.js", "!eslint.config.js"]` matches
    // ONLY repo-root .js files (not subdirectories). Without
    // --no-warn-ignored, ESLint 9 prints "File ignored because of a
    // matching ignore pattern..." to stdout (exit 0) for this file, and the
    // hook forwards that as noise on an edit that had nothing to lint.
    const rootFile = path.resolve(`tmp-aud39-${process.pid}.js`);
    fs.writeFileSync(rootFile, "const x = 1;\n");
    try {
      const r = runHook({ tool_input: { file_path: rootFile } });
      expect(r.code).toBe(0);
      expect(r.stderr).not.toMatch(/File ignored|ignored because/i);
    } finally {
      fs.rmSync(rootFile, { force: true });
    }
  });
});
