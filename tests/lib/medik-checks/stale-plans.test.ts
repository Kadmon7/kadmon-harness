// TDD [feniks] — Check #10 stale-plans (plan-028 Phase 4.2)
import { describe, it, expect, vi, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runCheck } from "../../../scripts/lib/medik-checks/stale-plans.js";

// Mock child_process at module level so stale-plans.ts picks it up.
// Prod code uses execFileSync (arg-array, no shell interpolation — security rule).
vi.mock("node:child_process", () => ({
  execFileSync: vi.fn().mockReturnValue(""),
  execSync: vi.fn().mockReturnValue(""),
}));

// Import the mock so tests can control its return value
import * as childProcess from "node:child_process";
const mockExecSync = childProcess.execFileSync as unknown as ReturnType<typeof vi.fn>;

describe("stale-plans check (#10)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  function makeTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "stale-plans-test-"));
  }

  function writePlan(
    dir: string,
    filename: string,
    content: string,
  ): void {
    const plansDir = path.join(dir, "docs", "plans");
    fs.mkdirSync(plansDir, { recursive: true });
    fs.writeFileSync(path.join(plansDir, filename), content, "utf-8");
  }

  function daysAgoISO(days: number): string {
    const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  }

  it("(a) returns WARN when pending plan is >3d old AND has recent git activity", () => {
    const tmpDir = makeTmpDir();
    try {
      writePlan(
        tmpDir,
        "plan-010-test.md",
        `---\nstatus: pending\ndate: ${daysAgoISO(7)}\n---\n# Test Plan\n`,
      );

      // Simulate recent git activity (non-empty output)
      mockExecSync.mockReturnValue("abc1234 commit message\n" );

      const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });

      expect(result.status).toBe("WARN");
      expect(result.category).toBe("knowledge-hygiene");
      expect(result.message).toMatch(/stale pending plan/i);
      expect(result.message).toMatch(/plan-010-test/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("(b) returns PASS when pending plan is <3d old (too fresh)", () => {
    const tmpDir = makeTmpDir();
    try {
      writePlan(
        tmpDir,
        "plan-new.md",
        `---\nstatus: pending\ndate: ${daysAgoISO(1)}\n---\n# New Plan\n`,
      );

      mockExecSync.mockReturnValue("abc1234 commit message\n" );

      const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });

      expect(result.status).toBe("PASS");
      expect(result.message).toMatch(/no stale pending plans/i);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("(c) returns PASS for accepted status plans (ignored)", () => {
    const tmpDir = makeTmpDir();
    try {
      writePlan(
        tmpDir,
        "plan-accepted.md",
        `---\nstatus: accepted\ndate: ${daysAgoISO(10)}\n---\n# Accepted Plan\n`,
      );

      mockExecSync.mockReturnValue("abc1234 some commit\n" );

      const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });

      expect(result.status).toBe("PASS");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("(d) returns PASS for completed status plans (ignored)", () => {
    const tmpDir = makeTmpDir();
    try {
      writePlan(
        tmpDir,
        "plan-done.md",
        `---\nstatus: completed\ndate: ${daysAgoISO(10)}\n---\n# Done Plan\n`,
      );

      // Even with no activity, completed plans are ignored
      mockExecSync.mockReturnValue("" );

      const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });

      expect(result.status).toBe("PASS");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("(e) returns PASS when pending plan is old but no recent git activity", () => {
    const tmpDir = makeTmpDir();
    try {
      writePlan(
        tmpDir,
        "plan-stale-no-activity.md",
        `---\nstatus: pending\ndate: ${daysAgoISO(7)}\n---\n# Stale but no activity\n`,
      );

      // Empty string = no recent git activity
      mockExecSync.mockReturnValue("" );

      const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });

      expect(result.status).toBe("PASS");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("(f) returns PASS when docs/plans/ dir does not exist", () => {
    const tmpDir = makeTmpDir();
    try {
      // No plans dir created
      const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });

      expect(result.status).toBe("PASS");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
