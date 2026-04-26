// plan-034 Phase 1 — getDiffScope detection unit tests (ADR-034)
//
// Tests the pure function getDiffScope(stagedFiles, fileContents?) exported
// from scripts/lib/detect-project-language.ts.
//
// Two describe blocks:
//   Block A — mechanical gates (12 cases): needsBuild/needsTypecheck/needsTests/needsLint
//   Block B — reviewer-relevance gates (10 cases): needsTypescriptReviewer/needsPythonReviewer/needsOrakle/needsSpektr
//
// No I/O — pure function, inputs provided inline.

import { describe, it, expect } from "vitest";

import {
  getDiffScope,
  type DiffScope,
} from "../../scripts/lib/detect-project-language.js";

// ─── Block A: Mechanical gates ────────────────────────────────────────────────

describe("getDiffScope — Block A: mechanical gates", () => {
  // Case 1: empty diff → all 4 mechanical gates false
  it("empty diff → all mechanical gates false; rationale 'empty diff'", () => {
    const result: DiffScope = getDiffScope([]);
    expect(result.needsBuild).toBe(false);
    expect(result.needsTypecheck).toBe(false);
    expect(result.needsTests).toBe(false);
    expect(result.needsLint).toBe(false);
    expect(result.rationale["needsBuild"]).toMatch(/empty diff/i);
  });

  // Case 2: docs-only diff → all 4 mechanical gates false
  it("docs-only diff → all mechanical gates false; rationale 'docs-only'", () => {
    const result: DiffScope = getDiffScope([
      "docs/plans/plan-034.md",
      "README.md",
    ]);
    expect(result.needsBuild).toBe(false);
    expect(result.needsTypecheck).toBe(false);
    expect(result.needsTests).toBe(false);
    expect(result.needsLint).toBe(false);
    expect(result.rationale["needsBuild"]).toMatch(/docs.only/i);
  });

  // Case 3: config-only package.json → build:true, typecheck:true, tests:false, lint:true
  it("config-only package.json → needsBuild/needsTypecheck/needsLint true; needsTests false", () => {
    const result: DiffScope = getDiffScope(["package.json"]);
    expect(result.needsBuild).toBe(true);
    expect(result.needsTypecheck).toBe(true);
    expect(result.needsTests).toBe(false);
    expect(result.needsLint).toBe(true);
  });

  // Case 4: config-only tsconfig.json → same shape as case 3
  it("config-only tsconfig.json → needsBuild/needsTypecheck/needsLint true; needsTests false", () => {
    const result: DiffScope = getDiffScope(["tsconfig.json"]);
    expect(result.needsBuild).toBe(true);
    expect(result.needsTypecheck).toBe(true);
    expect(result.needsTests).toBe(false);
    expect(result.needsLint).toBe(true);
  });

  // Case 5: config-only pyproject.toml → same shape as case 3
  it("config-only pyproject.toml → needsBuild/needsTypecheck/needsLint true; needsTests false", () => {
    const result: DiffScope = getDiffScope(["pyproject.toml"]);
    expect(result.needsBuild).toBe(true);
    expect(result.needsTypecheck).toBe(true);
    expect(result.needsTests).toBe(false);
    expect(result.needsLint).toBe(true);
  });

  // Case 6: config-only .gitignore → same shape as case 3
  it("config-only .gitignore → needsBuild/needsTypecheck/needsLint true; needsTests false", () => {
    const result: DiffScope = getDiffScope([".gitignore"]);
    expect(result.needsBuild).toBe(true);
    expect(result.needsTypecheck).toBe(true);
    expect(result.needsTests).toBe(false);
    expect(result.needsLint).toBe(true);
  });

  // Case 7: test-only TS → build:false, typecheck:true, tests:true, lint:true
  it("test-only TS file → needsTests/needsTypecheck/needsLint true; needsBuild false; rationale 'test-only'", () => {
    const result: DiffScope = getDiffScope(["tests/lib/foo.test.ts"]);
    expect(result.needsBuild).toBe(false);
    expect(result.needsTypecheck).toBe(true);
    expect(result.needsTests).toBe(true);
    expect(result.needsLint).toBe(true);
    expect(result.rationale["needsBuild"]).toMatch(/test.only/i);
  });

  // Case 8: test-only Python → same shape as case 7
  it("test-only Python file → needsTests/needsTypecheck/needsLint true; needsBuild false", () => {
    const result: DiffScope = getDiffScope(["tests/test_bar.py"]);
    expect(result.needsBuild).toBe(false);
    expect(result.needsTypecheck).toBe(true);
    expect(result.needsTests).toBe(true);
    expect(result.needsLint).toBe(true);
  });

  // Case 9: production TS file → all 4 mechanical gates true
  it("production TS file → all mechanical gates true; rationale contains 'code present'", () => {
    const result: DiffScope = getDiffScope(["scripts/lib/foo.ts"]);
    expect(result.needsBuild).toBe(true);
    expect(result.needsTypecheck).toBe(true);
    expect(result.needsTests).toBe(true);
    expect(result.needsLint).toBe(true);
    expect(result.rationale["needsBuild"]).toMatch(/code present/i);
  });

  // Case 10: mixed docs + production TS → all 4 mechanical gates true (any code → all true)
  it("mixed docs + production TS → all mechanical gates true; rationale 'code present'", () => {
    const result: DiffScope = getDiffScope([
      "docs/plans/plan-034.md",
      "scripts/lib/detect-project-language.ts",
    ]);
    expect(result.needsBuild).toBe(true);
    expect(result.needsTypecheck).toBe(true);
    expect(result.needsTests).toBe(true);
    expect(result.needsLint).toBe(true);
    expect(result.rationale["needsBuild"]).toMatch(/code present/i);
  });

  // Case 11: unknown extension → all 4 true (safe default)
  it("unknown extension → all mechanical gates true (safe default); rationale contains 'safe default' or 'unknown'", () => {
    const result: DiffScope = getDiffScope(["assets/blob.foo"]);
    expect(result.needsBuild).toBe(true);
    expect(result.needsTypecheck).toBe(true);
    expect(result.needsTests).toBe(true);
    expect(result.needsLint).toBe(true);
    expect(result.rationale["needsBuild"]).toMatch(/safe default|unknown/i);
  });

  // Case 12: mixed config + production TS (monorepo edge) → all 4 mechanical gates true
  it("mixed config + production TS → all mechanical gates true (production code wins)", () => {
    const result: DiffScope = getDiffScope([
      "package.json",
      "scripts/lib/state-store.ts",
    ]);
    expect(result.needsBuild).toBe(true);
    expect(result.needsTypecheck).toBe(true);
    expect(result.needsTests).toBe(true);
    expect(result.needsLint).toBe(true);
  });
});

