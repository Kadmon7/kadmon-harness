// Kadmon Harness — /release Step 1.2: version-bump (ADR-037, plan-037 Wave 1)
// Pure semver computation + idempotent dual-file write (plugin.json canonical, package.json mirror).
import fs from "node:fs";
import path from "node:path";
const VERSION_PART_RE = /^\d+$/;
/**
 * Typed domain error for this module (patterns.md: "MUST use typed error classes
 * for domain errors"). Implements the shared ReleaseError shape so callers can
 * narrow on `.code` without depending on this class specifically.
 */
export class ReleaseValidationError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = "ReleaseValidationError";
    }
}
/**
 * Splits a plain `X.Y.Z` version string into three non-negative integers.
 * No pre-release/build metadata support — matches the repo's plain-version convention.
 */
function parseVersion(current) {
    const parts = current.split(".");
    const isValid = parts.length === 3 && parts.every((part) => VERSION_PART_RE.test(part));
    if (!isValid) {
        throw new ReleaseValidationError("BAD_VERSION", `Malformed version "${current}": expected "X.Y.Z" with three numeric parts`);
    }
    const [major, minor, patch] = parts.map(Number);
    return [major, minor, patch];
}
export function computeNextVersion(current, level) {
    const [major, minor, patch] = parseVersion(current);
    if (level === "patch")
        return `${major}.${minor}.${patch + 1}`;
    if (level === "minor")
        return `${major}.${minor + 1}.0`;
    return `${major + 1}.0.0`;
}
/**
 * Reads + parses a JSON file, converting both read failures (e.g. missing file)
 * and parse failures (e.g. a half-written file left by a crash mid-write) into a
 * typed ReleaseValidationError("IO", ...) naming the file — never a raw path-less
 * SyntaxError (patterns.md: "MUST include context: what failed, why, what input").
 */
function readJsonFile(filePath) {
    let raw;
    try {
        raw = fs.readFileSync(filePath, "utf8");
    }
    catch (e) {
        throw new ReleaseValidationError("IO", `Cannot read ${filePath}: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
        return JSON.parse(raw);
    }
    catch (e) {
        throw new ReleaseValidationError("IO", `Malformed JSON in ${filePath}: ${e instanceof Error ? e.message : String(e)}`);
    }
}
/**
 * Writes `target` into the JSON object's existing `version` key and serializes
 * with a 2-space indent + single trailing newline, matching the repo's existing
 * plugin.json/package.json formatting. Spreading preserves original key order
 * (an already-present key keeps its original slot rather than moving to the end).
 */
function writeVersionedJson(filePath, json, target) {
    const updated = { ...json, version: target };
    const serialized = `${JSON.stringify(updated, null, 2)}\n`;
    fs.writeFileSync(filePath, serialized, "utf8");
}
function toRelative(cwd, filePath) {
    return path.relative(cwd, filePath).replace(/\\/g, "/");
}
export function applyVersionBump(ctx, target) {
    const pluginPath = path.join(ctx.cwd, ".claude-plugin", "plugin.json");
    const packagePath = path.join(ctx.cwd, "package.json");
    let pluginJson;
    let packageJson;
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
    }
    catch (e) {
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
