// plan-032 Phase 3 — doks profile detection + per-layer eligibility
// (ADR-032 + Amendment 2026-04-26: rules out of scope)
//
// The doks agent body is markdown — directly testing the agent requires running
// `/doks` end-to-end (Phase 4 manual verification — harness self-test snapshot
// + consumer dogfood). This file unit-tests:
//   1. detectProjectProfile (the renamed detector — same module, new symbol)
//   2. KADMON_DOKS_PROFILE override semantics simulated via the umbrella env var
//   3. Backward-compat alias (detectSkannerProfile === detectProjectProfile)
//   4. computeLayerEligibility helper that mirrors the agent body Step 0 logic
//      — 3 layers (1, 2, 3); rules are out of scope and never edited.
//
// Drift between the helper here and the agent body is caught by Phase 4
// self-test snapshot (harness) + consumer dogfood (/tmp/scratch-web).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  detectProjectProfile,
  detectSkannerProfile,
  type ProjectProfile,
} from "../../scripts/lib/detect-project-language.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanProfileEnv(): void {
  delete process.env["KADMON_PROJECT_PROFILE"];
  delete process.env["KADMON_SKANNER_PROFILE"];
  delete process.env["KADMON_DOKS_PROFILE"];
}

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "doks-profile-"));
}

function writeMarker(dir: string, relPath: string, content = ""): void {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
}

// ─── Layer eligibility helper (mirrors doks agent body Step 0) ───────────────
// 3-layer model post-Amendment 2026-04-26:
//   - Layer 1 (CLAUDE.md, README.md): always writable
//   - Layer 2 (.claude/commands/): writable; cwd-only in consumer
//   - Layer 3 (.claude/agents/, .claude/skills/): writable; cwd-only in consumer
// `.claude/rules/` is out of scope (any profile) — never edited by /doks.

type DoksMode = "harness" | "consumer";
type Eligibility = "writable" | "read-only" | "out-of-scope";

interface LayerEligibility {
  layer1: Eligibility;
  layer2: Eligibility;
  layer3: Eligibility;
  rules: Eligibility;
}

function profileToDoksMode(profile: ProjectProfile): DoksMode {
  return profile === "harness" ? "harness" : "consumer";
}

function computeLayerEligibility(_mode: DoksMode): LayerEligibility {
  return {
    layer1: "writable",
    layer2: "writable",
    layer3: "writable",
    rules: "out-of-scope",
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("doks profile detection (ADR-032)", () => {
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

  // ─── Case 1: harness markers → 'harness' (renamed function reuses logic) ──

  it("detectProjectProfile() returns 'harness' for harness markers", () => {
    writeMarker(tmpDir, "scripts/lib/state-store.ts");
    const result: ProjectProfile = detectProjectProfile(tmpDir);
    expect(result).toBe("harness");
  });

  // ─── Case 2: web markers → 'web' (collapses to consumer in agent body) ────

  it("detectProjectProfile() returns 'web' for react/next/vite markers", () => {
    const pkg = { name: "scratch", dependencies: { react: "^18" } };
    writeMarker(tmpDir, "package.json", JSON.stringify(pkg));
    const result: ProjectProfile = detectProjectProfile(tmpDir);
    expect(result).toBe("web");
    expect(profileToDoksMode(result)).toBe("consumer");
  });

  // ─── Case 3: cli markers → 'cli' (collapses to consumer in agent body) ────

  it("detectProjectProfile() returns 'cli' for package.json bin field", () => {
    const pkg = {
      name: "my-cli",
      bin: { "my-cli": "./bin/index.js" },
      dependencies: { commander: "^11" },
    };
    writeMarker(tmpDir, "package.json", JSON.stringify(pkg));
    const result: ProjectProfile = detectProjectProfile(tmpDir);
    expect(result).toBe("cli");
    expect(profileToDoksMode(result)).toBe("consumer");
  });

  // ─── Case 4: KADMON_PROJECT_PROFILE umbrella env beats markers ────────────
  // Note: the detector itself reads KADMON_PROJECT_PROFILE / KADMON_SKANNER_PROFILE.
  // The doks-specific KADMON_DOKS_PROFILE override is enforced at the agent body
  // level (Step 0) BEFORE calling detectProjectProfile, per ADR-032 precedence.
  // This case verifies the umbrella env-var path used by the doks agent when
  // KADMON_DOKS_PROFILE is unset.

  it("KADMON_PROJECT_PROFILE=cli overrides harness markers", () => {
    writeMarker(tmpDir, "scripts/lib/state-store.ts"); // harness marker
    process.env["KADMON_PROJECT_PROFILE"] = "cli";
    const result: ProjectProfile = detectProjectProfile(tmpDir);
    expect(result).toBe("cli");
    expect(profileToDoksMode(result)).toBe("consumer");
  });

  // ─── Case 5: KADMON_PROJECT_PROFILE=harness overrides web markers ─────────

  it("KADMON_PROJECT_PROFILE=harness overrides web markers", () => {
    const pkg = { name: "scratch", dependencies: { react: "^18" } };
    writeMarker(tmpDir, "package.json", JSON.stringify(pkg));
    process.env["KADMON_PROJECT_PROFILE"] = "harness";
    const result: ProjectProfile = detectProjectProfile(tmpDir);
    expect(result).toBe("harness");
    expect(profileToDoksMode(result)).toBe("harness");
  });

  // ─── Case 6: explicit arg beats env var ───────────────────────────────────

  it("explicit arg 'harness' beats KADMON_PROJECT_PROFILE=web", () => {
    process.env["KADMON_PROJECT_PROFILE"] = "web";
    const result: ProjectProfile = detectProjectProfile(tmpDir, "harness");
    expect(result).toBe("harness");
  });

  // ─── Case 7: backward-compat alias ────────────────────────────────────────

  it("detectSkannerProfile is the same reference as detectProjectProfile (alias contract)", () => {
    expect(detectSkannerProfile).toBe(detectProjectProfile);
  });

  // ─── Case 8: computeLayerEligibility mirrors agent body Step 0 ────────────
  // Post-Amendment 2026-04-26: rules out-of-scope universally; all 3 layers
  // writable in both profiles. Consumer-vs-harness difference is enumeration
  // scope (cwd-only in consumer), not eligibility — captured at agent-body level.

  it("computeLayerEligibility: 3 layers writable in both profiles; rules out-of-scope", () => {
    const harnessElig = computeLayerEligibility("harness");
    expect(harnessElig.layer1).toBe("writable");
    expect(harnessElig.layer2).toBe("writable");
    expect(harnessElig.layer3).toBe("writable");
    expect(harnessElig.rules).toBe("out-of-scope");

    const consumerElig = computeLayerEligibility("consumer");
    expect(consumerElig.layer1).toBe("writable");
    expect(consumerElig.layer2).toBe("writable");
    expect(consumerElig.layer3).toBe("writable");
    expect(consumerElig.rules).toBe("out-of-scope");
  });
});
