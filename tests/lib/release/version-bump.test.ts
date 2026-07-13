// TDD [feniks] — plan-037 Step 1.2 — version-bump.ts (Wave 1, parallel, file-disjoint)
import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  computeNextVersion,
  applyVersionBump,
  ReleaseValidationError,
} from "../../../scripts/lib/release/version-bump.js";
import type { ReleaseContext } from "../../../scripts/lib/release/types.js";

// Anchor to this test file's location (not Vitest's launch cwd) — see feniks memory
// pattern_dynamic_import_ts_boundary / Bash-path-anchor gotcha.
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const REAL_PLUGIN_JSON = path.join(REPO_ROOT, ".claude-plugin", "plugin.json");
const REAL_PACKAGE_JSON = path.join(REPO_ROOT, "package.json");

const tmpDirs: string[] = [];

function makeFixture(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "version-bump-test-"));
  tmpDirs.push(tmpDir);
  const pluginDir = path.join(tmpDir, ".claude-plugin");
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.copyFileSync(REAL_PLUGIN_JSON, path.join(pluginDir, "plugin.json"));
  fs.copyFileSync(REAL_PACKAGE_JSON, path.join(tmpDir, "package.json"));
  return tmpDir;
}

function readVersion(jsonPath: string): string {
  const raw = fs.readFileSync(jsonPath, "utf8");
  return (JSON.parse(raw) as { version: string }).version;
}

function makeContext(cwd: string, currentVersion: string): ReleaseContext {
  return {
    cwd,
    options: { level: "patch", dryRun: false, push: false },
    currentVersion,
  };
}

