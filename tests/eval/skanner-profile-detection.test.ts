// TDD [feniks] — plan-031 Phase 1 Step 1.1 — RED phase
// Contract test for detectSkannerProfile (ADR-031)
//
// RED state: detectSkannerProfile does not exist yet in detect-project-language.ts.
// Expected failure: "detectSkannerProfile is not a function" (named export missing).
// GREEN after Step 1.2 extends detect-project-language.ts.
//
// Test cases (12 minimum, per plan-031 Step 1.1):
//   1–3.  harness profile from each of the three harness markers
//   4–6.  web profile from package.json with react/next/vite
//   7.    web profile from pyproject.toml with fastapi/django
//   8.    cli profile: package.json with bin field, no UI deps
//   9.    unknown input → fallback 'web'
//   10.   KADMON_SKANNER_PROFILE env override beats markers
//   11.   explicit arg beats env override
//   12.   monorepo conflict: harness markers + web markers → harness wins

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  detectSkannerProfile,
  detectProjectProfile,
  type SkannerProfile,
} from "../../scripts/lib/detect-project-language.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanProfileEnv(): void {
  delete process.env["KADMON_SKANNER_PROFILE"];
  delete process.env["KADMON_PROJECT_PROFILE"];
}

/** Create a fresh tmp dir for marker files. */
function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "skanner-profile-"));
}

