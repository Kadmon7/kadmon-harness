import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/post-edit-typecheck.js");
const REPO_ROOT = path.resolve(".");
// Colocated with the hook scripts (NOT under top-level scripts/ or tests/),
// so a fixture dir created here is never swept up by the repo's own
// tsconfig.json `include: ["scripts/**/*.ts", "tests/**/*.ts"]` — the
// isolated fixture below intentionally contains a real type error and must
// never leak into `npm run build` / the repo-wide typecheck.
const HOOKS_SCRIPTS_DIR = path.resolve(".claude/hooks/scripts");

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

/** Creates an isolated TS project (own tsconfig.json) so tsc's project-level
 * scan is scoped to exactly one fixture file, without touching the repo's
 * own tsconfig.json include/exclude. */
function makeIsolatedTsProject(tsContent: string): string {
  const dir = fs.mkdtempSync(path.join(HOOKS_SCRIPTS_DIR, ".tmp-ts-fixture-"));
  fs.writeFileSync(
    path.join(dir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { strict: true, skipLibCheck: true, noEmit: true },
      include: ["*.ts"],
    }),
  );
  fs.writeFileSync(path.join(dir, "fixture.ts"), tsContent);
  return dir;
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

  // ─── AUD-31: direct-bin invocation + incremental cache ─────────────────────

  describe("direct-bin invocation (AUD-31)", () => {
    const fixtureDirs: string[] = [];

    afterEach(() => {
      for (const dir of fixtureDirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it("surfaces a real TypeScript error via the direct-bin path (exit stays 0)", () => {
      const dir = makeIsolatedTsProject('const x: number = "not a number";\nexport default x;\n');
      fixtureDirs.push(dir);
      const r = runHook(
        { tool_input: { file_path: path.join(dir, "fixture.ts") } },
        { cwd: dir, timeout: 20000 },
      );
      // Exit code contract is unchanged by the optimization — always 0.
      expect(r.code).toBe(0);
      // But the underlying tsc invocation must still have actually run and
      // reported the diagnostic — proves the direct-bin path (not a silent
      // no-op) is wired up correctly.
      expect(r.stderr).toMatch(/TypeScript errors/);
      expect(r.stderr).toMatch(/not assignable/);
    });

    it("reports no TypeScript-errors banner for a clean isolated fixture", () => {
      const dir = makeIsolatedTsProject("export const ok: number = 1;\n");
      fixtureDirs.push(dir);
      const r = runHook(
        { tool_input: { file_path: path.join(dir, "fixture.ts") } },
        { cwd: dir, timeout: 20000 },
      );
      expect(r.code).toBe(0);
      expect(r.stderr).not.toMatch(/TypeScript errors/);
    });

    it("writes an incremental tsbuildinfo cache beside the resolved local tsc install", () => {
      const cacheFile = path.join(
        REPO_ROOT,
        "node_modules",
        ".cache",
        "kadmon-post-edit-typecheck.tsbuildinfo",
      );
      fs.rmSync(cacheFile, { force: true });
      const r = runHook({
        tool_input: { file_path: path.resolve("scripts/dashboard.ts") },
      });
      expect(r.code).toBe(0);
      expect(fs.existsSync(cacheFile)).toBe(true);
    });

    it("still exits 0 when invoked from a cwd with no resolvable local tsc install (npx fallback preserved)", () => {
      const isolated = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-notsc-"));
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
});
