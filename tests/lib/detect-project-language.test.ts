// TDD [feniks] — plan-020 Phase A Step 1 — RED phase
// Tests for scripts/lib/detect-project-language.ts
//
// RED/GREEN forecast:
//   ALL tests: RED today — scripts/lib/detect-project-language.ts does not exist.
//   Vitest will report "Cannot find module" at import time (expected RED state).
//   GREEN after Step 3 (implement scripts/lib/detect-project-language.ts).
//
// Exports under test:
//   detectProjectLanguage(cwd?)  → 'typescript' | 'python' | 'mixed' | 'unknown'
//   getToolchain(cwd?)           → Toolchain struct
//
// Detection rules (ADR-020):
//   - package.json only          → 'typescript'
//   - pyproject.toml only        → 'python'
//   - requirements.txt only      → 'python'
//   - package.json + py marker   → 'mixed'
//   - none                       → 'unknown'
//   - KADMON_PROJECT_LANGUAGE env → override (valid values only)
//   - invalid env value          → fall through to markers

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";

// NOTE: .js extension required per Node16 ESM convention.
// This import will fail with "Cannot find module" until Step 3 creates the file.
import {
  detectProjectLanguage,
  getToolchain,
  type ProjectLanguage,
  type Toolchain,
} from "../../scripts/lib/detect-project-language.js";

// ─── Fixture paths ────────────────────────────────────────────────────────────

const FIXTURES_DIR = path.resolve(
  fileURLToPath(import.meta.url),
  "../../fixtures"
);

const FIXTURE_TS = path.join(FIXTURES_DIR, "lang-ts");
const FIXTURE_PY = path.join(FIXTURES_DIR, "lang-py");
const FIXTURE_MIXED = path.join(FIXTURES_DIR, "lang-mixed");
const FIXTURE_UNKNOWN = path.join(FIXTURES_DIR, "lang-unknown");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cleanEnv(): void {
  delete process.env["KADMON_PROJECT_LANGUAGE"];
}

// ─── detectProjectLanguage ───────────────────────────────────────────────────

