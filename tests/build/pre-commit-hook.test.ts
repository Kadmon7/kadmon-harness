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
    // but on macOS it matters for husky to invoke the script.
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
    // Test 3 — originally RED pre-plan-010; widened 2026-07-19 (BACKLOG
    // "Pre-commit dist-restage gap"): the detector must cover ALL of
    // scripts/**/*.ts, not just scripts/lib/ — top-level scripts/*.ts
    // (dashboard.ts, dashboard-web.ts) fell outside the old filter AND the
    // old restage, so their dist output required a manual build+add.
    // We assert structural invariants (content inspection) instead of running
    // `git commit` — that would mutate working-tree state.
    "invokes npm run build when any scripts/**/*.ts file is staged",
    () => {
      const content = readHookScript();

      // Must invoke the build command
      expect(content).toContain("npm run build");

      // Must check staged files against the widened scripts TS pattern
      expect(content).toContain("^scripts/.*\\.ts$");

      // Must NOT still be narrowed to scripts/lib only
      expect(content).not.toContain("^scripts/lib/");
    },
  );

  it(
    // Test 4 — reworked 2026-07-19 with the filter widening: restage is now
    // SELECTIVE (per staged source -> its dist/*.js + dist/*.d.ts), not a
    // wholesale `git add dist/scripts`. Wholesale would also stage compiled
    // output of UNSTAGED dirty .ts files — committing artifacts whose source
    // the user deliberately left out of the commit, which is the same
    // source/dist drift this hook exists to prevent.
    "selectively stages the dist output of each staged scripts/**/*.ts",
    () => {
      const content = readHookScript();

      // Must derive the dist path from each staged source path
      expect(content).toContain('dist/${src%.ts}');

      // Must re-stage the compiled outputs after build
      expect(content).toContain("git add");

      // Must NOT wholesale-restage a dist directory
      expect(content).not.toContain("git add dist/scripts/lib");
      expect(content).not.toMatch(/git add dist\/scripts\s*$/m);
    },
  );

  it(
    // Test 5 — reworked 2026-07-19: husky v9 executes this file via `sh -e`
    // (shebang ignored), and on Debian/Ubuntu sh is dash, which hard-fails on
    // `set -o pipefail` ("Illegal option -o pipefail") — aborting EVERY
    // commit. `set -eu` keeps the abort-on-build-failure contract (npm run
    // build is not a pipeline; the only pipeline is `|| true`-guarded) while
    // staying POSIX-sh compatible.
    "uses POSIX strict mode (set -eu, no pipefail) so tsc failures abort the commit without breaking dash",
    () => {
      const content = readHookScript();

      expect(content).toContain("set -eu");
      // pipefail is a bashism dash rejects — must not reappear in any
      // EXECUTABLE line (the comment explaining its removal may name it)
      const code = content
        .split("\n")
        .filter((line) => !line.trim().startsWith("#"))
        .join("\n");
      expect(code).not.toContain("pipefail");
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
