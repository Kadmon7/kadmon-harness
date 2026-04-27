// TDD [feniks] — plan-033 Phase 2.1 RED
// Tests for detectMedikProfile (ADR-033) and the capability-alignment cwd-existence guard.
//
// 10 cases:
//   1-4.  detectMedikProfile detection (harness markers, web, cli, empty → consumer)
//   5-7.  override semantics (env KADMON_MEDIK_PROFILE, explicit arg)
//   8-9.  capability-alignment cwd-existence guard
//   10.   architectural assertion — detectMedikProfile NOT imported by any medik-check module

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  detectMedikProfile,
  type MedikProfile,
} from "../../scripts/lib/detect-project-language.js";
import { runCheck } from "../../scripts/lib/medik-checks/capability-alignment.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanMedikEnv(): void {
  delete process.env["KADMON_MEDIK_PROFILE"];
  delete process.env["KADMON_PROJECT_PROFILE"];
  delete process.env["KADMON_SKANNER_PROFILE"];
}

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "medik-profile-"));
}

function writeFile(dir: string, relPath: string, content = ""): void {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("detectMedikProfile (ADR-033)", () => {
  let tmpDir: string;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    cleanMedikEnv();
    tmpDir = makeTmpDir();
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    cleanMedikEnv();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── Case 1: harness markers → 'harness' ──────────────────────────────────

  it("case 1: returns 'harness' for harness markers (state-store.ts present)", () => {
    writeFile(tmpDir, "scripts/lib/state-store.ts");
    const result: MedikProfile = detectMedikProfile(tmpDir);
    expect(result).toBe("harness");
  });

  // ─── Case 2: web markers (react in package.json) → 'consumer' ────────────

  it("case 2: returns 'consumer' for web markers (react in package.json)", () => {
    const pkg = { name: "web-app", dependencies: { react: "^18.0.0" } };
    writeFile(tmpDir, "package.json", JSON.stringify(pkg));
    const result: MedikProfile = detectMedikProfile(tmpDir);
    expect(result).toBe("consumer");
  });

  // ─── Case 3: cli markers (bin field) → 'consumer' ─────────────────────────

  it("case 3: returns 'consumer' for cli markers (package.json bin field)", () => {
    const pkg = {
      name: "my-cli",
      bin: { "my-cli": "./bin/index.js" },
      dependencies: { commander: "^11.0.0" },
    };
    writeFile(tmpDir, "package.json", JSON.stringify(pkg));
    const result: MedikProfile = detectMedikProfile(tmpDir);
    expect(result).toBe("consumer");
  });

  // ─── Case 4: empty tmpDir → 'consumer' (fallback collapse from web) ───────

  it("case 4: returns 'consumer' for empty tmpDir (fallback → web → consumer)", () => {
    // No markers — detectProjectProfile returns 'web' fallback → collapses to 'consumer'
    const result: MedikProfile = detectMedikProfile(tmpDir);
    expect(result).toBe("consumer");
  });

  // ─── Case 5: KADMON_MEDIK_PROFILE=harness overrides web markers ───────────

  it("case 5: KADMON_MEDIK_PROFILE=harness overrides web markers", () => {
    const pkg = { name: "web-app", dependencies: { react: "^18.0.0" } };
    writeFile(tmpDir, "package.json", JSON.stringify(pkg));
    process.env["KADMON_MEDIK_PROFILE"] = "harness";
    const result: MedikProfile = detectMedikProfile(tmpDir);
    expect(result).toBe("harness");
  });

  // ─── Case 6: KADMON_MEDIK_PROFILE=consumer overrides harness markers ──────

  it("case 6: KADMON_MEDIK_PROFILE=consumer overrides harness markers", () => {
    writeFile(tmpDir, "scripts/lib/state-store.ts");
    process.env["KADMON_MEDIK_PROFILE"] = "consumer";
    const result: MedikProfile = detectMedikProfile(tmpDir);
    expect(result).toBe("consumer");
  });

  // ─── Case 7: explicit arg 'harness' beats env KADMON_MEDIK_PROFILE=consumer

  it("case 7: explicit arg 'harness' beats KADMON_MEDIK_PROFILE=consumer", () => {
    process.env["KADMON_MEDIK_PROFILE"] = "consumer";
    const result: MedikProfile = detectMedikProfile(tmpDir, "harness");
    expect(result).toBe("harness");
  });

  // ─── Case 8: capability-alignment guard — agents+skills ABSENT → NOTE ─────

  it("case 8: capability-alignment runCheck returns NOTE when agents and skills dirs absent", () => {
    // tmpDir has no .claude/agents/ or .claude/skills/
    const result = runCheck({ projectHash: "test-consumer", cwd: tmpDir });
    expect(result.status).toBe("NOTE");
    expect(result.message).toContain("no consumer-local");
  });

  // ─── Case 9: capability-alignment guard — both PRESENT → runs matrix ──────

  it("case 9: capability-alignment runCheck runs matrix when agents and skills present", () => {
    // Synthesize minimal consumer catalog
    const agentsDir = path.join(tmpDir, ".claude", "agents");
    const skillsDir = path.join(tmpDir, ".claude", "skills", "local-skill");
    const commandsDir = path.join(tmpDir, ".claude", "commands");
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.mkdirSync(commandsDir, { recursive: true });

    // Write a synthetic aligned agent
    fs.writeFileSync(
      path.join(agentsDir, "local-agent.md"),
      "---\nname: local-agent\nmodel: sonnet\ntools: Read\n---\nbody\n",
    );
    // Write a synthetic skill
    fs.writeFileSync(
      path.join(skillsDir, "SKILL.md"),
      "---\nname: local-skill\ndescription: test skill\n---\nbody\n",
    );

    const result = runCheck({ projectHash: "test-consumer", cwd: tmpDir });
    // Guard must NOT fire: status is PASS/WARN/FAIL/NOTE from matrix, NOT "no consumer-local"
    expect(result.message).not.toContain("no consumer-local");
    // Status is whatever the matrix returns — PASS is expected for this clean catalog
    expect(["PASS", "NOTE", "WARN", "FAIL"]).toContain(result.status);
  });

  // ─── Case 10: architectural assertion — detectMedikProfile NOT imported ────
  // by any file under scripts/lib/medik-checks/ (profile is diagnostic-only)

  it("case 10: detectMedikProfile is not imported by any file under scripts/lib/medik-checks/", () => {
    const checksDir = path.resolve(
      import.meta.dirname,
      "../../scripts/lib/medik-checks",
    );
    const files = fs.readdirSync(checksDir).filter((f) => f.endsWith(".ts") || f.endsWith(".js"));

    for (const file of files) {
      const content = fs.readFileSync(path.join(checksDir, file), "utf8");
      expect(
        content,
        `${file} must not import detectMedikProfile (profile gate must stay at command level)`,
      ).not.toContain("detectMedikProfile");
    }
  });
});
