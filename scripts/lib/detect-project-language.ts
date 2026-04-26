// Kadmon Harness — Runtime language detection (ADR-020) + project profile detection (ADR-031, ADR-032, ADR-033)
//                  + diff-scope classification (ADR-034)
// Detects project language and runtime profile from filesystem markers or env var override.
// Exports: detectProjectLanguage, getToolchain, ProjectLanguage, Toolchain
//          detectProjectProfile, ProjectProfile (renamed from detectSkannerProfile/SkannerProfile per ADR-032)
//          detectSkannerProfile, SkannerProfile (deprecated aliases preserved for plan-031 callers)
//          detectMedikProfile, MedikProfile (/medik diagnostic-banner adapter, ADR-033)
//          getDiffScope, DiffScope (diff-content classifier for /chekpoint Phase 1 + Phase 2a, ADR-034)

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

// ─── Project profile detection (ADR-031 + ADR-032) ───────────────────────────

/**
 * The three runtime profiles for /skanner, kartograf, arkonte, and /doks.
 * - harness: Kadmon Harness codebase (hook lifecycle, sql.js, session/instinct)
 * - web:     React/Next/Vite/FastAPI/Django consumer project
 * - cli:     CLI/library package (bin field, no UI deps)
 */
export type ProjectProfile = "harness" | "web" | "cli";

/**
 * @deprecated Use ProjectProfile (alias preserved for plan-031 imports).
 */
export type SkannerProfile = ProjectProfile;

const VALID_PROJECT_PROFILES: ReadonlySet<string> = new Set([
  "harness",
  "web",
  "cli",
]);

function isProjectProfile(value: string): value is ProjectProfile {
  return VALID_PROJECT_PROFILES.has(value);
}

/** Web UI dependency names to detect in package.json. */
const WEB_DEPS: ReadonlySet<string> = new Set(["react", "next", "vite"]);

/**
 * Detects the runtime profile for the project at `cwd`.
 *
 * Precedence (top wins):
 *  1. `explicitArg` — validated against whitelist ['harness','web','cli']
 *  2. `KADMON_PROJECT_PROFILE` env var (umbrella, ADR-032) — trim + lowercase + whitelist
 *  3. `KADMON_SKANNER_PROFILE` env var (back-compat, ADR-031) — same normalization
 *  4. Harness markers — presence of any of:
 *       scripts/lib/state-store.ts  |  hooks/observe-pre.ts  |  data/observations.jsonl
 *  5. Web markers — package.json deps include react|next|vite,
 *                   OR pyproject.toml text includes 'fastapi'|'django'
 *  6. CLI markers — package.json has a `bin` field AND no web deps matched
 *  7. Fallback — 'web' (most common consumer scenario, per ADR-031)
 *
 * Always writes one stderr diagnostic JSON line: { source, profile, markers }.
 * source ∈ { 'arg', 'env', 'markers' }
 *
 * @param cwd         Root of the consumer project (defaults to process.cwd())
 * @param explicitArg Profile override passed directly by the caller (e.g. /skanner arg)
 */
