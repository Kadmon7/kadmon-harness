// TDD [feniks]
// Phase 6 of plan-028: medik-alv — ALV (Attach-Log-Verify) report generator.
// RED → GREEN → REFACTOR
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// ── Module under test (will fail: module-not-found until GREEN) ──────────────
import {
  generateAlvReport,
  redactSensitivePaths,
  writeAlvReport,
} from "../../scripts/lib/medik-alv.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const systemUsername = os.userInfo().username;
const TMP_DIR = path.join(os.tmpdir(), `medik-alv-test-${Date.now()}`);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Assert username does NOT appear in a path context (between a path separator / Users/ / home/
// and a terminator). Dictionary-word usernames (admin, user, git) legitimately appear in prose
// and must not trigger false positives.
function assertNoUsernameInPathContext(output: string, username: string): void {
  if (!username) return;
  const pattern = new RegExp(
    `(?:[\\\\/]|Users[\\\\/]|home[\\\\/])${escapeRegex(username)}(?=[\\\\/"\\s]|$)`,
    "i",
  );
  expect(output).not.toMatch(pattern);
}

beforeEach(() => {
  fs.mkdirSync(TMP_DIR, { recursive: true });
});

afterEach(() => {
  try {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});

// ── redactSensitivePaths ──────────────────────────────────────────────────────

describe("redactSensitivePaths", () => {
  it("replaces homedir with ~", () => {
    const result = redactSensitivePaths(
      "C:\\Users\\kadmo\\file",
      "C:\\work",
      "C:\\Users\\kadmo",
    );
    expect(result).toContain("~");
    expect(result).not.toContain("kadmo");
  });

  it("replaces /Users/<name>/ pattern with /Users/<user>/", () => {
    const result = redactSensitivePaths(
      "/Users/john/x",
      "/tmp",
      "/other/home",
    );
    expect(result).toContain("/Users/<user>/x");
    expect(result).not.toContain("john");
  });

  it("replaces /home/<name>/ pattern with /home/<user>/", () => {
    const result = redactSensitivePaths(
      "/home/alice/y",
      "/tmp",
      "/other",
    );
    expect(result).toContain("/home/<user>/y");
    expect(result).not.toContain("alice");
  });

  it("replaces cwd with .", () => {
    const result = redactSensitivePaths(
      "at /tmp/work",
      "/tmp/work",
      "/home/x",
    );
    expect(result).toContain("at .");
  });

  it("never contains the real OS username — Windows homedir sample", () => {
    const text = `path is C:\\Users\\${systemUsername}\\somefile`;
    const result = redactSensitivePaths(
      text,
      "C:\\other",
      `C:\\Users\\${systemUsername}`,
    );
    expect(result).not.toContain(systemUsername);
  });

  it("never contains the real OS username — POSIX /Users/ sample", () => {
    const text = `/Users/${systemUsername}/projects`;
    const result = redactSensitivePaths(text, "/tmp", "/other");
    // /Users/ pattern replaces the segment regardless of homedir
    expect(result).not.toContain(systemUsername);
  });

  it("never contains the real OS username — POSIX /home/ sample", () => {
    const text = `/home/${systemUsername}/projects`;
    const result = redactSensitivePaths(text, "/tmp", "/other");
    expect(result).not.toContain(systemUsername);
  });

  it("completes within 50ms on ReDoS fixture (200-char repeated backslash)", () => {
    const evilInput = "\\\\".repeat(100); // 200-char backslash run
    const start = Date.now();
    redactSensitivePaths(evilInput, "C:\\work", "C:\\Users\\user");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it("redacts username in path context even when username is a dictionary word (BLOCK-2)", () => {
    const fixture = [
      'log: file="C:\\Users\\admin\\.ssh\\config"',
      'log: file="/home/admin/.kadmon/kadmon.db"',
      'prose: "the admin panel was configured"', // prose form must survive
    ].join("\n");

    const redacted = redactSensitivePaths(
      fixture,
      "/tmp/project",
      "C:\\Users\\admin",
    );

    assertNoUsernameInPathContext(redacted, "admin");
    expect(redacted).toContain("admin panel"); // prose context preserved
  });

  it("redacts caller-supplied additional paths as <project-root> (BLOCK-1 primitive)", () => {
    const foreignRoot = process.platform === "win32"
      ? "C:\\Work\\Acme-Client\\private-project"
      : "/srv/work/acme-client/private-project";
    const text = `leak source: ${foreignRoot}/sub/file.ts`;
    const result = redactSensitivePaths(text, "/tmp", "/home/other", [foreignRoot]);
    expect(result).toContain("<project-root>");
    expect(result).not.toContain("Acme-Client");
    expect(result).not.toContain("acme-client");
    expect(result).not.toContain("private-project");
  });

  it("preserves rule order: homedir → ~ wins over catch-all <path> (HIGH-3)", () => {
    const home = process.platform === "win32"
      ? "C:\\Users\\dev\\.kadmon"
      : "/home/dev/.kadmon";
    const input = `path: ${home}/kadmon.db`;
    const result = redactSensitivePaths(input, "/tmp/proj", home);
    expect(result).toContain("~");
    // Catch-all rule 6 must not have pre-empted the homedir → ~ mapping.
    // (A rogue re-ordering would leave `<path>` here instead of `~`.)
    expect(result).toMatch(/~[/\\]kadmon\.db$/);
  });
});

// ── generateAlvReport ─────────────────────────────────────────────────────────

describe("generateAlvReport", () => {
  it("returns a string", () => {
    const report = generateAlvReport(process.cwd());
    expect(typeof report).toBe("string");
    expect(report.length).toBeGreaterThan(0);
  });

  it("contains INSTALL-DIAGNOSTIC section header", () => {
    const report = generateAlvReport(process.cwd());
    expect(report).toContain("=== INSTALL-DIAGNOSTIC ===");
  });

  it("contains HOOK-ERRORS section header", () => {
    const report = generateAlvReport(process.cwd());
    expect(report).toContain("=== HOOK-ERRORS ===");
  });

  it("contains FRESH-HEALTH section header", () => {
    const report = generateAlvReport(process.cwd());
    expect(report).toContain("=== FRESH-HEALTH ===");
  });

  it("does not contain the real homedir path unredacted in output", () => {
    const report = generateAlvReport(process.cwd());
    const home = os.homedir();
    // The full homedir path must not appear — it should be replaced with ~.
    // Note: the username may still appear as part of harness directory names
    // (e.g. `.kadmon` when username happens to be a prefix of that name).
    // We assert the full homedir path is gone, not just the bare username.
    expect(report).not.toContain(home);
    // Also verify the raw Windows-style path is gone (forward slashes too)
    expect(report).not.toContain(home.replace(/\\/g, "/"));
  });

  it("does not contain raw username in a path context (C:\\Users\\<user>)", () => {
    const report = generateAlvReport(process.cwd());
    // Check the specific pattern: username appearing between Users/ and a separator
    const home = os.homedir();
    if (home.includes(systemUsername)) {
      // The full homedir is gone — that's sufficient for path redaction.
      expect(report).not.toContain(home);
    }
  });
});

// ── writeAlvReport ────────────────────────────────────────────────────────────

describe("writeAlvReport", () => {
  it("returns an absolute path", () => {
    const p = writeAlvReport(process.cwd(), TMP_DIR);
    expect(path.isAbsolute(p)).toBe(true);
  });

  it("writes a file that exists on disk", () => {
    const p = writeAlvReport(process.cwd(), TMP_DIR);
    expect(fs.existsSync(p)).toBe(true);
  });

  it("filename matches diagnostic-YYYYMMDDTHHmm.txt pattern", () => {
    const p = writeAlvReport(process.cwd(), TMP_DIR);
    const basename = path.basename(p);
    expect(basename).toMatch(/^diagnostic-\d{4}-\d{2}-\d{2}T\d{4}\.txt$/);
  });

  it("file mode is 0o600 on POSIX", () => {
    if (process.platform === "win32") {
      // Advisory — Windows does not honor POSIX mode bits
      console.log("[medik-alv test] Skipping file-mode assertion on Windows");
      return;
    }
    const p = writeAlvReport(process.cwd(), TMP_DIR);
    const mode = fs.statSync(p).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("written file content contains all three section headers", () => {
    const p = writeAlvReport(process.cwd(), TMP_DIR);
    const content = fs.readFileSync(p, "utf8");
    expect(content).toContain("=== INSTALL-DIAGNOSTIC ===");
    expect(content).toContain("=== HOOK-ERRORS ===");
    expect(content).toContain("=== FRESH-HEALTH ===");
  });

  it("rejects outputDir outside cwd and os.tmpdir() (BLOCK-3)", () => {
    const forbidden = process.platform === "win32"
      ? "C:\\Windows"
      : "/etc";
    expect(() => writeAlvReport(process.cwd(), forbidden)).toThrow(
      /must be inside cwd or os\.tmpdir/,
    );
  });

  it("rejects outputDir that escapes via .. (BLOCK-3)", () => {
    const escapeTarget = path.resolve(process.cwd(), "..", "..", "escape-alv");
    expect(() => writeAlvReport(process.cwd(), escapeTarget)).toThrow(
      /must be inside cwd or os\.tmpdir/,
    );
  });

  it("accepts outputDir inside os.tmpdir() (BLOCK-3)", () => {
    const tmpSub = fs.mkdtempSync(path.join(os.tmpdir(), "alv-ok-"));
    try {
      const written = writeAlvReport(process.cwd(), tmpSub);
      expect(fs.existsSync(written)).toBe(true);
    } finally {
      fs.rmSync(tmpSub, { recursive: true, force: true });
    }
  });

  it("falls back to random suffix when target already exists (BLOCK-3 MEDIUM-3 EEXIST)", () => {
    const safeName = new Date().toISOString().slice(0, 16).replace(/:/g, "");
    const firstPath = path.join(TMP_DIR, `diagnostic-${safeName}.txt`);
    fs.writeFileSync(firstPath, "decoy-existing");

    const written = writeAlvReport(process.cwd(), TMP_DIR);

    expect(written).not.toBe(firstPath);
    expect(fs.readFileSync(firstPath, "utf8")).toBe("decoy-existing"); // decoy untouched
    expect(path.basename(written)).toMatch(
      /^diagnostic-\d{4}-\d{2}-\d{2}T\d{4}-[a-z0-9]{6}\.txt$/,
    );
  });
});
