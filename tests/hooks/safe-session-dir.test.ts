import { describe, it, expect } from "vitest";
import path from "node:path";

// Direct ESM import — pure function, no stdin/fs dependency needed to test the
// validation contract itself (AUD-15: session_id from stdin must never reach
// path.join() unvalidated).
const { safeSessionDir, SESSION_ID_RE } = (await import(
  path.resolve(".claude/hooks/scripts/safe-session-dir.js")
)) as {
  safeSessionDir: (baseDir: string, sessionId: unknown) => string | null;
  SESSION_ID_RE: RegExp;
};

const BASE = path.join("C:", "fake-tmp", "kadmon");

describe("safeSessionDir", () => {
  it("returns the joined path for a valid alphanumeric session id", () => {
    const result = safeSessionDir(BASE, "abc123");
    expect(result).toBe(path.join(BASE, "abc123"));
  });

  it("returns the joined path for a UUID-shaped session id", () => {
    const uuid = "9f1c1e2a-4b3d-4c5e-8f6a-1234567890ab";
    const result = safeSessionDir(BASE, uuid);
    expect(result).toBe(path.join(BASE, uuid));
  });

  it("accepts underscores and hyphens (test-prefixed ids used in the test suite)", () => {
    const result = safeSessionDir(BASE, "test-obs-1234567890");
    expect(result).toBe(path.join(BASE, "test-obs-1234567890"));
  });

  it("rejects a path traversal attempt (../../../etc/passwd)", () => {
    expect(safeSessionDir(BASE, "../../../etc/passwd")).toBeNull();
  });

  it("rejects a session id containing an embedded slash", () => {
    expect(safeSessionDir(BASE, "foo/bar")).toBeNull();
  });

  it("rejects a session id containing a backslash", () => {
    expect(safeSessionDir(BASE, "foo\\bar")).toBeNull();
  });

  it("rejects the empty string", () => {
    expect(safeSessionDir(BASE, "")).toBeNull();
  });

  it("rejects whitespace-only input", () => {
    expect(safeSessionDir(BASE, "   ")).toBeNull();
  });

  it("rejects a session id with embedded spaces", () => {
    expect(safeSessionDir(BASE, "sid with spaces")).toBeNull();
  });

  it("rejects a session id containing a null byte", () => {
    expect(safeSessionDir(BASE, "sid\x00null")).toBeNull();
  });

  it("rejects unicode characters", () => {
    expect(safeSessionDir(BASE, "café-session")).toBeNull();
    expect(safeSessionDir(BASE, "\u{1F600}session")).toBeNull();
  });

  it("rejects undefined", () => {
    expect(safeSessionDir(BASE, undefined)).toBeNull();
  });

  it("rejects null", () => {
    expect(safeSessionDir(BASE, null)).toBeNull();
  });

  it("rejects non-string types (number, object, array)", () => {
    expect(safeSessionDir(BASE, 12345)).toBeNull();
    expect(safeSessionDir(BASE, { session: "x" })).toBeNull();
    expect(safeSessionDir(BASE, ["abc"])).toBeNull();
  });

  it("exposes the validation regex for callers that need a boolean check", () => {
    expect(SESSION_ID_RE.test("abc123")).toBe(true);
    expect(SESSION_ID_RE.test("../etc")).toBe(false);
  });

  // spektr LOW (chekpoint Wave 2) — characterization/regression test. The
  // `$` anchor in SESSION_ID_RE has NO `m` flag, so in JS (unlike Python's
  // `re` module, where `$` also matches just before a trailing "\n") it
  // anchors strictly to the true end of the string. A trailing-newline id is
  // therefore correctly rejected today. This test locks that behavior in as
  // insurance against a future `m`-flag mistake or a Python port of this
  // module that assumes `$` behaves the same as JS.
  it("rejects a session id with a trailing newline", () => {
    expect(safeSessionDir(BASE, "abc\n")).toBeNull();
  });
});