export function detectProjectProfile(
  cwd: string = process.cwd(),
  explicitArg?: string
): ProjectProfile {
  // ── 1. Explicit arg (highest priority) ─────────────────────────────────────
  if (explicitArg !== undefined) {
    const normalized = explicitArg.trim().toLowerCase();
    if (isProjectProfile(normalized)) {
      process.stderr.write(
        JSON.stringify({ source: "arg", profile: normalized, markers: [] }) + "\n"
      );
      return normalized;
    }
    // Invalid arg — fall through to next precedence level
  }

  // ── 2. Env var override (umbrella, then back-compat) ───────────────────────
  // KADMON_PROJECT_PROFILE wins over KADMON_SKANNER_PROFILE per ADR-032.
  const umbrellaRaw = process.env["KADMON_PROJECT_PROFILE"];
  const umbrellaVal = umbrellaRaw?.trim().toLowerCase() ?? "";
  if (umbrellaVal && isProjectProfile(umbrellaVal)) {
    process.stderr.write(
      JSON.stringify({ source: "env", profile: umbrellaVal, markers: [] }) + "\n"
    );
    return umbrellaVal;
  }

  const skannerRaw = process.env["KADMON_SKANNER_PROFILE"];
  const envVal = skannerRaw?.trim().toLowerCase() ?? "";
  if (envVal && isProjectProfile(envVal)) {
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

/**
 * @deprecated Use detectProjectProfile (alias preserved for plan-031 callers).
 * Function reference is identical, so behavior is preserved exactly.
 */
export const detectSkannerProfile = detectProjectProfile;

// ─── /medik diagnostic-banner profile (ADR-033) ───────────────────────────────

/**
 * Two-value profile for /medik diagnostic banner (ADR-033).
 * Collapses web|cli → consumer; harness stays harness.
 * Used as DIAGNOSTIC HINT only — never as a per-check skip gate.
 */
export type MedikProfile = "harness" | "consumer";

/**
 * Returns the /medik diagnostic-banner profile for the project at `cwd`.
 *
 * Precedence (top wins):
 *  1. `explicitArg` — validated against ['harness','consumer']
 *  2. `KADMON_MEDIK_PROFILE` env var — trim + lowercase + whitelist
 *  3. delegate to detectProjectProfile() and collapse 'web'|'cli' → 'consumer'
 *
 * NOT consumed by any runCheck() as a skip gate — diagnostic only (ADR-033).
 */
export function detectMedikProfile(
  cwd: string = process.cwd(),
  explicitArg?: string,
): MedikProfile {
  // 1. Explicit arg
  if (explicitArg !== undefined) {
    const normalized = explicitArg.trim().toLowerCase();
    if (normalized === "harness" || normalized === "consumer") {
      return normalized;
    }
  }
  // 2. KADMON_MEDIK_PROFILE env override
  const envRaw = process.env["KADMON_MEDIK_PROFILE"];
  const envVal = envRaw?.trim().toLowerCase() ?? "";
  if (envVal === "harness" || envVal === "consumer") {
    return envVal;
  }
  // 3. Delegate + collapse
  const underlying = detectProjectProfile(cwd);
  return underlying === "harness" ? "harness" : "consumer";
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

// ─── Diff-scope classification (ADR-034) ─────────────────────────────────────

/**
 * Content-based diff classifier for /chekpoint Phase 1 (mechanical gates) and
 * Phase 2a (reviewer-relevance gates). Pure function — no filesystem I/O.
 * Caller optionally passes fileContents map for content-keyword secondary detection.
 *
 * Conservative-by-default invariant: ambiguous input → TRUE (run the gate).
 */
export interface DiffScope {
  // Phase 1 mechanical gates
  readonly needsBuild: boolean;
  readonly needsTypecheck: boolean;
  readonly needsTests: boolean;
  readonly needsLint: boolean;

  // Phase 2a reviewer-relevance gates
  readonly needsTypescriptReviewer: boolean;
  readonly needsPythonReviewer: boolean;
  readonly needsOrakle: boolean;       // SQL / schema / migration / Supabase / sql.js
  readonly needsSpektr: boolean;       // auth / keys / exec / file paths / SQL string building

  // Always-on: kody (consolidator), regardless of which specialists fired
  readonly rationale: Readonly<Record<string, string>>;
}

// Extensions that require typecheck/lint but not necessarily a full build
const TS_EXTENSIONS: ReadonlySet<string> = new Set([".ts", ".tsx"]);
const TS_LINT_EXTENSIONS: ReadonlySet<string> = new Set([".ts", ".tsx", ".js", ".jsx"]);
const PY_EXTENSION = ".py";

// Config files that trigger build/typecheck/lint but not tests
const CONFIG_FILES: ReadonlySet<string> = new Set([
  "package.json",
  "tsconfig.json",
  "tsconfig.base.json",
  "pyproject.toml",
  "requirements.txt",
  ".gitignore",
  "eslint.config.js",
  ".eslintrc.js",
  ".eslintrc.json",
  "ruff.toml",
  ".ruff.toml",
]);

// Extensions excluded from reviewer-relevance content scanning
const CONTENT_SCAN_EXCLUDED_EXTENSIONS: ReadonlySet<string> = new Set([
  ".md",
  ".txt",
  ".rst",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".cfg",
  ".lock",
  ".svg",
  ".png",
  ".jpg",
  ".gif",
]);

// Path patterns signaling SQL/schema/migration territory
const ORAKLE_PATH_PATTERNS: ReadonlyArray<RegExp> = [
  /\.sql$/i,
  /migrations?\//i,
  /\/schema\.(ts|sql|py)$/i,
  /\/state-store\.ts$/i,
];

// Content keywords that trigger orakle
const ORAKLE_CONTENT_KEYWORDS: ReadonlyArray<string> = [
  "supabase.from",
  "sql`",
  "FROM ",
  "JOIN ",
  "INSERT INTO",
  "CREATE TABLE",
  "pgvector",
];

// Path patterns signaling security-sensitive code
const SPEKTR_PATH_PATTERNS: ReadonlyArray<RegExp> = [
  /\/auth\//i,
  /\/security\//i,
  /\/permissions\.(ts|json)$/i,
  /\.claude\/settings.*\.json$/i,
];

// Content keywords that trigger spektr
const SPEKTR_CONTENT_KEYWORDS: ReadonlyArray<string> = [
  "execSync",
  "execFileSync",
  "child_process",
  "eval(",
  "Function(",
  "path.resolve",
  "readFileSync",
];

// Production source directory prefixes (file under these → needsTests)
const PRODUCTION_SOURCE_PREFIXES: ReadonlyArray<string> = [
  "src/",
  "scripts/",
  ".claude/hooks/scripts/",
  "lib/",
  "app/",
];

// Known file extensions (anything outside this set → conservative safe default)
const KNOWN_EXTENSIONS: ReadonlySet<string> = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py",
  ".md", ".txt", ".rst",
  ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".lock",
  ".sql", ".svg", ".png", ".jpg", ".gif",
  ".sh", ".bash", ".ps1",
  ".html", ".css", ".scss", ".sass", ".less",
  ".rb", ".go", ".rs", ".java", ".kt", ".swift", ".c", ".cpp", ".h",
  ".gitignore",
]);

/** Normalize a path to forward slashes (handles Windows backslashes). */
function normalizeDiffPath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, "/");
}

