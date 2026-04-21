// Kadmon Harness — Runtime language detection (ADR-020)
// Detects project language from filesystem markers or env var override.
// Exports: detectProjectLanguage, getToolchain, ProjectLanguage, Toolchain
import fs from "node:fs";
import path from "node:path";
// ─── Constants ────────────────────────────────────────────────────────────────
const VALID_LANGUAGES = new Set([
    "typescript",
    "python",
    "mixed",
    "unknown",
]);
function isProjectLanguage(value) {
    return VALID_LANGUAGES.has(value);
}
const TS_CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
const PY_CODE_EXTENSIONS = [".py"];
// Matches: *.test.ts, *.spec.ts, *.test.js, *.spec.js,
//          *.test.tsx, *.spec.tsx, *.test.jsx, *.spec.jsx
const TS_TEST_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx)$/;
// Matches: test_*.py (anchored)
const PY_TEST_PATTERN = /^test_.*\.py$/;
// ─── Filesystem helpers ───────────────────────────────────────────────────────
function safeExists(filePath) {
    try {
        return fs.existsSync(filePath);
    }
    catch {
        return false;
    }
}
// ─── Detection ────────────────────────────────────────────────────────────────
/**
 * Detects the primary language of the project at `cwd`.
 *
 * Priority:
 *  1. KADMON_PROJECT_LANGUAGE env var (valid values only).
 *  2. Filesystem marker scan (package.json / pyproject.toml / requirements.txt).
 *
 * Always writes one stderr diagnostic JSON line per call.
 */
export function detectProjectLanguage(cwd = process.cwd()) {
    const rawEnvVal = process.env["KADMON_PROJECT_LANGUAGE"];
    // Normalize Windows CR / whitespace / case before whitelist check
    const envVal = rawEnvVal?.trim().toLowerCase() ?? "";
    // Override path — valid env value only; type guard narrows string → ProjectLanguage
    if (envVal && isProjectLanguage(envVal)) {
        process.stderr.write(JSON.stringify({ source: "override", language: envVal, markers: [] }) + "\n");
        return envVal;
    }
    // Marker-based detection
    const hasPackageJson = safeExists(path.join(cwd, "package.json"));
    const hasPyprojectToml = safeExists(path.join(cwd, "pyproject.toml"));
    const hasRequirementsTxt = safeExists(path.join(cwd, "requirements.txt"));
    const hasTsMarker = hasPackageJson;
    const hasPyMarker = hasPyprojectToml || hasRequirementsTxt;
    const markers = [];
    if (hasPackageJson)
        markers.push("package.json");
    if (hasPyprojectToml)
        markers.push("pyproject.toml");
    if (hasRequirementsTxt)
        markers.push("requirements.txt");
    let language;
    if (hasTsMarker && hasPyMarker) {
        language = "mixed";
    }
    else if (hasTsMarker) {
        language = "typescript";
    }
    else if (hasPyMarker) {
        language = "python";
    }
    else {
        language = "unknown";
    }
    process.stderr.write(JSON.stringify({ source: "markers", language, markers }) + "\n");
    return language;
}
// ─── Toolchain factory ────────────────────────────────────────────────────────
const TS_BASE = {
    build: "npm run build",
    typecheck: "npx tsc --noEmit",
    test: "npx vitest run",
    lint: "npx eslint .",
    audit: "npm audit",
    depsFile: "package.json",
    testFilePattern: TS_TEST_PATTERN,
    codeExtensions: TS_CODE_EXTENSIONS,
};
const PY_BASE = {
    build: null,
    typecheck: "mypy .",
    test: "pytest",
    lint: "ruff check . && black --check .",
    audit: "pip-audit",
    depsFile: "pyproject.toml",
    testFilePattern: PY_TEST_PATTERN,
    codeExtensions: PY_CODE_EXTENSIONS,
};
/**
 * Returns the toolchain configuration for the project at `cwd`.
 * mixed and unknown fall back to the TypeScript toolchain (conservative default).
 */
export function getToolchain(cwd = process.cwd()) {
    const language = detectProjectLanguage(cwd);
    switch (language) {
        case "python":
            return { language, ...PY_BASE };
        case "typescript":
            return { language, ...TS_BASE };
        case "mixed":
            return { language, ...TS_BASE };
        case "unknown":
            return { language, ...TS_BASE };
    }
}
