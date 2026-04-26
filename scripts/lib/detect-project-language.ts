// Kadmon Harness — Runtime language detection (ADR-020) + skanner profile detection (ADR-031)
// Detects project language from filesystem markers or env var override.
// Exports: detectProjectLanguage, getToolchain, ProjectLanguage, Toolchain
//          detectSkannerProfile, SkannerProfile

import fs from "node:fs";
import path from "node:path";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProjectLanguage = "typescript" | "python" | "mixed" | "unknown";

export interface Toolchain {
  language: ProjectLanguage;
  build: string | null;
  typecheck: string | null;
  test: string;
  lint: string;
  audit: string | null;
  depsFile: string;
  testFilePattern: RegExp;
  codeExtensions: readonly string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_LANGUAGES: ReadonlySet<string> = new Set([
  "typescript",
  "python",
  "mixed",
  "unknown",
]);

function isProjectLanguage(value: string): value is ProjectLanguage {
  return VALID_LANGUAGES.has(value);
}

const TS_CODE_EXTENSIONS: readonly string[] = [".ts", ".tsx", ".js", ".jsx"];
const PY_CODE_EXTENSIONS: readonly string[] = [".py"];

// Matches: *.test.ts, *.spec.ts, *.test.js, *.spec.js,
//          *.test.tsx, *.spec.tsx, *.test.jsx, *.spec.jsx
const TS_TEST_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx)$/;

// Matches: test_*.py (anchored)
const PY_TEST_PATTERN = /^test_.*\.py$/;

// ─── Filesystem helpers ───────────────────────────────────────────────────────

function safeExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
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
export function detectProjectLanguage(cwd: string = process.cwd()): ProjectLanguage {
  const rawEnvVal = process.env["KADMON_PROJECT_LANGUAGE"];
  // Normalize Windows CR / whitespace / case before whitelist check
  const envVal = rawEnvVal?.trim().toLowerCase() ?? "";

  // Override path — valid env value only; type guard narrows string → ProjectLanguage
  if (envVal && isProjectLanguage(envVal)) {
    process.stderr.write(
      JSON.stringify({ source: "override", language: envVal, markers: [] }) + "\n"
    );
    return envVal;
  }

  // Marker-based detection
  const hasPackageJson = safeExists(path.join(cwd, "package.json"));
  const hasPyprojectToml = safeExists(path.join(cwd, "pyproject.toml"));
  const hasRequirementsTxt = safeExists(path.join(cwd, "requirements.txt"));

  const hasTsMarker = hasPackageJson;
  const hasPyMarker = hasPyprojectToml || hasRequirementsTxt;

  const markers: string[] = [];
  if (hasPackageJson) markers.push("package.json");
  if (hasPyprojectToml) markers.push("pyproject.toml");
  if (hasRequirementsTxt) markers.push("requirements.txt");

  let language: ProjectLanguage;
  if (hasTsMarker && hasPyMarker) {
    language = "mixed";
  } else if (hasTsMarker) {
    language = "typescript";
  } else if (hasPyMarker) {
    language = "python";
  } else {
    language = "unknown";
  }

  process.stderr.write(
    JSON.stringify({ source: "markers", language, markers }) + "\n"
  );
  return language;
}

// ─── Skanner profile detection (ADR-031) ─────────────────────────────────────

/**
 * The three runtime profiles for /skanner, kartograf, and arkonte.
 * - harness: Kadmon Harness codebase (hook lifecycle, sql.js, session/instinct)
 * - web:     React/Next/Vite/FastAPI/Django consumer project
 * - cli:     CLI/library package (bin field, no UI deps)
 */
export type SkannerProfile = "harness" | "web" | "cli";

const VALID_SKANNER_PROFILES: ReadonlySet<string> = new Set([
  "harness",
  "web",
  "cli",
]);

function isSkannerProfile(value: string): value is SkannerProfile {
  return VALID_SKANNER_PROFILES.has(value);
}

/** Web UI dependency names to detect in package.json. */
const WEB_DEPS: ReadonlySet<string> = new Set(["react", "next", "vite"]);

/**
 * Detects the /skanner runtime profile for the project at `cwd`.
 *
 * Precedence (top wins):
 *  1. `explicitArg` — validated against whitelist ['harness','web','cli']
 *  2. `KADMON_SKANNER_PROFILE` env var — trim + lowercase + whitelist
 *  3. Harness markers — presence of any of:
 *       scripts/lib/state-store.ts  |  hooks/observe-pre.ts  |  data/observations.jsonl
 *  4. Web markers — package.json deps include react|next|vite,
 *                   OR pyproject.toml text includes 'fastapi'|'django'
 *  5. CLI markers — package.json has a `bin` field AND no web deps matched
 *  6. Fallback — 'web' (most common consumer scenario, per ADR-031)
 *
 * Always writes one stderr diagnostic JSON line: { source, profile, markers }.
 * source ∈ { 'arg', 'env', 'markers' }
 *
 * @param cwd         Root of the consumer project (defaults to process.cwd())
 * @param explicitArg Profile override passed directly by the caller (e.g. /skanner arg)
 */
