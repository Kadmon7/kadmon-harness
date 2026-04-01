import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/config-protection.js");

function runHook(input: object): {
  code: number;
  stdout: string;
  stderr: string;
} {
  try {
    const stdout = execFileSync("node", [HOOK], {
      encoding: "utf8",
      input: JSON.stringify(input),
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err: unknown) {
    const e = err as { status: number; stdout: string; stderr: string };
    return {
      code: e.status ?? 1,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
    };
  }
}

describe("config-protection", () => {
  it("blocks editing tsconfig.json with strict: false", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/tsconfig.json",
        new_string: '{ "compilerOptions": { "strict": false } }',
      },
    });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Disabling strict mode");
  });

  it("blocks editing tsconfig.json with noImplicitAny: false", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/tsconfig.json",
        new_string: '{ "compilerOptions": { "noImplicitAny": false } }',
      },
    });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Disabling noImplicitAny");
  });

  it("blocks editing .eslintrc with rule set to off", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/.eslintrc.json",
        new_string: '{ "rules": { "no-unused-vars": "off" } }',
      },
    });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Disabling lint rules");
  });

  it("blocks editing eslint.config.js with rule set to 0", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/eslint.config.js",
        content: '{ "rules": { "no-unused-vars": 0 } }',
      },
    });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Disabling lint rules");
  });

  it("allows tsconfig.json with safe content", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/tsconfig.json",
        new_string: '{ "compilerOptions": { "strict": true } }',
      },
    });
    expect(r.code).toBe(0);
  });

  it("allows non-protected files", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/src/index.ts",
        new_string: '{ "strict": false }',
      },
    });
    expect(r.code).toBe(0);
  });

  it("warns about skipLibCheck: true in protected file", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/tsconfig.json",
        new_string: '{ "compilerOptions": { "skipLibCheck": true } }',
      },
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("skipLibCheck");
  });

  it("protects vitest.config files", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/vitest.config.ts",
        new_string: '{ "rules": { "semi": "off" } }',
      },
    });
    expect(r.code).toBe(2);
  });

  it("protects biome.json", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/biome.json",
        new_string: '{ "linter": { "enabled": "off" } }',
      },
    });
    expect(r.code).toBe(2);
  });

  it("exits 0 on empty input", () => {
    const r = runHook({});
    expect(r.code).toBe(0);
  });
});
