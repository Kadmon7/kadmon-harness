// Shared module: dist/ staleness detection and auto-rebuild.
// Used by lifecycle hooks to ensure dist/ is fresh before importing.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

/**
 * Check if dist/scripts/lib/ is stale relative to scripts/lib/.
 * Compares max mtime of source .ts files vs min mtime of dist .js files.
 * @param {string} rootDir - Project root directory
 * @returns {{ stale: boolean, reason: string }}
 */
export function isDistStale(rootDir) {
  const srcDir = path.join(rootDir, "scripts", "lib");
  const distDir = path.join(rootDir, "dist", "scripts", "lib");

  if (!fs.existsSync(distDir)) {
    return { stale: true, reason: "dist/ missing" };
  }

  let srcFiles;
  try {
    srcFiles = fs
      .readdirSync(srcDir)
      .filter((f) => f.endsWith(".ts"));
  } catch {
    // No source dir — nothing to compare
    return { stale: false, reason: "no source files" };
  }

  if (srcFiles.length === 0) {
    return { stale: false, reason: "no source files" };
  }

  let distFiles;
  try {
    distFiles = fs
      .readdirSync(distDir)
      .filter((f) => f.endsWith(".js"));
  } catch {
    return { stale: true, reason: "dist/ missing" };
  }

  if (distFiles.length === 0) {
    return { stale: true, reason: "dist/ empty" };
  }

  // Max mtime of source files
  let maxSrcMtime = 0;
  for (const f of srcFiles) {
    const mt = fs.statSync(path.join(srcDir, f)).mtimeMs;
    if (mt > maxSrcMtime) maxSrcMtime = mt;
  }

  // Min mtime of dist files
  let minDistMtime = Infinity;
  for (const f of distFiles) {
    const mt = fs.statSync(path.join(distDir, f)).mtimeMs;
    if (mt < minDistMtime) minDistMtime = mt;
  }

  // 1s tolerance for filesystem precision
  if (maxSrcMtime > minDistMtime + 1000) {
    return { stale: true, reason: "dist/ stale" };
  }

  return { stale: false, reason: "dist/ up to date" };
}

/**
 * Ensure dist/ is fresh. If stale, run npm run build.
 * Never throws — wraps in try/catch.
 * @param {string} rootDir - Project root directory
 * @returns {{ rebuilt: boolean, durationMs: number, error?: string }}
 */
export function ensureDist(rootDir) {
  try {
    const check = isDistStale(rootDir);
    if (!check.stale) {
      return { rebuilt: false, durationMs: 0 };
    }

    const start = Date.now();
    // execSync is safe here — command is hardcoded, no user input
    execSync("npm run build", {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30_000,
    });
    return { rebuilt: true, durationMs: Date.now() - start };
  } catch (err) {
    return {
      rebuilt: false,
      durationMs: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
