import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/console-log-warn.js");

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

describe("console-log-warn", () => {
  it("warns when new_string contains console.log()", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/src/utils.ts",
        new_string: 'console.log("debug value");',
      },
    });
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("console.log");
  });

  it("warns when content contains console.log()", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/src/index.js",
        content: "const x = 1;\nconsole.log(x);\nexport default x;",
      },
    });
    expect(r.code).toBe(1);
  });

  it("allows test files", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/tests/utils.test.ts",
        new_string: 'console.log("test debug");',
      },
    });
    expect(r.code).toBe(0);
  });

  it("allows hook scripts", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/.claude/hooks/scripts/my-hook.js",
        new_string: 'console.log("hook output");',
      },
    });
    expect(r.code).toBe(0);
  });

  it("allows dist files", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/dist/index.js",
        new_string: 'console.log("compiled");',
      },
    });
    expect(r.code).toBe(0);
  });

  it("allows node_modules", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/node_modules/lib/index.js",
        new_string: 'console.log("dep");',
      },
    });
    expect(r.code).toBe(0);
  });

  it("allows code without console.log", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/src/clean.ts",
        new_string:
          "export function add(a: number, b: number) { return a + b; }",
      },
    });
    expect(r.code).toBe(0);
  });

  it("allows non-ts/js files", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/README.md",
        new_string: "Use console.log() to debug",
      },
    });
    expect(r.code).toBe(0);
  });

  it("exits 0 on empty input", () => {
    const r = runHook({});
    expect(r.code).toBe(0);
  });

  it("skips when hook is disabled via env var", () => {
    try {
      const stdout = execFileSync("node", [HOOK], {
        encoding: "utf8",
        input: JSON.stringify({
          tool_input: {
            file_path: "/project/src/utils.ts",
            new_string: 'console.log("should be skipped");',
          },
        }),
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, KADMON_DISABLED_HOOKS: "console-log-warn" },
      });
      expect(true).toBe(true); // exit 0
    } catch (err: unknown) {
      const e = err as { status: number };
      expect(e.status).toBe(0); // should NOT warn when disabled
    }
  });
});
