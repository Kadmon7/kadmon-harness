// TDD [feniks] — plan-010 Phase 6 Step 6.1 — RED phase
// Tests for .husky/pre-commit hook and .gitattributes cross-platform integrity.
//
// Step 6.2 (NOT this file): install husky, write .husky/pre-commit script.
// Step 6.3 (NOT this file): create .gitattributes.
//
// RED/GREEN forecast per test:
//   Tests 1-5: RED today (.husky/ does not exist). GREEN after Step 6.2.
//   Tests 6-9: RED today (.gitattributes does not exist). GREEN after Step 6.3.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ─── Paths ───────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(".");
const HUSKY_PRE_COMMIT = path.join(REPO_ROOT, ".husky", "pre-commit");
const GITATTRIBUTES = path.join(REPO_ROOT, ".gitattributes");

// ─── Helper ──────────────────────────────────────────────────────────────────

function readHookScript(): string {
  return fs.readFileSync(HUSKY_PRE_COMMIT, "utf8");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tests 1-5: .husky/pre-commit hook existence and structural invariants
// ═══════════════════════════════════════════════════════════════════════════════

describe(".husky/pre-commit hook — existence and structural invariants", () => {
  it(
    // Test 1 — RED today: .husky/pre-commit does not exist.
    // GREEN after Step 6.2: husky installed + pre-commit script written.
    "exists at repo root .husky/pre-commit",
    () => {
      // Assert: file must exist (ENOENT = RED signal today)
      expect(() => fs.accessSync(HUSKY_PRE_COMMIT, fs.constants.F_OK)).not.toThrow();
    },
  );

  it(
    // Test 2 — RED today: .husky/pre-commit does not exist.
    // GREEN after Step 6.2: file written with shebang + non-empty content.
    // Windows note: X_OK always returns true for files on win32, so we verify
    // shebang + non-empty content on all platforms, and additionally assert X_OK
    // on non-Windows where the executable bit actually matters.
    "is non-empty and has a bash shebang line",
    () => {
      const content = readHookScript();

      // Must be non-empty
      expect(content.trim().length).toBeGreaterThan(0);

      // Must have a valid shebang as the very first line
      const firstLine = content.split("\n")[0]!;
      expect(firstLine).toMatch(/^#!.*(bash|sh)/);
    },
  );

  it(
    // Test 2b — RED today: .husky/pre-commit does not exist.
    // GREEN after Step 6.2: file has executable bit (on Mac/Linux).
    // On Windows, X_OK is always true for files — this check is a no-op there,
    // but on Mac (Joe/Eden's machines) it matters for husky to invoke the script.
    "is executable (X_OK) — non-Windows assertion",
    () => {
      if (process.platform === "win32") {
        // X_OK is always true on Windows — verify file exists at minimum
        expect(() => fs.accessSync(HUSKY_PRE_COMMIT, fs.constants.F_OK)).not.toThrow();
        return;
      }
      expect(() => fs.accessSync(HUSKY_PRE_COMMIT, fs.constants.X_OK)).not.toThrow();
    },
  );

  it(
    // Test 3 — RED today: .husky/pre-commit does not exist.
    // GREEN after Step 6.2: script content contains `npm run build` and
    // a grep/test against `scripts/lib/.*\.ts$` (the staged-file detector).
    // We assert structural invariants (content inspection) instead of running
    // `git commit` — that would mutate working-tree state.
    "invokes npm run build when scripts/lib/**/*.ts files are staged",
    () => {
      const content = readHookScript();

      // Must invoke the build command
      expect(content).toContain("npm run build");

      // Must check staged files against the scripts/lib TS pattern
      // (grep -E or grep -e or a bash conditional on the path pattern)
      expect(content).toMatch(/scripts\/lib\/.*\\\.ts/);
    },
  );

  it(
    // Test 4 — RED today: .husky/pre-commit does not exist.
    // GREEN after Step 6.2: script content contains `git add dist/scripts/lib`
    // so the rebuilt JS is staged alongside the TS source changes.
    "stages dist/scripts/lib after successful build via git add",
    () => {
      const content = readHookScript();

      // Must re-stage the compiled output after build
      expect(content).toContain("git add dist/scripts/lib");
    },
  );

  it(
    // Test 5 — RED today: .husky/pre-commit does not exist.
    // GREEN after Step 6.2: script uses `set -euo pipefail` (bash strict mode)
    // so any tsc / npm run build failure propagates a non-zero exit code and
    // aborts the commit. This is the mechanism for "exits non-zero if tsc fails".
    "uses bash strict mode (set -euo pipefail) so tsc failures abort the commit",
    () => {
      const content = readHookScript();

      // set -euo pipefail is the conventional strict-mode prefix;
      // presence guarantees non-zero exit propagation on build failure.
      expect(content).toContain("set -euo pipefail");
    },
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Tests 6-9: .gitattributes line-ending enforcement
// ═══════════════════════════════════════════════════════════════════════════════

describe(".gitattributes — cross-platform line-ending enforcement", () => {
  it(
    // Test 6 — RED today: .gitattributes does not exist.
    // GREEN after Step 6.3: file created at repo root.
    "exists at repo root",
    () => {
      // Assert: file must exist (ENOENT = RED signal today)
      expect(() => fs.accessSync(GITATTRIBUTES, fs.constants.F_OK)).not.toThrow();
    },
  );

  it(
    // Test 7 — RED today: .gitattributes does not exist.
    // GREEN after Step 6.3: file contains `*.js text eol=lf`.
    "contains '*.js text eol=lf' rule for JavaScript files",
    () => {
      const content = fs.readFileSync(GITATTRIBUTES, "utf8");
      expect(content).toContain("*.js text eol=lf");
    },
  );

  it(
    // Test 8 — RED today: .gitattributes does not exist.
    // GREEN after Step 6.3: file contains `*.ts text eol=lf`.
    "contains '*.ts text eol=lf' rule for TypeScript files",
    () => {
      const content = fs.readFileSync(GITATTRIBUTES, "utf8");
      expect(content).toContain("*.ts text eol=lf");
    },
  );

  it(
    // Test 9 — RED today: .gitattributes does not exist.
    // GREEN after Step 6.3: file contains `*.sh text eol=lf`.
    // plan-010 explicitly enforces LF for shell scripts (cross-platform hook execution).
    "contains '*.sh text eol=lf' rule for shell scripts",
    () => {
      const content = fs.readFileSync(GITATTRIBUTES, "utf8");
      expect(content).toContain("*.sh text eol=lf");
    },
  );
});
