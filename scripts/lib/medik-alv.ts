// Kadmon Harness — ALV (Attach-Log-Verify) report generator for /medik --ALV flag.
// Generates a redacted diagnostic snapshot: install-diagnostic, hook-errors, fresh health.
// ADR-028 Phase 6 + spektr Chunk C hardening.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

import { readTypedInstallDiagnostics } from "./install-diagnostic-reader.js";
import { checkInstallHealth } from "./install-health.js";
import { readRotatingJsonlLog } from "./rotating-jsonl-log.js";

const GIT_TIMEOUT_MS = 3000;

// Escape a string for safe embedding inside a RegExp literal.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Return up to 3 escape variants of `p` for matching in text that may have
 * been through 0, 1, or 2 rounds of JSON.stringify (which doubles backslashes).
 * Deduplicates so POSIX paths (no backslashes) return only the raw form.
 */
function buildEscapeVariants(p: string): string[] {
  const json1x = p.replace(/\\/g, "\\\\");
  const json2x = json1x.replace(/\\/g, "\\\\");
  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of [json2x, json1x, p]) {
    if (!seen.has(v)) { seen.add(v); result.push(v); }
  }
  return result;
}

// Zod schema for entry records that expose a rootDir we should seed into redaction.
const rootDirSchema = z.object({ rootDir: z.string().min(1) }).passthrough();

// Matches Windows (C:\...) and POSIX (/...) absolute paths embedded in free-form strings.
// Used by harvestPathsFromString to catch paths in error/stack fields (spektr HIGH-1).
const ABS_PATH_RE = /(?:[A-Za-z]:(?:\\{1,4}|\/)|\/)[\w.\- ]+(?:(?:\\{1,4}|\/)[\w.\- ]+){1,}/g;

function harvestPathsFromString(s: unknown, out: Set<string>): void {
  if (typeof s !== "string" || s.length === 0) return;
  const m = s.match(ABS_PATH_RE);
  if (m) for (const p of m) out.add(path.dirname(p));
}

// Section-header forge prevention (spektr HIGH-2).
// A log entry whose string contains `=== SOMETHING ===` on its own line could forge a fake
// section boundary when embedded in the report. Indent any such line so the header is
// neutralized without losing the content.
const SECTION_FORGE_RE = /^\s*={3,}\s+[A-Z][A-Z0-9 _-]+\s+={3,}\s*$/m;

function sanitizeForReport(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => (SECTION_FORGE_RE.test(line) ? `  ${line}` : line))
    .join("\n");
}

/**
 * Redact sensitive path segments from `text`.
 *
 * REDACTION ORDER IS LOAD-BEARING. Do not reorder rules 1-6.
 * Rule 6 is the most permissive; it MUST run last so specific rules win.
 *
 * 1. homedir → `~`  (handles raw, JSON 1x, JSON 2x forms)
 * 2. additionalPaths (cross-project rootDirs, KADMON_RUNTIME_ROOT) → `<project-root>`
 * 3. Windows: `C:\Users\<segment>` → `C:\Users\<user>`  (1-4 backslash forms)
 * 4. macOS:   `/Users/<name>` → `/Users/<user>`
 * 5. Linux:   `/home/<name>` → `/home/<user>`
 * 6. cwd → `.`  (handles raw, JSON 1x, JSON 2x forms)
 * 7. catch-all absolute paths (>=3 segments, Windows or POSIX) → `<path>`
 */
