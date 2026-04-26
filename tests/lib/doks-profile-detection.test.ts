// plan-032 Phase 3 — doks profile detection + per-layer eligibility (ADR-032)
//
// The doks agent body is markdown — directly testing the agent requires running
// `/doks` end-to-end (Phase 4 manual verification — harness self-test snapshot
// + consumer dogfood). This file unit-tests:
//   1. detectProjectProfile (the renamed detector — same module, new symbol)
//   2. KADMON_DOKS_PROFILE override semantics simulated via the umbrella env var
//   3. Backward-compat alias (detectSkannerProfile === detectProjectProfile)
//   4. computeLayerEligibility helper that mirrors the agent body Step 0 logic
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
// In consumer profile, Layer 1 always writable; Layer 2 read-only (rules
// harness-shared); Layers 3-4 writable but cwd-only enumeration.
// In harness profile, all 4 layers writable.

type DoksMode = "harness" | "consumer";
type Eligibility = "writable" | "read-only";

interface LayerEligibility {
  layer1: Eligibility;
  layer2: Eligibility;
  layer3: Eligibility;
  layer4: Eligibility;
}

function profileToDoksMode(profile: ProjectProfile): DoksMode {
  return profile === "harness" ? "harness" : "consumer";
}

function computeLayerEligibility(mode: DoksMode): LayerEligibility {
  if (mode === "harness") {
    return {
      layer1: "writable",
      layer2: "writable",
      layer3: "writable",
      layer4: "writable",
    };
  }
  return {
    layer1: "writable",
    layer2: "read-only",
    layer3: "writable",
    layer4: "writable",
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

  it("computeLayerEligibility: harness profile → all 4 layers writable; consumer → Layer 1 writable, Layer 2 read-only, Layers 3-4 writable", () => {
    const harnessElig = computeLayerEligibility("harness");
    expect(harnessElig.layer1).toBe("writable");
    expect(harnessElig.layer2).toBe("writable");
    expect(harnessElig.layer3).toBe("writable");
    expect(harnessElig.layer4).toBe("writable");

    const consumerElig = computeLayerEligibility("consumer");
    expect(consumerElig.layer1).toBe("writable");
    expect(consumerElig.layer2).toBe("read-only");
    expect(consumerElig.layer3).toBe("writable");
    expect(consumerElig.layer4).toBe("writable");
  });
});
