// TDD [feniks] — Check #15 docs-status-lint (plan-038 Step 2.3)
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runCheck } from "../../../scripts/lib/medik-checks/docs-status-lint.js";

describe("docs-status-lint check (#15)", () => {
  function makeTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "docs-status-lint-test-"));
  }

  function writePlan(dir: string, filename: string, status: string): void {
    const plansDir = path.join(dir, "docs", "plans");
    fs.mkdirSync(plansDir, { recursive: true });
    fs.writeFileSync(
      path.join(plansDir, filename),
      `---\nnumber: 1\ntitle: Test\ndate: 2026-07-13\nstatus: ${status}\n---\n# Test Plan\n`,
      "utf8",
    );
  }

  function writeAdr(dir: string, filename: string, status: string): void {
    const adrDir = path.join(dir, "docs", "decisions");
    fs.mkdirSync(adrDir, { recursive: true });
    fs.writeFileSync(
      path.join(adrDir, filename),
      `---\nnumber: 1\ntitle: Test\ndate: 2026-07-13\nstatus: ${status}\n---\n# Test ADR\n`,
      "utf8",
    );
  }

  function writeBacklog(dir: string, content: string): void {
    fs.writeFileSync(path.join(dir, "BACKLOG.md"), content, "utf8");
  }

  function cleanup(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  describe("plan enum", () => {
    it.each(["pending", "in_progress", "completed", "superseded"])(
      "PASS-eligible: plan status %s is a valid enum member",
      (status) => {
        const tmpDir = makeTmpDir();
        try {
          writePlan(tmpDir, "plan-001-test.md", status);
          const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });
          expect(result.status).not.toBe("FAIL");
        } finally {
          cleanup(tmpDir);
        }
      },
    );

    it("FAILs on hyphenated status: in-progress", () => {
      const tmpDir = makeTmpDir();
      try {
        writePlan(tmpDir, "plan-002-test.md", "in-progress");
        const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });
        expect(result.status).toBe("FAIL");
        expect(result.message).toMatch(/plan-002-test/);
      } finally {
        cleanup(tmpDir);
      }
    });

    it("FAILs when a plan uses an ADR-only status value: accepted", () => {
      const tmpDir = makeTmpDir();
      try {
        writePlan(tmpDir, "plan-003-test.md", "accepted");
        const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });
        expect(result.status).toBe("FAIL");
        expect(result.message).toMatch(/plan-003-test/);
      } finally {
        cleanup(tmpDir);
      }
    });
  });

  describe("ADR enum", () => {
    it.each(["proposed", "accepted", "deprecated", "superseded"])(
      "PASS-eligible: ADR status %s is a valid enum member",
      (status) => {
        const tmpDir = makeTmpDir();
        try {
          writeAdr(tmpDir, "ADR-001-test.md", status);
          const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });
          expect(result.status).not.toBe("FAIL");
        } finally {
          cleanup(tmpDir);
        }
      },
    );

    it("FAILs when an ADR uses a plan-only status value: pending", () => {
      const tmpDir = makeTmpDir();
      try {
        writeAdr(tmpDir, "ADR-002-test.md", "pending");
        const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });
        expect(result.status).toBe("FAIL");
        expect(result.message).toMatch(/ADR-002-test/);
      } finally {
        cleanup(tmpDir);
      }
    });
  });

  describe("BACKLOG marker check", () => {
    it("WARNs on an illegal marker", () => {
      const tmpDir = makeTmpDir();
      try {
        writeBacklog(tmpDir, "# BACKLOG\n\n- [?] Some illegal marker item\n");
        const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });
        expect(result.status).toBe("WARN");
      } finally {
        cleanup(tmpDir);
      }
    });

    it.each([" ", "~", "x", "-", "d"])(
      "does not WARN on legal marker [%s]",
      (marker) => {
        const tmpDir = makeTmpDir();
        try {
          writeBacklog(tmpDir, `# BACKLOG\n\n- [${marker}] Legal item\n`);
          const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });
          expect(result.status).not.toBe("WARN");
        } finally {
          cleanup(tmpDir);
        }
      },
    );

    it("does not false-positive on prose brackets outside list-item syntax", () => {
      const tmpDir = makeTmpDir();
      try {
        writeBacklog(
          tmpDir,
          "# BACKLOG\n\nSee the config value [?] documented elsewhere, not a checkbox.\n",
        );
        const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });
        expect(result.status).not.toBe("WARN");
      } finally {
        cleanup(tmpDir);
      }
    });
  });

  describe("missing-dir / missing-file guards", () => {
    it("does not crash and does not FAIL when docs/plans/ is missing", () => {
      const tmpDir = makeTmpDir();
      try {
        writeAdr(tmpDir, "ADR-001-test.md", "accepted");
        const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });
        expect(result.status).not.toBe("FAIL");
      } finally {
        cleanup(tmpDir);
      }
    });

    it("does not crash and does not FAIL when docs/decisions/ is missing", () => {
      const tmpDir = makeTmpDir();
      try {
        writePlan(tmpDir, "plan-001-test.md", "pending");
        const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });
        expect(result.status).not.toBe("FAIL");
      } finally {
        cleanup(tmpDir);
      }
    });

    it("does not crash and does not FAIL when BACKLOG.md is missing", () => {
      const tmpDir = makeTmpDir();
      try {
        const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });
        expect(result.status).not.toBe("FAIL");
      } finally {
        cleanup(tmpDir);
      }
    });

    it("PASSes on a completely empty tree (no plans, no ADRs, no BACKLOG)", () => {
      const tmpDir = makeTmpDir();
      try {
        const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });
        expect(result.status).toBe("PASS");
        expect(result.category).toBe("knowledge-hygiene");
      } finally {
        cleanup(tmpDir);
      }
    });
  });

  describe("precedence", () => {
    it("FAIL overrides a simultaneous marker WARN", () => {
      const tmpDir = makeTmpDir();
      try {
        writePlan(tmpDir, "plan-004-test.md", "in-progress");
        writeBacklog(tmpDir, "# BACKLOG\n\n- [?] Illegal marker\n");
        const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });
        expect(result.status).toBe("FAIL");
      } finally {
        cleanup(tmpDir);
      }
    });

    it("marker-only violation yields WARN when enums are clean", () => {
      const tmpDir = makeTmpDir();
      try {
        writePlan(tmpDir, "plan-005-test.md", "pending");
        writeAdr(tmpDir, "ADR-003-test.md", "accepted");
        writeBacklog(tmpDir, "# BACKLOG\n\n- [?] Illegal marker\n");
        const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });
        expect(result.status).toBe("WARN");
      } finally {
        cleanup(tmpDir);
      }
    });

    it("clean tree yields PASS", () => {
      const tmpDir = makeTmpDir();
      try {
        writePlan(tmpDir, "plan-006-test.md", "completed");
        writeAdr(tmpDir, "ADR-004-test.md", "accepted");
        writeBacklog(tmpDir, "# BACKLOG\n\n- [x] Done item\n- [ ] Open item\n");
        const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });
        expect(result.status).toBe("PASS");
      } finally {
        cleanup(tmpDir);
      }
    });
  });
});
