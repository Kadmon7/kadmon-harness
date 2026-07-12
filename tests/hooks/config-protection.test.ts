import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/config-protection.js");

function runHook(input: object): {
  code: number;
  stdout: string;
  stderr: string;
} {
  const r = spawnSync("node", [HOOK], {
    encoding: "utf8",
    input: JSON.stringify(input),
  });
  return {
    code: r.status ?? 0,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
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
    expect(r.stderr).toContain("skipLibCheck");
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

  it("allows maxWarnings: 0 in eslint.config.js (benign key, not a lint rule)", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/eslint.config.js",
        content: '{ "maxWarnings": 0 }',
      },
    });
    expect(r.code).toBe(0);
  });

  it("allows retries: 0 in vitest.config.ts (benign key, not a lint rule)", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/vitest.config.ts",
        new_string: '{ "test": { "retry": 0 } }',
      },
    });
    expect(r.code).toBe(0);
  });

  it("still blocks a real rule disabled via 0 nested under a different rules block key", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/.eslintrc.json",
        new_string: '{ "rules": { "no-console": 0 } }',
      },
    });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Disabling lint rules");
  });

  it("blocks a disabled rule in ESLint v9 flat config (unquoted rules key)", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/eslint.config.js",
        content: 'export default [{ rules: { "no-eval": "off" } }];',
      },
    });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Disabling lint rules");
  });

  it("blocks a disabled rule that appears after an object-valued rule in the same block (nested-brace bypass)", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/.eslintrc.json",
        new_string:
          '{ "rules": { "no-restricted-syntax": ["error", { "selector": "ForInStatement" }], "eqeqeq": "off" } }',
      },
    });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Disabling lint rules");
  });

  it("blocks a disabled rule in a SECOND rules block within an eslint.config.js array (multi-block bypass)", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/eslint.config.js",
        content:
          'export default [{ rules: { "no-console": "error" } }, { rules: { "no-eval": "off" } }];',
      },
    });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Disabling lint rules");
  });

  it("blocks a disabled rule in a SECOND rules block nested under .eslintrc.json overrides (multi-block bypass)", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/.eslintrc.json",
        new_string:
          '{ "rules": { "no-console": "error" }, "overrides": [{ "files": ["*.ts"], "rules": { "no-eval": "off" } }] }',
      },
    });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Disabling lint rules");
  });

  it("blocks a disabled rule that appears after a string value containing a literal } (string-literal bypass)", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/.eslintrc.json",
        new_string:
          '{ "rules": { "desc": "premature } inside string", "no-eval": "off" } }',
      },
    });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Disabling lint rules");
  });

  it("allows a rules block where a string value contains a literal } but no rule is actually disabled (no false positive)", () => {
    const r = runHook({
      tool_input: {
        file_path: "/project/.eslintrc.json",
        new_string:
          '{ "rules": { "desc": "text with } brace", "no-eval": "error" } }',
      },
    });
    expect(r.code).toBe(0);
  });

  it("fails closed (exit 2) when stdin is malformed JSON", () => {
    const r = spawnSync("node", [HOOK], {
      encoding: "utf8",
      input: "{not valid json!!",
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("error");
  });

  it("blocks when stdin is truncated (overflow attack vector)", () => {
    const r = runHook({
      _truncated: true,
      tool_input: {
        file_path: "/project/tsconfig.json",
        new_string: '{ "compilerOptions": { "strict": true } }',
      },
    });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("truncated");
  });
});