export function detectSkannerProfile(
  cwd: string = process.cwd(),
  explicitArg?: string
): SkannerProfile {
  // ── 1. Explicit arg (highest priority) ─────────────────────────────────────
  if (explicitArg !== undefined) {
    const normalized = explicitArg.trim().toLowerCase();
    if (isSkannerProfile(normalized)) {
      process.stderr.write(
        JSON.stringify({ source: "arg", profile: normalized, markers: [] }) + "\n"
      );
      return normalized;
    }
    // Invalid arg — fall through to next precedence level
  }

  // ── 2. Env var override ────────────────────────────────────────────────────
  const rawEnv = process.env["KADMON_SKANNER_PROFILE"];
  const envVal = rawEnv?.trim().toLowerCase() ?? "";
  if (envVal && isSkannerProfile(envVal)) {
    process.stderr.write(
      JSON.stringify({ source: "env", profile: envVal, markers: [] }) + "\n"
    );
    return envVal;
  }

  // ── 3. Harness marker scan ─────────────────────────────────────────────────
  const HARNESS_MARKERS: ReadonlyArray<{ name: string }> = [
    { name: "scripts/lib/state-store.ts" },
    { name: "hooks/observe-pre.ts" },
    { name: "data/observations.jsonl" },
  ];
  const foundHarnessMarkers: string[] = HARNESS_MARKERS
    .filter((m) => safeExists(path.join(cwd, m.name)))
    .map((m) => m.name);

  if (foundHarnessMarkers.length > 0) {
    process.stderr.write(
      JSON.stringify({ source: "markers", profile: "harness", markers: foundHarnessMarkers }) + "\n"
    );
    return "harness";
  }

  // ── 4. Web marker scan ────────────────────────────────────────────────────
  const webMarkers: string[] = [];
  let hasBinField = false;

  // 4a. package.json — check deps & devDeps for web UI libs; also capture bin
  const pkgPath = path.join(cwd, "package.json");
  if (safeExists(pkgPath)) {
    try {
      const raw = fs.readFileSync(pkgPath, "utf8");
      const pkg = JSON.parse(raw) as Record<string, unknown>;
      const deps: Record<string, unknown> =
        (pkg["dependencies"] as Record<string, unknown> | undefined) ?? {};
      const devDeps: Record<string, unknown> =
        (pkg["devDependencies"] as Record<string, unknown> | undefined) ?? {};
      const allDepKeys = new Set([...Object.keys(deps), ...Object.keys(devDeps)]);

      for (const dep of allDepKeys) {
        if (WEB_DEPS.has(dep)) {
          webMarkers.push(`package.json: ${dep}`);
        }
      }

      hasBinField = pkg["bin"] !== undefined && pkg["bin"] !== null;
    } catch {
      // Malformed JSON — treat as if file absent
    }
  }

  // 4b. pyproject.toml — substring search for fastapi / django
  const pyprojectPath = path.join(cwd, "pyproject.toml");
  if (safeExists(pyprojectPath)) {
    try {
      const content = fs.readFileSync(pyprojectPath, "utf8").toLowerCase();
      if (content.includes("fastapi")) webMarkers.push("pyproject.toml: fastapi");
      if (content.includes("django")) webMarkers.push("pyproject.toml: django");
    } catch {
      // Unreadable — skip
    }
  }

  if (webMarkers.length > 0) {
    process.stderr.write(
      JSON.stringify({ source: "markers", profile: "web", markers: webMarkers }) + "\n"
    );
    return "web";
  }

  // ── 5. CLI marker ─────────────────────────────────────────────────────────
  if (hasBinField) {
    process.stderr.write(
      JSON.stringify({ source: "markers", profile: "cli", markers: ["package.json: bin"] }) + "\n"
    );
    return "cli";
  }

  // ── 6. Fallback ───────────────────────────────────────────────────────────
  process.stderr.write(
    JSON.stringify({ source: "markers", profile: "web", markers: [] }) + "\n"
  );
  return "web";
}

// ─── Toolchain factory ────────────────────────────────────────────────────────

const TS_BASE: Omit<Toolchain, "language"> = {
  build: "npm run build",
  typecheck: "npx tsc --noEmit",
  test: "npx vitest run",
  lint: "npx eslint .",
  audit: "npm audit",
  depsFile: "package.json",
  testFilePattern: TS_TEST_PATTERN,
  codeExtensions: TS_CODE_EXTENSIONS,
};

const PY_BASE: Omit<Toolchain, "language"> = {
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
export function getToolchain(cwd: string = process.cwd()): Toolchain {
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