/** Write a file inside tmpDir, creating intermediate dirs as needed. */
function writeMarker(dir: string, relPath: string, content = ""): void {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("detectSkannerProfile", () => {
  let tmpDir: string;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    cleanProfileEnv();
    tmpDir = makeTmpDir();
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    cleanProfileEnv();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── Helper to read captured stderr diagnostic ────────────────────────────

  function getDiagnostic(): Record<string, unknown> | null {
    const calls = stderrSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    for (const line of calls) {
      try {
        const parsed = JSON.parse(line.trim()) as Record<string, unknown>;
        // Skanner profile diagnostic has 'profile' key (distinguishes from language diagnostic)
        if ("profile" in parsed) return parsed;
      } catch {
        // not JSON or not ours
      }
    }
    return null;
  }

  // ─── Test 1: harness — scripts/lib/state-store.ts ────────────────────────

  it("returns 'harness' when scripts/lib/state-store.ts is present", () => {
    writeMarker(tmpDir, "scripts/lib/state-store.ts");
    const result: SkannerProfile = detectSkannerProfile(tmpDir);
    expect(result).toBe("harness");
  });

  // ─── Test 2: harness — hooks/observe-pre.ts ──────────────────────────────

  it("returns 'harness' when hooks/observe-pre.ts is present", () => {
    writeMarker(tmpDir, "hooks/observe-pre.ts");
    const result: SkannerProfile = detectSkannerProfile(tmpDir);
    expect(result).toBe("harness");
  });

  // ─── Test 3: harness — data/observations.jsonl ───────────────────────────

  it("returns 'harness' when data/observations.jsonl is present", () => {
    writeMarker(tmpDir, "data/observations.jsonl");
    const result: SkannerProfile = detectSkannerProfile(tmpDir);
    expect(result).toBe("harness");
  });

  // ─── Test 4: web — package.json with "react" in dependencies ─────────────

  it("returns 'web' when package.json contains react in dependencies", () => {
    const pkg = { name: "test-app", dependencies: { react: "^18.0.0" } };
    writeMarker(tmpDir, "package.json", JSON.stringify(pkg));
    const result: SkannerProfile = detectSkannerProfile(tmpDir);
    expect(result).toBe("web");
  });

  // ─── Test 5: web — package.json with "next" in dependencies ──────────────

  it("returns 'web' when package.json contains next in dependencies", () => {
    const pkg = { name: "test-app", dependencies: { next: "^14.0.0" } };
    writeMarker(tmpDir, "package.json", JSON.stringify(pkg));
    const result: SkannerProfile = detectSkannerProfile(tmpDir);
    expect(result).toBe("web");
  });

  // ─── Test 6: web — package.json with "vite" in devDependencies ───────────

  it("returns 'web' when package.json contains vite in devDependencies", () => {
    const pkg = { name: "test-app", devDependencies: { vite: "^5.0.0" } };
    writeMarker(tmpDir, "package.json", JSON.stringify(pkg));
    const result: SkannerProfile = detectSkannerProfile(tmpDir);
    expect(result).toBe("web");
  });

  // ─── Test 7: web — pyproject.toml with fastapi ────────────────────────────

  it("returns 'web' when pyproject.toml contains fastapi", () => {
    writeMarker(
      tmpDir,
      "pyproject.toml",
      '[tool.poetry.dependencies]\nfastapi = "^0.100.0"\npython = "^3.11"\n'
    );
    const result: SkannerProfile = detectSkannerProfile(tmpDir);
    expect(result).toBe("web");
  });

  it("returns 'web' when pyproject.toml contains django", () => {
    writeMarker(
      tmpDir,
      "pyproject.toml",
      '[tool.poetry.dependencies]\ndjango = "^4.2.0"\npython = "^3.11"\n'
    );
    const result: SkannerProfile = detectSkannerProfile(tmpDir);
    expect(result).toBe("web");
  });

  // ─── Test 8: cli — package.json with bin field, no UI deps ───────────────

  it("returns 'cli' when package.json has bin field and no UI dependencies", () => {
    const pkg = {
      name: "my-cli",
      bin: { "my-cli": "./bin/index.js" },
      dependencies: { commander: "^11.0.0" },
    };
    writeMarker(tmpDir, "package.json", JSON.stringify(pkg));
    const result: SkannerProfile = detectSkannerProfile(tmpDir);
    expect(result).toBe("cli");
  });

  // ─── Test 9: unknown → fallback 'web' ────────────────────────────────────

  it("returns 'web' as fallback when no markers are present (ADR-031 default)", () => {
    // tmpDir is empty — no markers
    const result: SkannerProfile = detectSkannerProfile(tmpDir);
    expect(result).toBe("web");
  });

  // ─── Test 10: env override beats harness markers ──────────────────────────

  it("KADMON_SKANNER_PROFILE=cli overrides harness markers", () => {
    // Plant harness marker
    writeMarker(tmpDir, "scripts/lib/state-store.ts");
    process.env["KADMON_SKANNER_PROFILE"] = "cli";
    const result: SkannerProfile = detectSkannerProfile(tmpDir);
    expect(result).toBe("cli");

    // Stderr diagnostic should say source='env'
    const diag = getDiagnostic();
    expect(diag).not.toBeNull();
    expect(diag!["source"]).toBe("env");
    expect(diag!["profile"]).toBe("cli");
  });

  // ─── Test 11: explicit arg beats env ──────────────────────────────────────

  it("explicit arg 'harness' overrides KADMON_SKANNER_PROFILE=web", () => {
    process.env["KADMON_SKANNER_PROFILE"] = "web";
    const result: SkannerProfile = detectSkannerProfile(tmpDir, "harness");
    expect(result).toBe("harness");

    // Stderr diagnostic should say source='arg'
    const diag = getDiagnostic();
    expect(diag).not.toBeNull();
    expect(diag!["source"]).toBe("arg");
    expect(diag!["profile"]).toBe("harness");
  });

  // ─── Test 12: monorepo conflict — harness markers + web markers → harness wins

  it("returns 'harness' when both harness and web markers are present (precedence)", () => {
    // Harness marker
    writeMarker(tmpDir, "scripts/lib/state-store.ts");
    // Web marker
    const pkg = { name: "mono", dependencies: { react: "^18.0.0" } };
    writeMarker(tmpDir, "package.json", JSON.stringify(pkg));

    const result: SkannerProfile = detectSkannerProfile(tmpDir);
    expect(result).toBe("harness");

    // Diagnostic should mention harness markers as the winning source
    const diag = getDiagnostic();
    expect(diag).not.toBeNull();
    expect(diag!["source"]).toBe("markers");
    expect(diag!["profile"]).toBe("harness");
  });

  // ─── Stderr diagnostic shape ──────────────────────────────────────────────

  it("emits stderr diagnostic JSON with source, profile, markers fields on every call", () => {
    writeMarker(tmpDir, "hooks/observe-pre.ts");
    detectSkannerProfile(tmpDir);

    const diag = getDiagnostic();
    expect(diag).not.toBeNull();
    expect(typeof diag!["source"]).toBe("string");
    expect(typeof diag!["profile"]).toBe("string");
    expect(Array.isArray(diag!["markers"])).toBe(true);
  });

  it("invalid KADMON_SKANNER_PROFILE value falls through to marker detection", () => {
    process.env["KADMON_SKANNER_PROFILE"] = "playwright"; // not a valid SkannerProfile
    writeMarker(tmpDir, "scripts/lib/state-store.ts");
    const result: SkannerProfile = detectSkannerProfile(tmpDir);
    // Should not use env value; should fall through to harness markers
    expect(result).toBe("harness");
  });

  it("invalid explicit arg falls through to marker detection", () => {
    // "browser" is not in the whitelist
    writeMarker(tmpDir, "hooks/observe-pre.ts");
    const result: SkannerProfile = detectSkannerProfile(tmpDir, "browser");
    expect(result).toBe("harness");
  });

  // ─── plan-032 alias parity (ADR-032) ──────────────────────────────────────

  it("detectSkannerProfile is the same reference as detectProjectProfile (alias contract)", () => {
    // The deprecated alias must be function-reference-identical to the new symbol.
    // This guarantees behavior parity for plan-031 callers.
    expect(detectSkannerProfile).toBe(detectProjectProfile);
  });

  it("detectProjectProfile behaves identically to detectSkannerProfile for the harness case", () => {
    writeMarker(tmpDir, "scripts/lib/state-store.ts");
    const oldName: SkannerProfile = detectSkannerProfile(tmpDir);
    const newName: SkannerProfile = detectProjectProfile(tmpDir);
    expect(oldName).toBe("harness");
    expect(newName).toBe("harness");
    expect(oldName).toBe(newName);
  });

  // Closes review WARN-1: canonical eval suite must cover the umbrella env
  // var directly so a typo in "KADMON_PROJECT_PROFILE" at the source can't
  // silently fall through to the legacy back-compat path undetected.
  it("KADMON_PROJECT_PROFILE=cli (umbrella) overrides harness markers", () => {
    writeMarker(tmpDir, "scripts/lib/state-store.ts");
    process.env["KADMON_PROJECT_PROFILE"] = "cli";
    const result: SkannerProfile = detectProjectProfile(tmpDir);
    expect(result).toBe("cli");

    const diag = getDiagnostic();
    expect(diag).not.toBeNull();
    expect(diag!["source"]).toBe("env");
    expect(diag!["profile"]).toBe("cli");
  });

  it("KADMON_PROJECT_PROFILE precedence beats KADMON_SKANNER_PROFILE when both set", () => {
    process.env["KADMON_PROJECT_PROFILE"] = "harness";
    process.env["KADMON_SKANNER_PROFILE"] = "web";
    const result: SkannerProfile = detectProjectProfile(tmpDir);
    expect(result).toBe("harness");
  });
});
