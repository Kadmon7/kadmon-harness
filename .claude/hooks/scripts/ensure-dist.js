// Shared module: dist/ staleness detection and auto-rebuild.
// Used by lifecycle hooks to ensure dist/ is fresh before importing.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Resolve the project root directory from a hook script's import.meta.url.
 * Honors KADMON_RUNTIME_ROOT env var (set by plugin hooks.json to ${CLAUDE_PLUGIN_DATA})
 * with fallback to a 3-level relative walk for local-dev (env var unset/empty).
 * @param {string} metaUrl - The import.meta.url of the calling script
 * @returns {string} Absolute path to the directory that contains dist/scripts/lib/*.js
 */
export function resolveRootDir(metaUrl) {
  const envRoot = process.env.KADMON_RUNTIME_ROOT;
  if (envRoot && envRoot.length > 0) {
    return path.resolve(envRoot);
  }
  return path.resolve(fileURLToPath(new URL(".", metaUrl)), "..", "..", "..");
}

/**
 * Check if dist/scripts/lib/ is stale relative to scripts/lib/.
 * Per-file comparison: each src .ts must have a corresponding dist .js with
 * mtime >= src mtime. Orphan dist .js files (no .ts counterpart) are ignored
 * so deleted sources don't falsely mark dist as stale.
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
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"));
  } catch {
    return { stale: false, reason: "no source files" };
  }

  if (srcFiles.length === 0) {
    return { stale: false, reason: "no source files" };
  }

  // 1s tolerance for filesystem precision
  const TOLERANCE_MS = 1000;
  for (const srcFile of srcFiles) {
    const base = srcFile.slice(0, -3); // strip .ts
    const srcPath = path.join(srcDir, srcFile);
    const distPath = path.join(distDir, `${base}.js`);

    if (!fs.existsSync(distPath)) {
      return { stale: true, reason: `missing dist/${base}.js` };
    }

    const srcMtime = fs.statSync(srcPath).mtimeMs;
    const distMtime = fs.statSync(distPath).mtimeMs;
    if (srcMtime > distMtime + TOLERANCE_MS) {
      return { stale: true, reason: `${base}.js older than source` };
    }
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
    // Include stderr/stdout in the error message so hook-errors.log has
    // the actual build failure, not just "Command failed: npm run build".
    const baseMsg = err instanceof Error ? err.message : String(err);
    let details = "";
    if (err && typeof err === "object") {
      const stderr = err.stderr ? String(err.stderr).trim() : "";
      const stdout = err.stdout ? String(err.stdout).trim() : "";
      if (stderr) details += `\nstderr: ${stderr.slice(0, 500)}`;
      if (stdout) details += `\nstdout: ${stdout.slice(0, 500)}`;
    }
    return {
      rebuilt: false,
      durationMs: 0,
      error: baseMsg + details,
    };
  }
}