afterEach(() => {
  // NEVER write the real repo files — only the tmp fixtures created above.
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("computeNextVersion", () => {
  it.each([
    ["1.3.0", "patch", "1.3.1"],
    ["1.3.0", "minor", "1.4.0"],
    ["1.3.0", "major", "2.0.0"],
  ] as const)("(a) %s + %s -> %s", (current, level, expected) => {
    expect(computeNextVersion(current, level)).toBe(expected);
  });

  it("(a-edge) boundary value 0.0.0 + patch -> 0.0.1", () => {
    expect(computeNextVersion("0.0.0", "patch")).toBe("0.0.1");
  });

  it.each(["1.3", "abc", "", "1.3.0.0", "1.3.x"])(
    "(b) malformed %j throws ReleaseValidationError with code BAD_VERSION",
    (malformed) => {
      expect(() => computeNextVersion(malformed, "patch")).toThrow(ReleaseValidationError);
      try {
        computeNextVersion(malformed, "patch");
        expect.unreachable("computeNextVersion should have thrown");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(ReleaseValidationError);
        expect((error as ReleaseValidationError).code).toBe("BAD_VERSION");
      }
    },
  );
});

describe("applyVersionBump", () => {
  it("(c) writes both plugin.json and package.json to the target version", () => {
    const tmpDir = makeFixture();
    const current = readVersion(path.join(tmpDir, ".claude-plugin", "plugin.json"));
    const target = computeNextVersion(current, "patch");
    const ctx = makeContext(tmpDir, current);

    const result = applyVersionBump(ctx, target);

    expect(result.status).toBe("applied");
    expect(readVersion(path.join(tmpDir, ".claude-plugin", "plugin.json"))).toBe(target);
    expect(readVersion(path.join(tmpDir, "package.json"))).toBe(target);
    expect(result.filesTouched.length).toBe(2);
  });

  it("(d) is idempotent — second call with the same target is skipped and content is unchanged", () => {
    const tmpDir = makeFixture();
    const current = readVersion(path.join(tmpDir, ".claude-plugin", "plugin.json"));
    const target = computeNextVersion(current, "patch");
    const ctx = makeContext(tmpDir, current);

    applyVersionBump(ctx, target);
    const pluginAfterFirst = fs.readFileSync(path.join(tmpDir, ".claude-plugin", "plugin.json"), "utf8");
    const packageAfterFirst = fs.readFileSync(path.join(tmpDir, "package.json"), "utf8");

    const secondResult = applyVersionBump(ctx, target);

    expect(secondResult.status).toBe("skipped");
    expect(secondResult.filesTouched.length).toBe(0);
    expect(fs.readFileSync(path.join(tmpDir, ".claude-plugin", "plugin.json"), "utf8")).toBe(pluginAfterFirst);
    expect(fs.readFileSync(path.join(tmpDir, "package.json"), "utf8")).toBe(packageAfterFirst);
  });

  it("(e) keeps plugin.json (canonical) and package.json (mirror) in lockstep", () => {
    const tmpDir = makeFixture();
    const current = readVersion(path.join(tmpDir, ".claude-plugin", "plugin.json"));
    const target = computeNextVersion(current, "major");
    const ctx = makeContext(tmpDir, current);

    applyVersionBump(ctx, target);

    const pluginVersion = readVersion(path.join(tmpDir, ".claude-plugin", "plugin.json"));
    const packageVersion = readVersion(path.join(tmpDir, "package.json"));
    expect(pluginVersion).toBe(target);
    expect(packageVersion).toBe(target);
    expect(pluginVersion).toBe(packageVersion);
  });

  it("(f) preserves JSON formatting — 2-space indent + trailing newline", () => {
    const tmpDir = makeFixture();
    const current = readVersion(path.join(tmpDir, ".claude-plugin", "plugin.json"));
    const target = computeNextVersion(current, "minor");
    const ctx = makeContext(tmpDir, current);

    applyVersionBump(ctx, target);

    const pluginRaw = fs.readFileSync(path.join(tmpDir, ".claude-plugin", "plugin.json"), "utf8");
    const packageRaw = fs.readFileSync(path.join(tmpDir, "package.json"), "utf8");

    for (const raw of [pluginRaw, packageRaw]) {
      expect(raw.endsWith("\n")).toBe(true);
      expect(raw.endsWith("\n\n")).toBe(false);
      // 2-space indent: at least one line starting with exactly 2 spaces then a quoted key
      expect(raw).toMatch(/\n {2}"[^"]+":/);
      // no 4-space top-level indent (would indicate a different indent width crept in)
      expect(raw).not.toMatch(/\n {4}"version":/);
    }

    // Round-trips as valid JSON with the expected top-level keys intact
    const pluginJson = JSON.parse(pluginRaw) as Record<string, unknown>;
    const packageJson = JSON.parse(packageRaw) as Record<string, unknown>;
    expect(pluginJson.name).toBe("kadmon-harness");
    expect(packageJson.name).toBe("kadmon-harness");
    expect(packageJson.scripts).toBeDefined();
    expect(packageJson.dependencies).toBeDefined();
  });

  it("(error path) plugin.json missing at ctx.cwd -> returns a failed StepResult with IO code naming the file (not a raw throw)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "version-bump-missing-"));
    tmpDirs.push(tmpDir);
    const ctx = makeContext(tmpDir, "1.0.0");
    const pluginPath = path.join(tmpDir, ".claude-plugin", "plugin.json");

    let thrown = false;
    let result: ReturnType<typeof applyVersionBump> | undefined;
    try {
      result = applyVersionBump(ctx, "1.0.1");
    } catch {
      thrown = true;
    }

    expect(thrown).toBe(false);
    expect(result?.status).toBe("failed");
    expect((result?.details as { code: string } | undefined)?.code).toBe("IO");
    expect(result?.message).toContain(pluginPath);
  });

  it("(g) malformed/half-written JSON in plugin.json -> returns a failed StepResult with IO code, not a raw SyntaxError (R4)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "version-bump-malformed-"));
    tmpDirs.push(tmpDir);
    const pluginDir = path.join(tmpDir, ".claude-plugin");
    fs.mkdirSync(pluginDir, { recursive: true });
    const pluginPath = path.join(pluginDir, "plugin.json");
    // Half-written JSON — plausible after a crash mid-write, the exact scenario recovery
    // is designed around.
    fs.writeFileSync(pluginPath, '{ "name": "kadmon-harness", "version": ', "utf8");
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      '{ "name": "kadmon-harness", "version": "1.0.0" }\n',
      "utf8",
    );
    const ctx = makeContext(tmpDir, "1.0.0");

    let thrown = false;
    let result: ReturnType<typeof applyVersionBump> | undefined;
    try {
      result = applyVersionBump(ctx, "1.0.1");
    } catch {
      thrown = true;
    }

    expect(thrown).toBe(false);
    expect(result?.status).toBe("failed");
    expect((result?.details as { code: string } | undefined)?.code).toBe("IO");
    expect(result?.message).toContain(pluginPath);
    expect(result?.message.toLowerCase()).toContain("json");
  });
});