describe("detectProjectLanguage", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    cleanEnv();
    // Capture stderr writes to assert diagnostic lines without polluting test output
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    cleanEnv();
  });

  // ─── File-based detection ─────────────────────────────────────────────────

  it("returns 'typescript' for a directory with only package.json", () => {
    const result = detectProjectLanguage(FIXTURE_TS);
    expect(result).toBe("typescript");
  });

  it("returns 'python' for a directory with only pyproject.toml", () => {
    const result = detectProjectLanguage(FIXTURE_PY);
    expect(result).toBe("python");
  });

  it("returns 'mixed' for a directory with both package.json and pyproject.toml", () => {
    const result = detectProjectLanguage(FIXTURE_MIXED);
    expect(result).toBe("mixed");
  });

  it("returns 'unknown' for a directory with none of the markers", () => {
    const result = detectProjectLanguage(FIXTURE_UNKNOWN);
    expect(result).toBe("unknown");
  });

  // ─── Env var override ─────────────────────────────────────────────────────

  it("respects KADMON_PROJECT_LANGUAGE=python even on a TS fixture", () => {
    process.env["KADMON_PROJECT_LANGUAGE"] = "python";
    const result = detectProjectLanguage(FIXTURE_TS);
    expect(result).toBe("python");
  });

  it("respects KADMON_PROJECT_LANGUAGE=typescript even on a Python fixture", () => {
    process.env["KADMON_PROJECT_LANGUAGE"] = "typescript";
    const result = detectProjectLanguage(FIXTURE_PY);
    expect(result).toBe("typescript");
  });

  it("ignores invalid KADMON_PROJECT_LANGUAGE value and falls through to file markers", () => {
    process.env["KADMON_PROJECT_LANGUAGE"] = "rust"; // not a valid ProjectLanguage
    const result = detectProjectLanguage(FIXTURE_TS);
    // Falls back to marker detection: FIXTURE_TS has package.json only → 'typescript'
    expect(result).toBe("typescript");
  });

  it("ignores empty KADMON_PROJECT_LANGUAGE and falls through to file markers", () => {
    process.env["KADMON_PROJECT_LANGUAGE"] = "";
    const result = detectProjectLanguage(FIXTURE_PY);
    expect(result).toBe("python");
  });

  // ─── Stderr diagnostic ────────────────────────────────────────────────────

  it("writes a stderr diagnostic JSON line with source='markers' when detecting from files", () => {
    detectProjectLanguage(FIXTURE_TS);

    // At least one write call should carry the JSON diagnostic
    const calls = stderrSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    const diagnosticLine = calls.find((line: string) => {
      try {
        const parsed = JSON.parse(line.trim());
        return parsed.source === "markers";
      } catch {
        return false;
      }
    });

    expect(diagnosticLine).toBeDefined();
    if (!diagnosticLine) throw new Error("unreachable: assertion guarantees defined");
    const parsed = JSON.parse(diagnosticLine.trim());
    expect(parsed).toMatchObject({
      source: "markers",
      language: "typescript",
    });
    // markers array should be present (may list which files were found)
    expect(Array.isArray(parsed.markers)).toBe(true);
  });

  it("writes a stderr diagnostic JSON line with source='override' when env var is used", () => {
    process.env["KADMON_PROJECT_LANGUAGE"] = "python";
    detectProjectLanguage(FIXTURE_TS);

    const calls = stderrSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    const diagnosticLine = calls.find((line: string) => {
      try {
        const parsed = JSON.parse(line.trim());
        return parsed.source === "override";
      } catch {
        return false;
      }
    });

    expect(diagnosticLine).toBeDefined();
    if (!diagnosticLine) throw new Error("unreachable: assertion guarantees defined");
    const parsed = JSON.parse(diagnosticLine.trim());
    expect(parsed).toMatchObject({
      source: "override",
      language: "python",
    });
  });

  it("stderr diagnostic for 'python' fixture lists the detected py marker", () => {
    detectProjectLanguage(FIXTURE_PY);

    const calls = stderrSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    const diagnosticLine = calls.find((line: string) => {
      try {
        const parsed = JSON.parse(line.trim());
        return parsed.source === "markers" && parsed.language === "python";
      } catch {
        return false;
      }
    });

    expect(diagnosticLine).toBeDefined();
    if (!diagnosticLine) throw new Error("unreachable: assertion guarantees defined");
    const parsed = JSON.parse(diagnosticLine.trim());
    // Should mention pyproject.toml as a found marker
    expect(parsed.markers).toContain("pyproject.toml");
  });

  it("stderr diagnostic for 'unknown' fixture has empty markers array", () => {
    detectProjectLanguage(FIXTURE_UNKNOWN);

    const calls = stderrSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    const diagnosticLine = calls.find((line: string) => {
      try {
        const parsed = JSON.parse(line.trim());
        return parsed.source === "markers" && parsed.language === "unknown";
      } catch {
        return false;
      }
    });

    expect(diagnosticLine).toBeDefined();
    if (!diagnosticLine) throw new Error("unreachable: assertion guarantees defined");
    const parsed = JSON.parse(diagnosticLine.trim());
    expect(parsed.markers).toHaveLength(0);
  });
});

// ─── getToolchain ─────────────────────────────────────────────────────────────