/** Returns true if this is a pure documentation file. */
function isDiffDocFile(normalized: string): boolean {
  const ext = path.extname(normalized).toLowerCase();
  return ext === ".md" || ext === ".rst" || ext === ".txt";
}

/** Returns true if this is a known config file (by basename). */
function isDiffConfigFile(normalized: string): boolean {
  return CONFIG_FILES.has(path.basename(normalized));
}

/** Returns true if this is a test file (by path/name pattern). */
function isDiffTestFile(normalized: string): boolean {
  const basename = path.basename(normalized);
  if (basename.startsWith("test_") && basename.endsWith(".py")) return true;
  if (TS_TEST_PATTERN.test(basename)) return true;
  if (/(?:^|\/)tests?\//.test(normalized)) return true;
  return false;
}

/** Returns true if this is a production source file (not test, not config, not docs). */
function isDiffProductionSource(normalized: string): boolean {
  const ext = path.extname(normalized).toLowerCase();
  const hasCodeExt =
    TS_EXTENSIONS.has(ext) || ext === PY_EXTENSION || ext === ".js" || ext === ".jsx";
  if (!hasCodeExt) return false;
  if (isDiffTestFile(normalized)) return false;
  return PRODUCTION_SOURCE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

/** Returns true if the extension is unknown (safe-default trigger). */
function isDiffUnknownExtension(normalized: string): boolean {
  const ext = path.extname(normalized).toLowerCase();
  if (!ext) return true;
  return !KNOWN_EXTENSIONS.has(ext);
}

/** Scan a file's content for keywords, skipping excluded extensions. */
function scanDiffContentKeywords(
  normalized: string,
  content: string,
  keywords: ReadonlyArray<string>
): string[] {
  const ext = path.extname(normalized).toLowerCase();
  if (CONTENT_SCAN_EXCLUDED_EXTENSIONS.has(ext)) return [];
  return keywords.filter((kw) => content.includes(kw));
}

/**
 * Classifies a staged diff and returns 8 boolean gates + human-readable rationale.
 *
 * @param stagedFiles   Relative file paths (Windows or POSIX separators).
 * @param fileContents  Optional map of file path → text for content-keyword scanning.
 *                      getDiffScope does NOT read the filesystem itself.
 *
 * Conservative-by-default: uncertain → TRUE (never silently skip a needed gate).
 */
export function getDiffScope(
  stagedFiles: readonly string[],
  fileContents?: Readonly<Record<string, string>>
): DiffScope {
  const normalized = stagedFiles.map(normalizeDiffPath);

  // ── Empty diff ───────────────────────────────────────────────────────────────
  if (normalized.length === 0) {
    const reason = "empty diff — no files staged";
    return {
      needsBuild: false, needsTypecheck: false, needsTests: false, needsLint: false,
      needsTypescriptReviewer: false, needsPythonReviewer: false,
      needsOrakle: false, needsSpektr: false,
      rationale: {
        needsBuild: reason, needsTypecheck: reason, needsTests: reason, needsLint: reason,
        needsTypescriptReviewer: reason, needsPythonReviewer: reason,
        needsOrakle: reason, needsSpektr: reason,
      },
    };
  }

  // ── Classify files ───────────────────────────────────────────────────────────
  let allDocs = true;
  let hasTsLint = false;
  let hasTsOnly = false; // .ts/.tsx specifically
  let hasPy = false;
  let hasConfig = false;
  let hasTest = false;
  let hasProduction = false;
  let hasUnknown = false;

  let oraklePath = false;
  let spektrPath = false;
  let oraklePathReason = "";
  let spektrPathReason = "";

  for (const norm of normalized) {
    const ext = path.extname(norm).toLowerCase();

    if (!isDiffDocFile(norm)) allDocs = false;
    if (TS_LINT_EXTENSIONS.has(ext)) hasTsLint = true;
    if (TS_EXTENSIONS.has(ext)) hasTsOnly = true;
    if (ext === PY_EXTENSION) hasPy = true;
    if (isDiffConfigFile(norm)) hasConfig = true;
    if (isDiffTestFile(norm)) hasTest = true;
    if (isDiffProductionSource(norm)) hasProduction = true;
    if (isDiffUnknownExtension(norm)) hasUnknown = true;

    if (!oraklePath && ORAKLE_PATH_PATTERNS.some((p) => p.test(norm))) {
      oraklePath = true;
      oraklePathReason = `sql/migration file: ${norm}`;
    }
    if (!spektrPath && SPEKTR_PATH_PATTERNS.some((p) => p.test(norm))) {
      spektrPath = true;
      spektrPathReason = `security-sensitive path: ${norm}`;
    }
  }

  // ── Content-keyword secondary scan ──────────────────────────────────────────
  let orakleContent = false;
  let spektrContent = false;
  let orakleContentReason = "";
  let spektrContentReason = "";

  if (fileContents) {
    for (const [filePath, content] of Object.entries(fileContents)) {
      const norm = normalizeDiffPath(filePath);
      if (!orakleContent) {
        const matches = scanDiffContentKeywords(norm, content, ORAKLE_CONTENT_KEYWORDS);
        if (matches.length > 0) {
          orakleContent = true;
          orakleContentReason = `SQL keyword in ${norm}: ${matches[0]}`;
        }
      }
      if (!spektrContent) {
        const matches = scanDiffContentKeywords(norm, content, SPEKTR_CONTENT_KEYWORDS);
        if (matches.length > 0) {
          spektrContent = true;
          spektrContentReason = `security keyword in ${norm}: ${matches[0]}`;
        }
      }
    }
  }

  // ── docs-only shortcircuit ───────────────────────────────────────────────────
  if (allDocs) {
    const reason = "docs-only diff — no build, typecheck, test, or lint needed";
    return {
      needsBuild: false, needsTypecheck: false, needsTests: false, needsLint: false,
      needsTypescriptReviewer: false, needsPythonReviewer: false,
      needsOrakle: false, needsSpektr: false,
      rationale: {
        needsBuild: reason, needsTypecheck: reason, needsTests: reason, needsLint: reason,
        needsTypescriptReviewer: reason, needsPythonReviewer: reason,
        needsOrakle: reason, needsSpektr: reason,
      },
    };
  }

  // ── Unknown extension (only unknowns, no recognized files) — safe default ───
  const hasAnyRecognized = hasTsLint || hasPy || hasConfig || hasTest || hasProduction || oraklePath;
  if (hasUnknown && !hasAnyRecognized) {
    const reason = "safe default — unknown extension; running all gates conservatively";
    return {
      needsBuild: true, needsTypecheck: true, needsTests: true, needsLint: true,
      needsTypescriptReviewer: true, needsPythonReviewer: true,
      needsOrakle: true, needsSpektr: true,
      rationale: {
        needsBuild: reason, needsTypecheck: reason, needsTests: reason, needsLint: reason,
        needsTypescriptReviewer: reason, needsPythonReviewer: reason,
        needsOrakle: reason, needsSpektr: reason,
      },
    };
  }

  // ── Mechanical gates ─────────────────────────────────────────────────────────

  // needsBuild: TS production files or config changes that affect the TS build graph
  const isTestOnlyTs = hasTest && hasTsLint && !hasProduction && !hasConfig && !oraklePath;
  const isTestOnlyPy = hasTest && hasPy && !hasTsLint && !hasProduction && !hasConfig;
  const needsBuild =
    !isTestOnlyTs && !isTestOnlyPy && (hasTsOnly || hasConfig || hasProduction);
  const buildReason = needsBuild
    ? "code present — TS files or config change detected"
    : "test-only files — no production TS build needed";
  const rationale: Record<string, string> = { needsBuild: buildReason };

  // needsTypecheck: any TS, Python, test, config, or SQL file
  const needsTypecheck = hasTsLint || hasPy || hasTest || hasConfig || oraklePath;
  rationale["needsTypecheck"] = needsTypecheck
    ? "TS/Python/test/config files present — typecheck needed"
    : "no typecheckable files";

  // needsTests: production source, test files, or SQL migrations
  const needsTests = hasProduction || hasTest || oraklePath;
  rationale["needsTests"] = needsTests
    ? "production source or test files present — test run needed"
    : "config-only — no test run needed";

  // needsLint: any lintable code file
  const needsLint = hasTsLint || hasPy || hasTest || hasConfig || oraklePath;
  rationale["needsLint"] = needsLint
    ? "code or config files present — lint needed"
    : "no lintable files";

  // ── Reviewer-relevance gates ─────────────────────────────────────────────────

  const needsTypescriptReviewer = hasTsLint;
  rationale["needsTypescriptReviewer"] = needsTypescriptReviewer
    ? "TS/JS files in diff — typescript-reviewer invoked"
    : "no TS/JS files — typescript-reviewer skipped";

  const needsPythonReviewer = hasPy;
  rationale["needsPythonReviewer"] = needsPythonReviewer
    ? "Python files in diff — python-reviewer invoked"
    : "no Python files — python-reviewer skipped";

  const needsOrakle = oraklePath || orakleContent;
  rationale["needsOrakle"] = needsOrakle
    ? (orakleContent ? orakleContentReason : oraklePathReason)
    : "no SQL/schema/migration/Supabase touch — orakle skipped";

  const needsSpektr = spektrPath || spektrContent;
  rationale["needsSpektr"] = needsSpektr
    ? (spektrContent ? spektrContentReason : spektrPathReason)
    : "no auth/exec/path/SQL security keywords — spektr skipped";

  return {
    needsBuild, needsTypecheck, needsTests, needsLint,
    needsTypescriptReviewer, needsPythonReviewer, needsOrakle, needsSpektr,
    rationale,
  };
}