export function redactSensitivePaths(
  text: string,
  cwd: string,
  homedir: string,
  additionalPaths: readonly string[] = [],
): string {
  let result = text;

  // 1. homedir in all serialization forms
  if (homedir) {
    for (const v of buildEscapeVariants(homedir)) {
      result = result.replace(new RegExp(escapeRegex(v), "g"), "~");
    }
  }

  // 2. Caller-supplied additional roots (cross-project rootDirs, KADMON_RUNTIME_ROOT)
  for (const extra of additionalPaths) {
    if (!extra) continue;
    for (const v of buildEscapeVariants(extra)) {
      result = result.replace(new RegExp(escapeRegex(v), "g"), "<project-root>");
    }
  }

  // 3. Remaining Windows User paths (any backslash count 1-4)
  result = result.replace(/C:(?:\\{1,4})Users(?:\\{1,4})[^\\/\s"]+/g, "C:\\Users\\<user>");

  // 4. macOS/BSD /Users/<name>
  result = result.replace(/\/Users\/[^/\s"]+/g, "/Users/<user>");

  // 5. Linux /home/<name>
  result = result.replace(/\/home\/[^/\s"]+/g, "/home/<user>");

  // 6. cwd in all serialization forms
  if (cwd) {
    for (const v of buildEscapeVariants(cwd)) {
      result = result.replace(new RegExp(escapeRegex(v), "g"), ".");
    }
  }

  // 7. Catch-all: absolute paths with 3+ segments not already caught above.
  //    Specific rules above win because they ran first.
  result = result.replace(
    /[A-Za-z]:(?:\\{1,4}|\/)[\w.\- ]+(?:(?:\\{1,4}|\/)[\w.\- ]+){2,}/g,
    "<path>",
  );
  result = result.replace(
    /(?<![\w/])\/(?:[\w.\- ]+\/){2,}[\w.\- ]+/g,
    "<path>",
  );

  return result;
}

function runGit(args: readonly string[], cwd: string): string {
  try {
    return execFileSync("git", args as string[], {
      encoding: "utf8",
      cwd,
      timeout: GIT_TIMEOUT_MS,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.slice(0, 100) : "unknown";
    return `(git unavailable: ${msg})`;
  }
}

function buildHeader(cwd: string): string {
  const timestamp = new Date().toISOString();
  const gitHead = runGit(["log", "-1", "--format=%H %s"], cwd);
  const gitBranch = runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);

  return [
    `timestamp:   ${timestamp}`,
    `platform:    ${process.platform}`,
    `nodeVersion: ${process.version}`,
    `gitBranch:   ${gitBranch}`,
    `gitHead:     ${gitHead}`,
  ].join("\n");
}

/**
 * Collect extra roots to seed redaction from diagnostic data + env.
 * Returns unique non-empty strings. Zod-guarded to tolerate schema drift.
 */
function collectAdditionalRoots(
  diagEntries: ReadonlyArray<unknown>,
  hookErrors: ReadonlyArray<unknown>,
): string[] {
  const roots = new Set<string>();

  for (const e of diagEntries) {
    const parsed = rootDirSchema.safeParse(e);
    if (parsed.success) roots.add(parsed.data.rootDir);
  }

  // Hook errors may carry file paths from other projects (multi-project session)
  for (const h of hookErrors) {
    if (typeof h !== "object" || h === null) continue;
    const obj = h as Record<string, unknown>;
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val !== "string" || val.length === 0) continue;
      if (/(?:Path|Dir|file|cwd)$/i.test(key) && path.isAbsolute(val)) {
        roots.add(path.dirname(val));
      }
    }
    // spektr HIGH-1: scan free-form error/stack/context for embedded absolute paths
    harvestPathsFromString(obj.error, roots);
    harvestPathsFromString(obj.stack, roots);
    harvestPathsFromString(obj.context, roots);
  }

  const runtimeRoot = process.env.KADMON_RUNTIME_ROOT;
  if (runtimeRoot) roots.add(runtimeRoot);

  return Array.from(roots);
}

/**
 * Generate a full ALV diagnostic report for `cwd`.
 * All paths are redacted before return — safe to share.
 */
export function generateAlvReport(cwd: string): string {
  const diagEntries = readTypedInstallDiagnostics(undefined, 10);
  const hookErrorsLogPath = path.join(os.homedir(), ".kadmon", "hook-errors.log");
  const hookErrors = readRotatingJsonlLog(hookErrorsLogPath, 10);
  const extraRoots = collectAdditionalRoots(diagEntries, hookErrors);

  // sanitizeForReport (spektr HIGH-2) neutralizes any `=== SECTION ===` forgery
  // attempts embedded in log entries before concatenation.
  const diagSection = diagEntries.length === 0
    ? "(no install-diagnostic entries)"
    : diagEntries.map((e) => sanitizeForReport(JSON.stringify(e, null, 2))).join("\n\n");

  const hookSection = hookErrors.length === 0
    ? "(no recent hook errors)"
    : hookErrors.map((e) => sanitizeForReport(JSON.stringify(e, null, 2))).join("\n\n");

  const healthSection = sanitizeForReport(JSON.stringify(checkInstallHealth(cwd), null, 2));

  const raw = [
    buildHeader(cwd),
    "\n\n=== INSTALL-DIAGNOSTIC ===\n\n" + diagSection,
    "\n\n=== HOOK-ERRORS ===\n\n" + hookSection,
    "\n\n=== FRESH-HEALTH ===\n\n" + healthSection,
  ].join("");

  return redactSensitivePaths(raw, cwd, os.homedir(), extraRoots);
}

/**
 * Write an ALV report to disk and return the absolute path written.
 *
 * @param cwd       - Project root (health checks + redaction anchor)
 * @param outputDir - Write directory. MUST be inside `cwd` or `os.tmpdir()`.
 *                    Test-only override; production callers should omit and
 *                    accept the default (`cwd`). Throws if outside containment.
 *
 * Filename: `diagnostic-YYYY-MM-DDTHHmm.txt`  |  Mode: 0o600
 * Write is atomic (O_EXCL); a pre-existing file or symlink at the target path
 * triggers a one-shot random suffix retry; a second collision is re-thrown.
 */
export function writeAlvReport(cwd: string, outputDir?: string): string {
  const content = generateAlvReport(cwd);

  // Containment: outputDir MUST resolve inside cwd OR inside os.tmpdir().
  const resolvedCwd = path.resolve(cwd);
  const resolvedTmp = path.resolve(os.tmpdir());
  const resolvedOut = path.resolve(outputDir ?? cwd);

  const insideCwd = resolvedOut === resolvedCwd
    || resolvedOut.startsWith(resolvedCwd + path.sep);
  const insideTmp = resolvedOut === resolvedTmp
    || resolvedOut.startsWith(resolvedTmp + path.sep);

  if (!insideCwd && !insideTmp) {
    throw new Error(
      `writeAlvReport: outputDir must be inside cwd or os.tmpdir() (got: ${outputDir ?? "(default cwd)"})`,
    );
  }

  const safeName = new Date().toISOString().slice(0, 16).replace(/:/g, "");
  let fullPath = path.join(resolvedOut, `diagnostic-${safeName}.txt`);

  let fd: number;
  try {
    fd = fs.openSync(
      fullPath,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
      0o600,
    );
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      // One-shot retry with random suffix to avoid confusing UX on sub-minute collisions.
      const suffix = Math.random().toString(36).slice(2, 8);
      fullPath = path.join(resolvedOut, `diagnostic-${safeName}-${suffix}.txt`);
      fd = fs.openSync(
        fullPath,
        fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
        0o600,
      );
    } else {
      throw err;
    }
  }

  try {
    fs.writeFileSync(fd, content);
  } finally {
    fs.closeSync(fd);
  }

  try { fs.chmodSync(fullPath, 0o600); } catch { /* ignore on Windows */ }

  return fullPath;
}
