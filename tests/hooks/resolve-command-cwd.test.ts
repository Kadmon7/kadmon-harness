import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Direct ESM import — pure function, no stdin/fs mocking needed to test the
// parse + validate contract itself (B1: hook git calls must target the
// COMMAND's repo, not the session repo, when the Bash command cds/− Cs
// elsewhere).
const { resolveCommandCwd } = (await import(
  path.resolve(".claude/hooks/scripts/resolve-command-cwd.js")
)) as {
  resolveCommandCwd: (command: unknown) => string | null;
};

describe("resolveCommandCwd", () => {
  let plainDir: string;
  let spacedDir: string;

  beforeEach(() => {
    plainDir = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-rcc-plain-"));
    spacedDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "kadmon rcc spaced "),
    );
  });

  afterEach(() => {
    fs.rmSync(plainDir, { recursive: true, force: true, maxRetries: 5 });
    fs.rmSync(spacedDir, { recursive: true, force: true, maxRetries: 5 });
  });

  it("resolves a leading unquoted cd prefix before &&", () => {
    const cmd = `cd ${plainDir} && git commit -m "x"`;
    expect(resolveCommandCwd(cmd)).toBe(plainDir);
  });

  it("resolves a leading double-quoted cd prefix with spaces before &&", () => {
    const cmd = `cd "${spacedDir}" && git commit -m "x"`;
    expect(resolveCommandCwd(cmd)).toBe(spacedDir);
  });

  it("resolves a leading single-quoted cd prefix before ;", () => {
    const cmd = `cd '${spacedDir}' ; git commit -m "x"`;
    expect(resolveCommandCwd(cmd)).toBe(spacedDir);
  });

  it("resolves a git -C flag when there is no leading cd", () => {
    const cmd = `git -C "${spacedDir}" commit -m "x"`;
    expect(resolveCommandCwd(cmd)).toBe(spacedDir);
  });

  it("resolves an unquoted git -C flag", () => {
    const cmd = `git -C ${plainDir} commit -m "x"`;
    expect(resolveCommandCwd(cmd)).toBe(plainDir);
  });

  it("returns null when the command has no explicit target", () => {
    expect(resolveCommandCwd('git commit -m "x"')).toBeNull();
  });

  it("returns null when a later cd (not leading) appears after other commands", () => {
    // Only a LEADING cd counts — a cd later in a chain is out of scope.
    const cmd = `echo hi && cd ${plainDir} && git commit -m "x"`;
    expect(resolveCommandCwd(cmd)).toBeNull();
  });

  // ─── Chained leading cd (spektr BLOCK remediation item 1, 2026-07-22) ─────
  // Reviewer-verified: `cd <scratch> && cd <repo> && git commit` must resolve
  // to <repo> (the LAST cd target), not <scratch> (the first). The old
  // single-exec() regex only ever captured the first match.
  it("resolves a chained leading cd to the LAST target before the first non-cd command", () => {
    const cmd = `cd ${plainDir} && cd "${spacedDir}" && git commit -m "x"`;
    expect(resolveCommandCwd(cmd)).toBe(spacedDir);
  });

  it("resolves a relative second cd compositionally against the prior segment", () => {
    const subDir = path.join(plainDir, "sub");
    fs.mkdirSync(subDir);
    const cmd = `cd ${plainDir} && cd sub && git commit -m "x"`;
    expect(resolveCommandCwd(cmd)).toBe(subDir);
  });

  it("returns null when a later segment in the cd chain does not exist (chain cannot be resolved)", () => {
    const ghost = path.join(os.tmpdir(), `kadmon-rcc-ghost-${Date.now()}`);
    const cmd = `cd ${plainDir} && cd ${ghost} && git commit -m "x"`;
    expect(resolveCommandCwd(cmd)).toBeNull();
  });

  // ─── git -C precedence over a leading cd chain (item 4) ───────────────────
  // `git -C <path>` overrides the shell cwd for the git process itself, so it
  // must win when both a leading cd AND a `git -C` flag are present.
  it("prefers git -C over a leading cd when both are present (git -C overrides shell cwd)", () => {
    const cmd = `cd ${plainDir} && git -C "${spacedDir}" commit -m "x"`;
    expect(resolveCommandCwd(cmd)).toBe(spacedDir);
  });

  it("returns null when the leading cd target does not exist", () => {
    const ghost = path.join(os.tmpdir(), `kadmon-rcc-ghost-${Date.now()}`);
    const cmd = `cd ${ghost} && git commit -m "x"`;
    expect(resolveCommandCwd(cmd)).toBeNull();
  });

  it("returns null when the git -C target does not exist", () => {
    const ghost = path.join(os.tmpdir(), `kadmon-rcc-ghost-${Date.now()}`);
    const cmd = `git -C ${ghost} commit -m "x"`;
    expect(resolveCommandCwd(cmd)).toBeNull();
  });

  it("translates a Git-Bash /c/... path to its C:\\... equivalent on win32", () => {
    if (process.platform !== "win32") return; // platform-specific fallback path
    const driveMatch = /^([A-Za-z]):\\(.*)$/.exec(plainDir);
    expect(driveMatch).not.toBeNull();
    const [, drive, rest] = driveMatch as unknown as [string, string, string];
    const gitBashPath = `/${drive.toLowerCase()}/${rest.replace(/\\/g, "/")}`;
    const cmd = `cd ${gitBashPath} && git commit -m "x"`;
    expect(resolveCommandCwd(cmd)).toBe(plainDir);
  });

  it("returns null for a command with no cd/-C target and no throw", () => {
    expect(() => resolveCommandCwd("npm test")).not.toThrow();
    expect(resolveCommandCwd("npm test")).toBeNull();
  });

  it("returns null (never throws) for null input", () => {
    expect(() => resolveCommandCwd(null)).not.toThrow();
    expect(resolveCommandCwd(null)).toBeNull();
  });

  it("returns null (never throws) for undefined input", () => {
    expect(() => resolveCommandCwd(undefined)).not.toThrow();
    expect(resolveCommandCwd(undefined)).toBeNull();
  });

  it("returns null (never throws) for non-string types (number, object, array)", () => {
    expect(resolveCommandCwd(12345)).toBeNull();
    expect(resolveCommandCwd({ command: "x" })).toBeNull();
    expect(resolveCommandCwd(["cd", "/tmp"])).toBeNull();
  });

  it("returns null (never throws) for the empty string", () => {
    expect(resolveCommandCwd("")).toBeNull();
  });

  it("returns null (never throws) for an unterminated quote", () => {
    const cmd = `cd "${plainDir} && git commit -m "x"`;
    expect(() => resolveCommandCwd(cmd)).not.toThrow();
    expect(resolveCommandCwd(cmd)).toBeNull();
  });

  it("returns null (never throws) for a hostile shell-metacharacter payload", () => {
    const cmd = 'cd "$(rm -rf / )" && git commit -m "x"';
    expect(() => resolveCommandCwd(cmd)).not.toThrow();
    expect(resolveCommandCwd(cmd)).toBeNull();
  });

  it("returns null (never throws) for a very long malformed command", () => {
    const cmd = `cd ${"a".repeat(200_000)} && git commit -m "x"`;
    expect(() => resolveCommandCwd(cmd)).not.toThrow();
    expect(resolveCommandCwd(cmd)).toBeNull();
  });
});
