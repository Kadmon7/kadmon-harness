// Shared binary resolver for hooks that spawn a Node-based CLI tool
// (tsc, eslint, prettier). AUD-31 — real latency optimization for the
// toolchain-spawning PostToolUse hooks (post-edit-typecheck, quality-gate,
// post-edit-format), which previously resolved these tools via `npx`,
// re-doing npm's resolution work on every single Edit/Write.
//
// This module resolves a tool to its ACTUAL JS entry point — the file
// declared in the owning package's own `package.json` "bin" field — not
// the `node_modules/.bin/<tool>` shim. That choice is deliberate, not
// cosmetic:
//
//   On Windows, Node's CVE-2024-27980 fix made `execFileSync`/`spawnSync`
//   refuse (EINVAL) to launch a `.cmd`/`.bat` file directly unless
//   `shell: true` is passed. Passing `shell: true` re-opens the exact
//   command-injection class that CVE fixed (cmd.exe re-parses the
//   already-quoted argv with its OWN metacharacter rules). So neither
//   "spawn the .bin/<tool>.cmd shim directly" nor "spawn it with
//   shell: true" is both safe AND functional on Windows.
//
//   Invoking the real JS entry via
//   `execFileSync(process.execPath, [entry, ...args])` sidesteps the
//   shell entirely on every platform — `node <file>` is a plain, safe
//   execFileSync call with array args, same shape the codebase already
//   uses everywhere else. No `.cmd`/`.bat`, no shell, no injection surface.
//
// Falls back to `null` when no local install is resolved so callers can
// preserve their existing "tool not installed" behavior (npx fallback or
// a warning), exactly as before this optimization.
import fs from "node:fs";
import path from "node:path";

// CLI tool name -> owning npm package name (only differs for tsc).
const BIN_PACKAGE = {
  tsc: "typescript",
  eslint: "eslint",
  prettier: "prettier",
};

function readBinEntry(pkgJsonPath, toolName) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    const bin = pkg.bin;
    let relEntry = null;
    if (typeof bin === "string") {
      relEntry = bin;
    } else if (bin && typeof bin === "object") {
      relEntry = bin[toolName] ?? Object.values(bin)[0] ?? null;
    }
    if (!relEntry || typeof relEntry !== "string") return null;
    const pkgDir = path.dirname(pkgJsonPath);
    const absEntry = path.resolve(pkgDir, relEntry);
    return fs.existsSync(absEntry) ? absEntry : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a locally-installed CLI tool to its real JS entry point by
 * walking up from `startDir` the same way Node resolves `node_modules`
 * (nearest wins). Returns null when no local install is found anywhere
 * up the tree — callers should fall back to their existing behavior.
 */
export function resolveBin(toolName, startDir = process.cwd()) {
  const packageName = BIN_PACKAGE[toolName] ?? toolName;
  let dir = path.resolve(startDir);
  while (true) {
    const pkgJsonPath = path.join(dir, "node_modules", packageName, "package.json");
    if (fs.existsSync(pkgJsonPath)) {
      const entry = readBinEntry(pkgJsonPath, toolName);
      if (entry) return entry;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Given a resolved bin entry path (as returned by resolveBin), find the
 * project root — the directory that directly contains the `node_modules`
 * this entry lives under. Used to anchor cache files (e.g. tsc's
 * --incremental buildinfo) beside the real install rather than whatever
 * directory the hook happened to be invoked from.
 */
export function binProjectRoot(entryPath) {
  let dir = path.dirname(path.resolve(entryPath));
  while (true) {
    if (path.basename(dir) === "node_modules") return path.dirname(dir);
    const parent = path.dirname(dir);
    if (parent === dir) return path.dirname(path.resolve(entryPath));
    dir = parent;
  }
}
