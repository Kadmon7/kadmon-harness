// TDD [feniks] — plan-041 Phase 1 Step 1.2 — RED phase
// Tests for scripts/lib/install-scaffold.ts — Step-0 project scaffolding (ADR-041).
//
// RED forecast: ALL tests fail today — scripts/lib/install-scaffold.ts does not
// exist yet. Vitest reports "Cannot find module" at import time.
// GREEN after Step 1.3 (implement scripts/lib/install-scaffold.ts).
//
// Exports under test:
//   scaffoldProject(targetRoot, repoRoot) → ScaffoldResult { created, skipped }
//
// Manifest under test (ADR-041 D2):
//   dirs:  docs/decisions, docs/plans, docs/research, docs/state (each + .gitkeep)
//   files: BACKLOG.md (repo root) from docs/onboarding/BACKLOG.template.md

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { scaffoldProject } from "../../scripts/lib/install-scaffold.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const TEMPLATE_PATH = path.join(
  REPO_ROOT,
  "docs",
  "onboarding",
  "BACKLOG.template.md",
);

const SCAFFOLD_DIRS = [
  "docs/decisions",
  "docs/plans",
  "docs/research",
  "docs/state",
];

let tempTargets: string[] = [];

function createTempTarget(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-scaffold-"));
  tempTargets.push(dir);
  return dir;
}

