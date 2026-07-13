import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/post-edit-format.js");

// Dynamic import via a runtime path expression — see resolve-bin.test.ts for
// why (avoids tsc trying to resolve declarations for a module outside
// tsconfig's `include`).
const { resolveBin } = (await import(
  path.resolve(".claude/hooks/scripts/resolve-bin.js")
)) as {
  resolveBin: (toolName: string, startDir?: string) => string | null;
};

function runHook(
  input: object,
  opts?: { env?: Record<string, string>; cwd?: string },
): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync("node", [HOOK], {
      encoding: "utf8",
      input: JSON.stringify(input),
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...opts?.env },
      cwd: opts?.cwd,
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err: unknown) {
    const e = err as { status: number; stdout: string; stderr: string };
    return { code: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
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
      { env: { KADMON_DISABLED_HOOKS: "post-edit-format" } },
    );
    expect(r.code).toBe(0);
  });

  it("exits 0 on empty input", () => {
    const r = runHook({});
    expect(r.code).toBe(0);
  });

  // ─── AUD-31: direct-bin invocation + real "toolchain absent" fallback ──────

  it("falls back to npx when prettier is not resolved locally, and still exits 0", () => {
    // This repo does not depend on `prettier` (not in package.json) — a
    // genuine, real-world "toolchain absent" case, not a synthetic one.
    // Confirm the precondition holds so this test stays meaningful if a
    // future change adds prettier as a devDependency.
    expect(resolveBin("prettier", path.resolve("."))).toBeNull();
    const r = runHook({
      tool_input: { file_path: path.resolve("vitest.config.ts") },
    });
    expect(r.code).toBe(0);
  });

  // ─── AUD-36: path.resolve parity (flag-injection hardening) ────────────────

  it("resolves a dash-prefixed relative path before passing it to the resolved prettier binary (AUD-36)", () => {
    // post-edit-format.js has no exports to unit-test runPrettier directly,
    // and this repo has no real local prettier install (see the npx-fallback
    // test above) to observe real CLI arg-parsing behavior against. Build a
    // throwaway local "prettier" package whose bin entry just records the
    // argv it received to a marker file, and point resolveBin() at it via
    // cwd — this proves the EXACT string handed to the tool without a real
    // prettier dependency or any production-code changes.
    const tmpRoot = fs.mkdtempSync(
      path.join(process.cwd(), "tests", "aud36-fmt-"),
    );
    try {
      const pkgDir = path.join(tmpRoot, "node_modules", "prettier");
      fs.mkdirSync(pkgDir, { recursive: true });
      const capturedArgsPath = path.join(tmpRoot, "captured-args.json");
      fs.writeFileSync(
        path.join(pkgDir, "package.json"),
        JSON.stringify({
          name: "prettier",
          bin: { prettier: "./stub-prettier.cjs" },
        }),
      );
      fs.writeFileSync(
        path.join(pkgDir, "stub-prettier.cjs"),
        [
          'const fs = require("node:fs");',
          `fs.writeFileSync(${JSON.stringify(capturedArgsPath)}, JSON.stringify(process.argv.slice(2)));`,
          "process.exit(0);",
        ].join("\n"),
      );

      // Precondition: the stub now resolves where the real prettier didn't.
      expect(resolveBin("prettier", tmpRoot)).not.toBeNull();

      const fileName = "-dangerous.ts";
      fs.writeFileSync(path.join(tmpRoot, fileName), "export const x = 1;\n");

      const r = runHook(
        { tool_input: { file_path: fileName } },
        { cwd: tmpRoot },
      );
      expect(r.code).toBe(0);

      const capturedArgs = JSON.parse(
        fs.readFileSync(capturedArgsPath, "utf8"),
      ) as string[];
      // ["--write", "<resolved absolute path>"]
      expect(capturedArgs[0]).toBe("--write");
      const passedFp = capturedArgs[1];
      expect(path.isAbsolute(passedFp)).toBe(true);
      expect(passedFp.startsWith("-")).toBe(false);
      expect(passedFp).toBe(path.join(tmpRoot, fileName));
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