describe("getToolchain", () => {
  beforeEach(() => {
    cleanEnv();
  });

  afterEach(() => {
    cleanEnv();
  });

  // ─── TypeScript toolchain ─────────────────────────────────────────────────

  it("returns TS toolchain for lang-ts fixture", () => {
    const tc = getToolchain(FIXTURE_TS);
    expect(tc.language).toBe("typescript");
    expect(tc.build).toBe("npm run build");
    expect(tc.typecheck).toBe("npx tsc --noEmit");
    expect(tc.test).toBe("npx vitest run");
    expect(tc.lint).toBe("npx eslint .");
    expect(tc.audit).toBe("npm audit");
    expect(tc.depsFile).toBe("package.json");
  });

  it("TS toolchain codeExtensions covers .ts/.tsx/.js/.jsx", () => {
    const tc = getToolchain(FIXTURE_TS);
    expect(tc.codeExtensions).toContain(".ts");
    expect(tc.codeExtensions).toContain(".tsx");
    expect(tc.codeExtensions).toContain(".js");
    expect(tc.codeExtensions).toContain(".jsx");
    expect(tc.codeExtensions).not.toContain(".py");
  });

  it("TS toolchain testFilePattern matches *.test.ts files", () => {
    const tc = getToolchain(FIXTURE_TS);
    expect(tc.testFilePattern.test("foo.test.ts")).toBe(true);
    expect(tc.testFilePattern.test("bar.spec.js")).toBe(true);
    expect(tc.testFilePattern.test("main.py")).toBe(false);
  });

  // ─── Python toolchain ─────────────────────────────────────────────────────

  it("returns Python toolchain for lang-py fixture", () => {
    const tc = getToolchain(FIXTURE_PY);
    expect(tc.language).toBe("python");
    expect(tc.build).toBeNull();
    expect(tc.typecheck).toBe("mypy .");
    expect(tc.test).toBe("pytest");
    expect(tc.lint).toBe("ruff check . && black --check .");
    expect(tc.audit).toBe("pip-audit");
    expect(tc.depsFile).toBe("pyproject.toml");
  });

  it("Python toolchain codeExtensions contains only .py", () => {
    const tc = getToolchain(FIXTURE_PY);
    expect(tc.codeExtensions).toContain(".py");
    expect(tc.codeExtensions).not.toContain(".ts");
    expect(tc.codeExtensions).not.toContain(".js");
  });

  it("Python toolchain testFilePattern matches test_*.py files", () => {
    const tc = getToolchain(FIXTURE_PY);
    expect(tc.testFilePattern.test("test_main.py")).toBe(true);
    expect(tc.testFilePattern.test("test_utils.py")).toBe(true);
    expect(tc.testFilePattern.test("main.test.ts")).toBe(false);
  });

  // ─── Mixed toolchain ─────────────────────────────────────────────────────

  it("returns TS toolchain strings but language='mixed' for lang-mixed fixture", () => {
    const tc = getToolchain(FIXTURE_MIXED);
    expect(tc.language).toBe("mixed");
    // Falls back to TS toolchain commands
    expect(tc.build).toBe("npm run build");
    expect(tc.typecheck).toBe("npx tsc --noEmit");
    expect(tc.test).toBe("npx vitest run");
    expect(tc.lint).toBe("npx eslint .");
    expect(tc.audit).toBe("npm audit");
    expect(tc.depsFile).toBe("package.json");
  });

  it("mixed toolchain codeExtensions is the TS set", () => {
    const tc = getToolchain(FIXTURE_MIXED);
    expect(tc.codeExtensions).toContain(".ts");
    expect(tc.codeExtensions).toContain(".js");
  });

  // ─── Unknown toolchain ────────────────────────────────────────────────────

  it("returns TS toolchain strings but language='unknown' for lang-unknown fixture", () => {
    const tc = getToolchain(FIXTURE_UNKNOWN);
    expect(tc.language).toBe("unknown");
    // Conservative default = TS toolchain
    expect(tc.build).toBe("npm run build");
    expect(tc.typecheck).toBe("npx tsc --noEmit");
    expect(tc.test).toBe("npx vitest run");
    expect(tc.lint).toBe("npx eslint .");
    expect(tc.audit).toBe("npm audit");
    expect(tc.depsFile).toBe("package.json");
  });

  // ─── Env var override on getToolchain ────────────────────────────────────

  it("KADMON_PROJECT_LANGUAGE=python overrides toolchain returned by getToolchain on TS fixture", () => {
    process.env["KADMON_PROJECT_LANGUAGE"] = "python";
    const tc = getToolchain(FIXTURE_TS);
    expect(tc.language).toBe("python");
    expect(tc.build).toBeNull();
    expect(tc.test).toBe("pytest");
  });

  // ─── Type correctness (no runtime assertions — confirms shape) ─────────────

  it("getToolchain return type satisfies the Toolchain interface", () => {
    const tc: Toolchain = getToolchain(FIXTURE_TS);
    // language is a ProjectLanguage
    const lang: ProjectLanguage = tc.language;
    expect(typeof lang).toBe("string");
    // codeExtensions is a readonly array of strings
    const exts: readonly string[] = tc.codeExtensions;
    expect(Array.isArray(exts)).toBe(true);
    // testFilePattern is a RegExp
    expect(tc.testFilePattern).toBeInstanceOf(RegExp);
  });
});