// ─── Symlink-capability probe (security-review regression tests) ────────────
// Dangling/escaping symlink tests (M1/M2 below) need real symlink creation.
// On Windows this normally requires Developer Mode; probe once at module
// scope (synchronous, matches the it.runIf(bashAvailable) convention used in
// tests/install/install-sh.test.ts) and skip gracefully if unsupported rather
// than failing the whole suite on a locked-down CI runner.
function canCreateSymlinks(): boolean {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-symlink-probe-"));
  try {
    fs.symlinkSync(path.join(dir, "target"), path.join(dir, "link"), "dir");
    return true;
  } catch {
    return false;
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

const SYMLINKS_SUPPORTED = canCreateSymlinks();

if (!SYMLINKS_SUPPORTED) {
  console.warn(
    "[install-scaffold.test] symlink creation unsupported — M1/M2 security " +
      "regression tests will skip. Expected on Windows without Developer Mode.",
  );
}

afterEach(() => {
  for (const dir of tempTargets) {
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      // ignore cleanup errors (Windows file-lock flakiness)
    }
  }
  tempTargets = [];
});

describe("scaffoldProject()", () => {
  it("creates all four docs/ dirs + BACKLOG.md on an empty target", () => {
    const target = createTempTarget();

    scaffoldProject(target, REPO_ROOT);

    for (const dir of SCAFFOLD_DIRS) {
      expect(fs.existsSync(path.join(target, dir))).toBe(true);
    }
    expect(fs.existsSync(path.join(target, "BACKLOG.md"))).toBe(true);
  });

  it("drops a .gitkeep in every dir it creates", () => {
    const target = createTempTarget();

    scaffoldProject(target, REPO_ROOT);

    for (const dir of SCAFFOLD_DIRS) {
      expect(fs.existsSync(path.join(target, dir, ".gitkeep"))).toBe(true);
    }
  });

  it("copies BACKLOG.md verbatim (byte-identical to the template)", () => {
    const target = createTempTarget();

    scaffoldProject(target, REPO_ROOT);

    const templateBytes = fs.readFileSync(TEMPLATE_PATH);
    const copiedBytes = fs.readFileSync(path.join(target, "BACKLOG.md"));
    expect(copiedBytes.equals(templateBytes)).toBe(true);
  });

  it("is idempotent — a second run reports everything as skipped, nothing as created", () => {
    const target = createTempTarget();

    scaffoldProject(target, REPO_ROOT);
    const second = scaffoldProject(target, REPO_ROOT);

    expect(second.created).toEqual([]);
    expect(second.skipped.length).toBeGreaterThan(0);
    for (const dir of SCAFFOLD_DIRS) {
      expect(second.skipped).toContain(dir);
    }
    expect(second.skipped).toContain("BACKLOG.md");
  });

  it("never overwrites a pre-existing BACKLOG.md, even a 0-byte one", () => {
    const target = createTempTarget();
    fs.writeFileSync(path.join(target, "BACKLOG.md"), "");

    const result = scaffoldProject(target, REPO_ROOT);

    const bytes = fs.readFileSync(path.join(target, "BACKLOG.md"));
    expect(bytes.length).toBe(0);
    expect(result.skipped).toContain("BACKLOG.md");
    expect(result.created).not.toContain("BACKLOG.md");
  });

  it("skips a pre-existing docs/decisions/ and drops no .gitkeep into it", () => {
    const target = createTempTarget();
    fs.mkdirSync(path.join(target, "docs", "decisions"), { recursive: true });
    fs.writeFileSync(
      path.join(target, "docs", "decisions", "ADR-001-hand-authored.md"),
      "# hand-authored\n",
    );

    const result = scaffoldProject(target, REPO_ROOT);

    expect(result.skipped).toContain("docs/decisions");
    expect(result.created).not.toContain("docs/decisions");
    expect(
      fs.existsSync(path.join(target, "docs", "decisions", ".gitkeep")),
    ).toBe(false);
    // Hand-authored content untouched
    expect(
      fs.existsSync(
        path.join(target, "docs", "decisions", "ADR-001-hand-authored.md"),
      ),
    ).toBe(true);
  });

  it("throws a clear error when the BACKLOG template is missing (fail-loud)", () => {
    const target = createTempTarget();
    const brokenRepoRoot = createTempTarget(); // no docs/onboarding/BACKLOG.template.md here

    expect(() => scaffoldProject(target, brokenRepoRoot)).toThrow(
      /BACKLOG\.template\.md/,
    );
  });

  it("reports repo-relative, forward-slash paths in created/skipped", () => {
    const target = createTempTarget();

    const result = scaffoldProject(target, REPO_ROOT);

    for (const entry of [...result.created, ...result.skipped]) {
      expect(entry).not.toMatch(/\\/);
      expect(path.isAbsolute(entry)).toBe(false);
    }
    expect(result.created).toContain("docs/decisions");
    expect(result.created).toContain("BACKLOG.md");
  });

  // ─── Security-review regression tests (ADR-041 build review, 2026-07-22) ──

  it("H1: throws when targetRoot is not absolute (library-boundary guard)", () => {
    // RED today: scaffoldProject has no absolute-path guard, so a relative
    // targetRoot silently flows into path.join() and resolves against
    // process.cwd() at call time — reproducing the exact re-anchoring bug
    // the shells hit when a relative --target is forwarded verbatim to a
    // child process whose cwd is the harness repo (H1).
    expect(() => scaffoldProject("relative/path", REPO_ROOT)).toThrow(
      /must be absolute/,
    );
  });

  it("M3: does not create any docs/ dirs when the BACKLOG template is missing (check hoisted above the dir loop)", () => {
    // RED today: scaffoldProject creates all 4 docs/ dirs (+ .gitkeep) in the
    // loop BEFORE scaffoldBacklog() ever checks the template exists — a
    // missing template leaves a half-scaffolded tree (dirs present, no
    // BACKLOG.md) and the throw aborts install.sh under `set -euo pipefail`
    // before later install steps (settings.local.json, .kadmon-version) run.
    const target = createTempTarget();
    const brokenRepoRoot = createTempTarget(); // no docs/onboarding/BACKLOG.template.md here

    expect(() => scaffoldProject(target, brokenRepoRoot)).toThrow(
      /BACKLOG\.template\.md/,
    );

    for (const dir of SCAFFOLD_DIRS) {
      expect(fs.existsSync(path.join(target, dir))).toBe(false);
    }
  });

  it("L1: throws when the BACKLOG template is 0 bytes (unrepairable empty BACKLOG.md)", () => {
    // RED today: an empty template is read and copied verbatim — a 0-byte
    // BACKLOG.md then lands forever, because create-if-missing means no
    // later, correct install can ever repair it.
    const target = createTempTarget();
    const brokenRepoRoot = createTempTarget();
    fs.mkdirSync(path.join(brokenRepoRoot, "docs", "onboarding"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(brokenRepoRoot, "docs", "onboarding", "BACKLOG.template.md"),
      "",
    );

    expect(() => scaffoldProject(target, brokenRepoRoot)).toThrow(
      /empty|0.byte/i,
    );
  });

  it.runIf(SYMLINKS_SUPPORTED)(
    "M1: does not follow a dangling BACKLOG.md symlink to write outside targetRoot",
    () => {
      // RED today: fs.existsSync follows symlinks and reports FALSE for a
      // dangling one, so the create-if-missing gate opens and writeFileSync
      // follows the link, writing the template OUTSIDE targetRoot.
      const target = createTempTarget();
      const outside = createTempTarget();
      const outsideFile = path.join(outside, "OPERATOR_FILE.md");
      // outsideFile intentionally does NOT exist yet — dangling target.
      fs.symlinkSync(outsideFile, path.join(target, "BACKLOG.md"), "file");

      const result = scaffoldProject(target, REPO_ROOT);

      // Nothing was ever written through the dangling link.
      expect(fs.existsSync(outsideFile)).toBe(false);
      // The lstat-based existence check sees the symlink node itself and
      // reports "skipped" — never touches it.
      expect(result.skipped).toContain("BACKLOG.md");
      expect(result.created).not.toContain("BACKLOG.md");
      // The dangling symlink itself is left exactly as it was.
      expect(
        fs.lstatSync(path.join(target, "BACKLOG.md")).isSymbolicLink(),
      ).toBe(true);
    },
  );

  it.runIf(SYMLINKS_SUPPORTED)(
    "M2: refuses to scaffold through a docs/ symlink that escapes targetRoot",
    () => {
      // RED today: with target/docs -> ../elsewhere (existing dir),
      // existsSync(target/docs/decisions) is false and mkdirSync creates
      // THROUGH the symlink, relocating the whole scaffold outside targetRoot.
      const target = createTempTarget();
      const elsewhere = createTempTarget();
      fs.symlinkSync(elsewhere, path.join(target, "docs"), "dir");

      expect(() => scaffoldProject(target, REPO_ROOT)).toThrow(
        /outside targetRoot|escapes/i,
      );

      // Nothing was created in the escaped-to directory.
      for (const dir of ["decisions", "plans", "research", "state"]) {
        expect(fs.existsSync(path.join(elsewhere, dir))).toBe(false);
      }
    },
  );
});
