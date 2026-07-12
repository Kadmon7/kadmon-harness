// TDD [mekanik/kurator wave] — /medik test-runner detection (audit item #4).
// Check #3 (Tests) hardcoded `npx vitest run` even for TS repos that actually
// use Jest. detectTestCommand() picks the right one-shot (non-watch) command
// from package.json signals instead of assuming Vitest unconditionally.
// Scope: TypeScript/JavaScript only — Python's `pytest` is resolved
// separately via detect-project-language.ts's Toolchain.test.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectTestCommand } from "../../../scripts/lib/medik-checks/test-runner-detect.js";

describe("detectTestCommand (#4 — jest vs vitest detection)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "medik-test-runner-detect-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function writePkg(pkg: Record<string, unknown>): void {
    writeFileSync(join(tmp, "package.json"), JSON.stringify(pkg), "utf8");
  }

  it("no package.json — defaults to vitest (harness convention)", () => {
    const result = detectTestCommand(tmp);
    expect(result.command).toBe("npx vitest run");
    expect(result.runner).toBe("vitest");
    expect(result.source).toMatch(/no package\.json/i);
  });

  it("jest in devDependencies, no vitest — picks jest", () => {
    writePkg({ devDependencies: { jest: "^29.0.0" } });
    const result = detectTestCommand(tmp);
    expect(result.command).toBe("npx jest");
    expect(result.runner).toBe("jest");
    expect(result.source).toMatch(/jest/i);
  });

  it("vitest in devDependencies, no jest — picks vitest", () => {
    writePkg({ devDependencies: { vitest: "^2.0.0" } });
    const result = detectTestCommand(tmp);
    expect(result.command).toBe("npx vitest run");
    expect(result.runner).toBe("vitest");
  });

  it("jest in dependencies (not devDependencies) is still detected", () => {
    writePkg({ dependencies: { jest: "^29.0.0" } });
    const result = detectTestCommand(tmp);
    expect(result.runner).toBe("jest");
  });

  it("scripts.test mentions jest — picks jest regardless of deps", () => {
    writePkg({ scripts: { test: "jest --ci" } });
    const result = detectTestCommand(tmp);
    expect(result.command).toBe("npx jest");
    expect(result.runner).toBe("jest");
    expect(result.source).toContain("jest --ci");
  });

  it("scripts.test mentions vitest — picks vitest regardless of deps", () => {
    writePkg({ scripts: { test: "vitest run --coverage" } });
    const result = detectTestCommand(tmp);
    expect(result.command).toBe("npx vitest run");
    expect(result.runner).toBe("vitest");
  });

  it("scripts.test signal wins over a conflicting dependency signal", () => {
    // Repo mid-migration: jest still listed as a dep, but the test script
    // already points at vitest — the script that actually runs wins.
    writePkg({
      devDependencies: { jest: "^29.0.0", vitest: "^2.0.0" },
      scripts: { test: "vitest run" },
    });
    const result = detectTestCommand(tmp);
    expect(result.runner).toBe("vitest");
  });

  it("no jest/vitest signal anywhere — defaults to vitest", () => {
    writePkg({ scripts: { test: "mocha" }, devDependencies: { mocha: "^10.0.0" } });
    const result = detectTestCommand(tmp);
    expect(result.command).toBe("npx vitest run");
    expect(result.runner).toBe("vitest");
    expect(result.source).toMatch(/default/i);
  });

  it("malformed package.json — falls back to default instead of throwing", () => {
    writeFileSync(join(tmp, "package.json"), "{ this is not valid json", "utf8");
    expect(() => detectTestCommand(tmp)).not.toThrow();
    const result = detectTestCommand(tmp);
    expect(result.runner).toBe("vitest");
  });

  it("both jest and vitest deps, no scripts.test signal — ambiguous, defaults to vitest", () => {
    writePkg({ devDependencies: { jest: "^29.0.0", vitest: "^2.0.0" } });
    const result = detectTestCommand(tmp);
    expect(result.runner).toBe("vitest");
  });
});
