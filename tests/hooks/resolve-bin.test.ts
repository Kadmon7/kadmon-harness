import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

// Dynamic import via a runtime path expression (not a static specifier) —
// keeps tsc from trying to resolve declaration files for a plain .js module
// that lives outside tsconfig's `include` (.claude/hooks/scripts/ is not
// under scripts/** or tests/**). Matches the established convention used by
// tests/hooks/hook-logger.test.ts and other shared-module hook tests.
const { resolveBin, binProjectRoot } = (await import(
  path.resolve(".claude/hooks/scripts/resolve-bin.js")
)) as {
  resolveBin: (toolName: string, startDir?: string) => string | null;
  binProjectRoot: (entryPath: string) => string;
};

describe("resolveBin", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const dir of tmpDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves tsc to its real JS entry point (not the .cmd/.bin shim)", () => {
    const entry = resolveBin("tsc", REPO_ROOT);
    expect(entry).not.toBeNull();
    expect(fs.existsSync(entry as string)).toBe(true);
    // Must be the real JS entry under the `typescript` package, never the
    // node_modules/.bin/tsc(.cmd) shim — that's the whole point (see
    // resolve-bin.js header comment on CVE-2024-27980).
    expect(entry).toMatch(/typescript[\\/]bin[\\/]tsc$/);
    expect(entry).not.toMatch(/\.(cmd|bat)$/);
  });

  it("resolves eslint to its real JS entry point", () => {
    const entry = resolveBin("eslint", REPO_ROOT);
    expect(entry).not.toBeNull();
    expect(fs.existsSync(entry as string)).toBe(true);
    expect(entry).toMatch(/eslint[\\/]bin[\\/]eslint\.js$/);
  });

  it("returns null when the package is not installed locally (prettier)", () => {
    // This repo does not depend on prettier — resolveBin must fall back to
    // null (not throw) so callers can use their existing npx fallback.
    const entry = resolveBin("prettier", REPO_ROOT);
    expect(entry).toBeNull();
  });

  it("returns null for a completely unknown tool name", () => {
    const entry = resolveBin("definitely-not-a-real-cli-tool-xyz", REPO_ROOT);
    expect(entry).toBeNull();
  });

  it("walks up from a nested subdirectory to find the same install", () => {
    const nestedDir = path.join(REPO_ROOT, "tests", "hooks");
    const fromNested = resolveBin("tsc", nestedDir);
    const fromRoot = resolveBin("tsc", REPO_ROOT);
    expect(fromNested).toBe(fromRoot);
  });

  it("returns null when starting outside any node_modules tree", () => {
    const isolated = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-resolve-bin-"));
    tmpDirs.push(isolated);
    const entry = resolveBin("tsc", isolated);
    expect(entry).toBeNull();
  });

  it("does not throw when node_modules/<pkg>/package.json is malformed JSON", () => {
    const isolated = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-resolve-bin-"));
    tmpDirs.push(isolated);
    const pkgDir = path.join(isolated, "node_modules", "typescript");
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, "package.json"), "{ not valid json ");
    expect(() => resolveBin("tsc", isolated)).not.toThrow();
    expect(resolveBin("tsc", isolated)).toBeNull();
  });

  it("falls back to null when the declared bin entry file does not exist on disk", () => {
    const isolated = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-resolve-bin-"));
    tmpDirs.push(isolated);
    const pkgDir = path.join(isolated, "node_modules", "typescript");
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, "package.json"),
      JSON.stringify({ name: "typescript", bin: { tsc: "./bin/tsc" } }),
    );
    // Deliberately do NOT create bin/tsc on disk.
    expect(resolveBin("tsc", isolated)).toBeNull();
  });
});

describe("binProjectRoot", () => {
  it("returns the directory containing node_modules for a resolved entry", () => {
    const tscEntry = resolveBin("tsc", REPO_ROOT);
    expect(tscEntry).not.toBeNull();
    const root = binProjectRoot(tscEntry as string);
    expect(path.resolve(root)).toBe(path.resolve(REPO_ROOT));
  });

  // Build fake ABSOLUTE paths from the platform's real filesystem root.
  // The previous fixtures used path.join("C:", ...), which is absolute only
  // on Windows — on POSIX "C:/some/project" is a RELATIVE path, so
  // binProjectRoot's path.resolve() prepended process.cwd() and the
  // assertion failed on Linux/macOS. path.parse(cwd).root is "C:\\" on
  // Windows and "/" on POSIX, keeping the fixture absolute everywhere.
  const FS_ROOT = path.parse(process.cwd()).root;

  it("handles a scoped-package-style nested entry path", () => {
    const fakeEntry = path.join(
      FS_ROOT,
      "some",
      "project",
      "node_modules",
      "@scope",
      "pkg",
      "bin",
      "cli.js",
    );
    const root = binProjectRoot(fakeEntry);
    expect(root).toBe(path.join(FS_ROOT, "some", "project"));
  });

  it("falls back to the entry's own directory when no node_modules ancestor exists", () => {
    const fakeEntry = path.join(FS_ROOT, "standalone", "cli.js");
    const root = binProjectRoot(fakeEntry);
    expect(root).toBe(path.join(FS_ROOT, "standalone"));
  });
});
