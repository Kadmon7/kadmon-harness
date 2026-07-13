// Kadmon Harness — /release Step 1.2: version-bump (ADR-037, plan-037 Wave 1)
// Pure semver computation + idempotent dual-file write (plugin.json canonical, package.json mirror).

import fs from "node:fs";
import path from "node:path";
import type {
  BumpLevel,
  ReleaseContext,
  ReleaseError,
  ReleaseErrorCode,
  StepResult,
} from "./types.js";

const VERSION_PART_RE = /^\d+$/;

/**
 * Typed domain error for this module (patterns.md: "MUST use typed error classes
 * for domain errors"). Implements the shared ReleaseError shape so callers can
 * narrow on `.code` without depending on this class specifically.
 */
export class ReleaseValidationError extends Error implements ReleaseError {
  readonly code: ReleaseErrorCode;

  constructor(code: ReleaseErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ReleaseValidationError";
  }
}

/**
 * Splits a plain `X.Y.Z` version string into three non-negative integers.
 * No pre-release/build metadata support — matches the repo's plain-version convention.
 */
function parseVersion(current: string): readonly [number, number, number] {
  const parts = current.split(".");
  const isValid = parts.length === 3 && parts.every((part) => VERSION_PART_RE.test(part));

  if (!isValid) {
    throw new ReleaseValidationError(
      "BAD_VERSION",
      `Malformed version "${current}": expected "X.Y.Z" with three numeric parts`,
    );
  }

  const [major, minor, patch] = parts.map(Number);
  return [major, minor, patch] as const;
}

export function computeNextVersion(current: string, level: BumpLevel): string {
  const [major, minor, patch] = parseVersion(current);

  if (level === "patch") return `${major}.${minor}.${patch + 1}`;
  if (level === "minor") return `${major}.${minor + 1}.0`;
  return `${major + 1}.0.0`;
}

/**
 * Reads + parses a JSON file, converting both read failures (e.g. missing file)
 * and parse failures (e.g. a half-written file left by a crash mid-write) into a
 * typed ReleaseValidationError("IO", ...) naming the file — never a raw path-less
 * SyntaxError (patterns.md: "MUST include context: what failed, why, what input").
 */
function readJsonFile(filePath: string): Record<string, unknown> {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (e: unknown) {
    throw new ReleaseValidationError(
      "IO",
      `Cannot read ${filePath}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (e: unknown) {
    throw new ReleaseValidationError(
      "IO",
      `Malformed JSON in ${filePath}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * Writes `target` into the JSON object's existing `version` key and serializes
 * with a 2-space indent + single trailing newline, matching the repo's existing
 * plugin.json/package.json formatting. Spreading preserves original key order
 * (an already-present key keeps its original slot rather than moving to the end).
 */
function writeVersionedJson(filePath: string, json: Record<string, unknown>, target: string): void {
  const updated = { ...json, version: target };
  const serialized = `${JSON.stringify(updated, null, 2)}\n`;
  fs.writeFileSync(filePath, serialized, "utf8");
}

function toRelative(cwd: string, filePath: string): string {
  return path.relative(cwd, filePath).replace(/\\/g, "/");
}

export function applyVersionBump(ctx: ReleaseContext, target: string): StepResult {
  const pluginPath = path.join(ctx.cwd, ".claude-plugin", "plugin.json");
  const packagePath = path.join(ctx.cwd, "package.json");

  let pluginJson: Record<string, unknown>;
  let packageJson: Record<string, unknown>;

  try {
    pluginJson = readJsonFile(pluginPath);

    if (pluginJson.version === target) {
      return {
        step: "version-bump",
        status: "skipped",
        message: `Version already at ${target}; no write needed`,
        filesTouched: [],
      };
    }

    packageJson = readJsonFile(packagePath);
  } catch (e: unknown) {
    if (e instanceof ReleaseValidationError && e.code === "IO") {
      return {
        step: "version-bump",
        status: "failed",
        message: e.message,
        filesTouched: [],
        details: { code: e.code, message: e.message },
      };
    }
    throw e;
  }

  writeVersionedJson(pluginPath, pluginJson, target);
  writeVersionedJson(packagePath, packageJson, target);

  return {
    step: "version-bump",
    status: "applied",
    message: `Bumped version to ${target} in plugin.json + package.json`,
    filesTouched: [toRelative(ctx.cwd, pluginPath), toRelative(ctx.cwd, packagePath)],
  };
}
