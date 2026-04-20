// TDD — plan-010 Phase 5.1 RED test (2026-04-20).
// Structural + execution tests for install.ps1 PowerShell bootstrap.
//
// Most assertions parse install.ps1 content (structural invariants) so the
// test runs on ANY host. Execution test (Test 8) is skipped when powershell /
// pwsh is unavailable — typical on Linux CI or minimal Mac hosts.
//
// Scope per plan-010 Phase 5 narrowed by plan-019: install.ps1 delegates
// merge logic to scripts/lib/install-apply.ts via npx tsx (DRY across shells).

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const INSTALL_PS1 = path.join(REPO_ROOT, "install.ps1");

// ─── PowerShell detection ────────────────────────────────────────────────────

function detectPowerShell(): string | null {
  // Prefer pwsh (PowerShell 7+, cross-platform) then powershell.exe (Windows)
  for (const candidate of ["pwsh", "powershell", "powershell.exe"]) {
    const check = spawnSync(candidate, ["-Command", "$PSVersionTable.PSVersion"], {
      encoding: "utf8",
    });
    if (check.status === 0 && !check.error) {
      return candidate;
    }
  }
  // Fallback: hardcoded Windows path
  const winCandidate =
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
  if (fs.existsSync(winCandidate)) {
    const check = spawnSync(winCandidate, ["-Command", "$PSVersionTable"], {
      encoding: "utf8",
    });
    if (check.status === 0 && !check.error) {
      return winCandidate;
    }
  }
  return null;
}

const POWERSHELL_PATH = detectPowerShell();
const powershellAvailable = POWERSHELL_PATH !== null;

// ─── Test fixtures ───────────────────────────────────────────────────────────

let tempTargets: string[] = [];
let tempUserSettingsDirs: string[] = [];

function createFakeTarget(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-ps1-target-"));
  tempTargets.push(dir);
  fs.mkdirSync(path.join(dir, ".claude"), { recursive: true });
  return dir;
}

function createFakeUserSettings(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-ps1-user-"));
  tempUserSettingsDirs.push(dir);
  const file = path.join(dir, "settings.json");
  fs.writeFileSync(file, "{}\n");
  return file;
}

afterEach(() => {
  for (const dir of tempTargets) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
  for (const dir of tempUserSettingsDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
  tempTargets = [];
  tempUserSettingsDirs = [];
});

// ─── Test cases ──────────────────────────────────────────────────────────────

describe("install.ps1 — plan-010 Phase 5 narrowed by plan-019", () => {
  // Tests 1-7: structural (parse file content)
  it("Test 1: file exists with valid PowerShell header (param block or CmdletBinding)", () => {
    expect(fs.existsSync(INSTALL_PS1)).toBe(true);
    const content = fs.readFileSync(INSTALL_PS1, "utf8");
    // Must start with a comment block or param() / CmdletBinding declaration
    expect(content).toMatch(/^(#|<#|\[CmdletBinding|param)/m);
  });

  it("Test 2: declares param block with TargetPath, DryRun, ForcePermissionsSync", () => {
    const content = fs.readFileSync(INSTALL_PS1, "utf8");
    // Must have a param block with all three (match is case-insensitive)
    expect(content).toMatch(/param\s*\(/i);
    expect(content).toMatch(/\$TargetPath/i);
    expect(content).toMatch(/\$DryRun/i);
    expect(content).toMatch(/\$ForcePermissionsSync/i);
  });

  it("Test 3: invokes scripts/lib/install-apply.ts via npx tsx (DRY across shells)", () => {
    const content = fs.readFileSync(INSTALL_PS1, "utf8");
    expect(content).toMatch(/npx\s+tsx/);
    expect(content).toMatch(/install-apply\.ts/);
  });

  it("Test 4: uses Copy-Item -Recurse for rules copy (not rsync)", () => {
    const content = fs.readFileSync(INSTALL_PS1, "utf8");
    expect(content).toMatch(/Copy-Item\s+[^|]*-Recurse/i);
    // Not rsync (that's install.sh's territory)
    expect(content).not.toMatch(/rsync/);
  });

  it("Test 5: checks Node version >= 20 before proceeding", () => {
    const content = fs.readFileSync(INSTALL_PS1, "utf8");
    // Must reference node version check (node --version or Get-Command node)
    expect(content).toMatch(/node\s+--version|Get-Command\s+node/i);
    // Must reference version 20 (the minimum)
    expect(content).toMatch(/\b20\b/);
  });

  it("Test 6: writes .kadmon-version at target", () => {
    const content = fs.readFileSync(INSTALL_PS1, "utf8");
    expect(content).toMatch(/\.kadmon-version/);
  });

  it("Test 7: handles -ForcePermissionsSync by passing --force-permissions-sync to install-apply", () => {
    const content = fs.readFileSync(INSTALL_PS1, "utf8");
    // Must reference --force-permissions-sync as an arg to install-apply
    expect(content).toMatch(/--force-permissions-sync/);
    // And must conditionally include it based on $ForcePermissionsSync
    expect(content).toMatch(/\$ForcePermissionsSync/i);
  });

  // Test 8: execution — skipped if PowerShell not available
  it.runIf(powershellAvailable)(
    "Test 8: install.ps1 -TargetPath <tmp> creates rules + settings + .kadmon-version",
    () => {
      if (!POWERSHELL_PATH) {
        throw new Error("runIf guarded incorrectly");
      }
      const target = createFakeTarget();
      const userSettings = createFakeUserSettings();

      const result = spawnSync(
        POWERSHELL_PATH,
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          INSTALL_PS1,
          "-TargetPath",
          target,
        ],
        {
          cwd: REPO_ROOT,
          encoding: "utf8",
          env: {
            ...process.env,
            KADMON_USER_SETTINGS_PATH: userSettings,
          },
          timeout: 120_000,
        },
      );

      expect(result.status, `stderr: ${result.stderr}`).toBe(0);
      expect(fs.existsSync(path.join(target, ".kadmon-version"))).toBe(true);
      expect(fs.existsSync(path.join(target, ".claude", "rules"))).toBe(true);
      expect(fs.existsSync(path.join(target, ".claude", "settings.json"))).toBe(
        true,
      );
    },
  );

  it("Test 9 (plan-019): writes extraKnownMarketplaces — verified via install-apply delegation", () => {
    // Since install.ps1 delegates to install-apply.ts (covered by install-sh.test.ts Test 10),
    // we verify the PS1 file passes --user-settings or relies on KADMON_USER_SETTINGS_PATH env.
    const content = fs.readFileSync(INSTALL_PS1, "utf8");
    // Must either reference the env var OR pass --user-settings explicitly
    expect(content).toMatch(
      /KADMON_USER_SETTINGS_PATH|--user-settings/i,
    );
  });
});