// ─── Block B: Reviewer-relevance gates ────────────────────────────────────────

describe("getDiffScope — Block B: reviewer-relevance gates", () => {
  // Case 1: TS file, no SQL/security keywords → ts-reviewer:true, others false
  it("TS file only, no SQL/security → needsTypescriptReviewer true; others false", () => {
    const result: DiffScope = getDiffScope(["scripts/lib/foo.ts"]);
    expect(result.needsTypescriptReviewer).toBe(true);
    expect(result.needsPythonReviewer).toBe(false);
    expect(result.needsOrakle).toBe(false);
    expect(result.needsSpektr).toBe(false);
    expect(result.rationale["needsTypescriptReviewer"]).toBeDefined();
    expect(result.rationale["needsOrakle"]).toBeDefined();
    expect(result.rationale["needsSpektr"]).toBeDefined();
  });

  // Case 2: Python file only, no SQL/security → py-reviewer:true; others false
  it("Python file only, no SQL/security → needsPythonReviewer true; others false", () => {
    const result: DiffScope = getDiffScope(["src/handler.py"]);
    expect(result.needsTypescriptReviewer).toBe(false);
    expect(result.needsPythonReviewer).toBe(true);
    expect(result.needsOrakle).toBe(false);
    expect(result.needsSpektr).toBe(false);
  });

  // Case 3: SQL keyword in body → needsOrakle:true; rationale references 'supabase.from'
  it("SQL keyword 'supabase.from' in fileContents → needsOrakle true; rationale references keyword", () => {
    const result: DiffScope = getDiffScope(
      ["src/repo.ts"],
      { "src/repo.ts": "const q = supabase.from('users').select()" }
    );
    expect(result.needsOrakle).toBe(true);
    expect(result.rationale["needsOrakle"]).toMatch(/supabase\.from/i);
  });

  // Case 4: SQL migration file path → needsOrakle:true; rationale references sql/migration
  it("SQL migration file path → needsOrakle true; rationale references sql/migration", () => {
    const result: DiffScope = getDiffScope(["migrations/001-init.sql"]);
    expect(result.needsOrakle).toBe(true);
    expect(result.rationale["needsOrakle"]).toMatch(/sql|migration/i);
  });

  // Case 5: auth file path → needsSpektr:true; rationale references 'auth'
  it("auth path file → needsSpektr true; rationale references 'auth'", () => {
    const result: DiffScope = getDiffScope(["src/auth/jwt.ts"]);
    expect(result.needsSpektr).toBe(true);
    expect(result.rationale["needsSpektr"]).toMatch(/auth/i);
  });

  // Case 6: execSync keyword in body → needsSpektr:true; rationale references 'execSync'
  it("execSync keyword in fileContents → needsSpektr true; rationale references 'execSync'", () => {
    const result: DiffScope = getDiffScope(
      ["scripts/run.ts"],
      { "scripts/run.ts": "execSync('npm test')" }
    );
    expect(result.needsSpektr).toBe(true);
    expect(result.rationale["needsSpektr"]).toMatch(/execSync/i);
  });

  // Case 7: mixed TS + Python + SQL + auth → all four reviewer gates true
  it("mixed TS + .py + SQL + auth path → all four reviewer gates true", () => {
    const result: DiffScope = getDiffScope([
      "scripts/lib/foo.ts",
      "src/handler.py",
      "migrations/002-update.sql",
      "src/auth/middleware.ts",
    ]);
    expect(result.needsTypescriptReviewer).toBe(true);
    expect(result.needsPythonReviewer).toBe(true);
    expect(result.needsOrakle).toBe(true);
    expect(result.needsSpektr).toBe(true);
  });

  // Case 8: plain TS file with no relevance signals → ts-reviewer:true; others false (no false-positive)
  it("plain TS file with no extra signals → only needsTypescriptReviewer true (no false-positive)", () => {
    const result: DiffScope = getDiffScope(
      ["src/utils.ts"],
      { "src/utils.ts": "export function add(a: number, b: number): number { return a + b; }" }
    );
    expect(result.needsTypescriptReviewer).toBe(true);
    expect(result.needsOrakle).toBe(false);
    expect(result.needsSpektr).toBe(false);
    expect(result.needsPythonReviewer).toBe(false);
  });

  // Case 9: SQL keyword in .md file → needsOrakle false (markdown excluded from content scan)
  it("SQL keyword in .md file → needsOrakle false (markdown excluded from content scan)", () => {
    const result: DiffScope = getDiffScope(
      ["docs/x.md"],
      { "docs/x.md": "FROM users JOIN orders ON users.id = orders.user_id" }
    );
    expect(result.needsOrakle).toBe(false);
  });

  // Case 10: conservative-by-default — uncertain extension with no fileContents → all reviewer gates TRUE
  it("uncertain extension with no fileContents → all reviewer gates default true (conservative)", () => {
    const result: DiffScope = getDiffScope(["src/unknown.xyz"]);
    expect(result.needsTypescriptReviewer).toBe(true);
    expect(result.needsPythonReviewer).toBe(true);
    expect(result.needsOrakle).toBe(true);
    expect(result.needsSpektr).toBe(true);
  });
});
