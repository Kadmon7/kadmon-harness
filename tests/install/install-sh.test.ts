// TDD [feniks] — plan-010 Phase 4 + plan-019 narrowed scope (2026-04-20)
// Integration tests for install.sh bash bootstrap.
//
// Scope per plan-019:
//   - install.sh distributes RULES + permissions.deny + .kadmon-version + .gitignore
//     PLUS user-scope settings.json (extraKnownMarketplaces + enabledPlugins) — NEW per plan-019.
//   - install.sh does NOT copy agents/skills/commands — those ride the plugin via
//     canonical root symlinks (ADR-019 Ruta Y).
//   - HOOK_CMD_PREFIX rewrite is deferred to Sprint E (Bug 3 — banner silent in plugin mode).
//
// Windows-safe: BASH detection is synchronous at module scope (it.runIf requires a
// sync value — beforeAll runs too late for it.runIf condition evaluation). Accepts
// both POSIX and Windows path separators in assertions.
// Skips gracefully only on pure PowerShell/CMD hosts where bash truly isn't available.

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

// ─── Repo root (absolute, not process.cwd() — Vitest may shift cwd) ─────────

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const INSTALL_SH = path.join(REPO_ROOT, "install.sh");

// ─── Bash availability check — MUST be synchronous at module scope ────────────
// it.runIf(condition) evaluates condition at define time (import phase), before
// any beforeAll / beforeEach runs. Moving detection to a top-level sync call
// ensures the condition is correct when Vitest decides which tests to schedule.
//
// Strategy:
//   1. Try bare "bash --version" — works on macOS, Linux, Git Bash (when bash.exe
//      is on the PATH that Node inherits from the shell that launched Vitest).
//   2. If that fails (ENOENT), try known absolute paths for Windows Git Bash.
//   3. Skip condition: only when bash is genuinely unavailable (e.g. native CMD).

function detectBash(): string | null {
  // Attempt 1: bare name (works on Mac, Linux, Git Bash with correct PATH)
  const bare = spawnSync("bash", ["--version"], { encoding: "utf8" });
  if (bare.status === 0 && !bare.error) {
    return "bash";
  }

  // Attempt 2: known Windows Git Bash absolute paths (covers cases where
  // Node's PATH does not include Git's usr/bin but the exe is locatable)
  const windowsCandidates = [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
  ];
  for (const candidate of windowsCandidates) {
    if (fs.existsSync(candidate)) {
      const check = spawnSync(candidate, ["--version"], { encoding: "utf8" });
      if (check.status === 0 && !check.error) {
        return candidate;
      }
    }
  }

  return null;
}

const BASH_PATH = detectBash();
const bashAvailable = BASH_PATH !== null;

if (!bashAvailable) {
  console.warn(
    "[install-sh.test] bash not available — all tests will skip. " +
      "This is expected on pure PowerShell/CMD hosts; install.ps1 covers that case.",
  );
}

// ─── Test fixture helpers ────────────────────────────────────────────────────

let tempTargets: string[] = [];
let tempUserSettingsDirs: string[] = [];

function createFakeTarget(opts?: {
  existingSettings?: unknown;
  existingSettingsLocal?: string;
  existingGitignore?: string;
}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-target-"));
  tempTargets.push(dir);
  fs.mkdirSync(path.join(dir, ".claude"), { recursive: true });
  if (opts?.existingSettings !== undefined) {
    fs.writeFileSync(
      path.join(dir, ".claude", "settings.json"),
      JSON.stringify(opts.existingSettings, null, 2) + "\n",
    );
  }
  if (opts?.existingSettingsLocal !== undefined) {
    fs.writeFileSync(
      path.join(dir, ".claude", "settings.local.json"),
      opts.existingSettingsLocal,
    );
  }
  if (opts?.existingGitignore !== undefined) {
    fs.writeFileSync(path.join(dir, ".gitignore"), opts.existingGitignore);
  }
  return dir;
}

/**
 * Create a temp directory with a settings.json file for simulating user-scope
 * ~/.claude/settings.json. Returns the path to the settings.json file itself
 * (not the directory), so install.sh can receive it via KADMON_USER_SETTINGS_PATH.
 */
function createFakeUserSettings(initial?: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-user-"));
  tempUserSettingsDirs.push(dir);
  const file = path.join(dir, "settings.json");
  if (initial !== undefined) {
    fs.writeFileSync(file, JSON.stringify(initial, null, 2) + "\n");
  }
  // Create an empty file if no initial content, so install-apply can read it
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, "{}\n");
  }
  return file;
}

interface InstallResult {
  status: number;
  stdout: string;
  stderr: string;
}

/**
 * Invoke install.sh via the detected bash binary. Passes REPO_ROOT as cwd so
 * relative paths inside install.sh resolve correctly regardless of where Vitest
 * was launched. Extra env vars are merged over process.env.
 */
function runInstallSh(
  args: string[],
  env?: Record<string, string>,
): InstallResult {
  if (!BASH_PATH) {
    throw new Error("runInstallSh called but BASH_PATH is null — bug in test setup");
  }
  const result = spawnSync(BASH_PATH, [INSTALL_SH, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, ...env },
    // Large timeout: install-apply.ts invokes npx tsx which has Node cold-start
    timeout: 60_000,
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function readJson(filePath: string): Record<string, unknown> {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

afterEach(() => {
  for (const dir of tempTargets) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
  for (const dir of tempUserSettingsDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
  tempTargets = [];
  tempUserSettingsDirs = [];
});

// ─── Test cases ──────────────────────────────────────────────────────────────

describe("install.sh — plan-010 Phase 4 narrowed by plan-019", () => {
  it.runIf(bashAvailable)(
    "Test 1: --dry-run prints planned operations without touching filesystem",
    () => {
      const target = createFakeTarget();
      const userSettings = createFakeUserSettings();
      const result = runInstallSh(["--dry-run", target], {
        KADMON_USER_SETTINGS_PATH: userSettings,
      });

      expect(result.status, `stderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toMatch(/\[DRY RUN\]/i);
      // No new files should appear under target/.claude/ (only the empty dir we created)
      expect(fs.existsSync(path.join(target, ".claude", "rules"))).toBe(false);
      expect(fs.existsSync(path.join(target, ".claude", "settings.json"))).toBe(false);
      expect(fs.existsSync(path.join(target, ".kadmon-version"))).toBe(false);
    },
  );

  it.runIf(bashAvailable)(
    "Test 2: copies .claude/rules/**/*.md to target/.claude/rules/",
    () => {
      const target = createFakeTarget();
      const userSettings = createFakeUserSettings();
      const result = runInstallSh([target], {
        KADMON_USER_SETTINGS_PATH: userSettings,
      });

      expect(result.status, `stderr: ${result.stderr}`).toBe(0);
      const targetRules = path.join(target, ".claude", "rules");
      expect(fs.existsSync(targetRules)).toBe(true);

      // Verify at least one canonical rule file landed (common/coding-style.md)
      const codingStyle = path.join(targetRules, "common", "coding-style.md");
      expect(fs.existsSync(codingStyle)).toBe(true);

      // Verify typescript subdir also copied
      const tsStyle = path.join(targetRules, "typescript", "coding-style.md");
      expect(fs.existsSync(tsStyle)).toBe(true);
    },
  );

  it.runIf(bashAvailable)(
    "Test 3: merges permissions.deny into target/.claude/settings.json",
    () => {
      const target = createFakeTarget();
      const userSettings = createFakeUserSettings();
      const result = runInstallSh([target], {
        KADMON_USER_SETTINGS_PATH: userSettings,
      });

      expect(result.status, `stderr: ${result.stderr}`).toBe(0);
      const settingsPath = path.join(target, ".claude", "settings.json");
      expect(fs.existsSync(settingsPath)).toBe(true);
      const settings = readJson(settingsPath);
      const permissions = settings["permissions"] as
        | { deny?: unknown }
        | undefined;
      expect(permissions).toBeDefined();
      expect(Array.isArray(permissions?.deny)).toBe(true);
      const deny = permissions?.deny as string[];
      // Should include canonical rules from CANONICAL_DENY_RULES
      expect(deny).toContain("Read(./.env)");
      expect(deny).toContain("Bash(wget:*)");
      expect(deny).toContain("Bash(git push --force:*)");
    },
  );

  it.runIf(bashAvailable)(
    "Test 4: preserves target's existing settings.json keys (hooks, mcpServers)",
    () => {
      const existing = {
        hooks: { PreToolUse: [{ matcher: "Bash", hooks: [] }] },
        mcpServers: { myServer: { command: "node", args: ["./my.js"] } },
        permissions: { allow: ["Bash(ls:*)"], deny: ["Bash(rm -rf:*)"] },
      };
      const target = createFakeTarget({ existingSettings: existing });
      const userSettings = createFakeUserSettings();
      const result = runInstallSh([target], {
        KADMON_USER_SETTINGS_PATH: userSettings,
      });

      expect(result.status, `stderr: ${result.stderr}`).toBe(0);
      const merged = readJson(path.join(target, ".claude", "settings.json"));
      // Unrelated keys preserved
      expect(merged["hooks"]).toEqual(existing.hooks);
      expect(merged["mcpServers"]).toEqual(existing.mcpServers);
      const permissions = merged["permissions"] as {
        allow: string[];
        deny: string[];
      };
      // Allow list preserved intact
      expect(permissions.allow).toEqual(["Bash(ls:*)"]);
      // Deny list has merged entries (target's "Bash(rm -rf:*)" + harness canonical)
      expect(permissions.deny).toContain("Bash(rm -rf:*)");
      expect(permissions.deny).toContain("Read(./.env)");
    },
  );

  it.runIf(bashAvailable)(
    "Test 5: creates settings.local.json template when missing",
    () => {
      const target = createFakeTarget();
      const userSettings = createFakeUserSettings();
      const result = runInstallSh([target], {
        KADMON_USER_SETTINGS_PATH: userSettings,
      });

      expect(result.status, `stderr: ${result.stderr}`).toBe(0);
      const localPath = path.join(target, ".claude", "settings.local.json");
      expect(fs.existsSync(localPath)).toBe(true);
      const local = readJson(localPath);
      // Template should be a valid JSON object (minimal content acceptable)
      expect(typeof local).toBe("object");
    },
  );

  it.runIf(bashAvailable)(
    "Test 6: NEVER overwrites existing settings.local.json (sentinel test)",
    () => {
      const sentinel = '{ "userSentinel": "DO_NOT_TOUCH_THIS" }\n';
      const target = createFakeTarget({ existingSettingsLocal: sentinel });
      const userSettings = createFakeUserSettings();
      const result = runInstallSh([target], {
        KADMON_USER_SETTINGS_PATH: userSettings,
      });

      expect(result.status, `stderr: ${result.stderr}`).toBe(0);
      const content = fs.readFileSync(
        path.join(target, ".claude", "settings.local.json"),
        "utf8",
      );
      expect(content).toBe(sentinel);
    },
  );

  it.runIf(bashAvailable)(
    "Test 7: writes .kadmon-version with plugin.json version",
    () => {
      const target = createFakeTarget();
      const userSettings = createFakeUserSettings();
      const result = runInstallSh([target], {
        KADMON_USER_SETTINGS_PATH: userSettings,
      });

      expect(result.status, `stderr: ${result.stderr}`).toBe(0);
      const versionFile = path.join(target, ".kadmon-version");
      expect(fs.existsSync(versionFile)).toBe(true);
      const content = fs.readFileSync(versionFile, "utf8").trim();
      // Must match semver-ish pattern; plugin.json currently ships "1.1.0"
      expect(content).toMatch(/^\d+\.\d+\.\d+/);
    },
  );

  it.runIf(bashAvailable)(
    "Test 8: --force-permissions-sync re-merges even if rules already present (dedup)",
    () => {
      // Pre-populate target settings with some canonical harness rules already present
      const existing = {
        permissions: {
          deny: ["Read(./.env)", "Bash(wget:*)", "Custom(foo:*)"],
        },
      };
      const target = createFakeTarget({ existingSettings: existing });
      const userSettings = createFakeUserSettings();
      const result = runInstallSh(["--force-permissions-sync", target], {
        KADMON_USER_SETTINGS_PATH: userSettings,
      });

      expect(result.status, `stderr: ${result.stderr}`).toBe(0);
      const merged = readJson(path.join(target, ".claude", "settings.json"));
      const permissions = merged["permissions"] as { deny: string[] };
      // Dedup: existing canonical rules NOT duplicated
      const denyCount = permissions.deny.filter(
        (r) => r === "Read(./.env)",
      ).length;
      expect(denyCount).toBe(1);
      // Custom target rule preserved
      expect(permissions.deny).toContain("Custom(foo:*)");
      // All canonical rules present
      expect(permissions.deny).toContain("Bash(wget:*)");
      expect(permissions.deny).toContain("Bash(git push --force:*)");
    },
  );

  it.runIf(bashAvailable)(
    "Test 9: appends to .gitignore with dedup against existing content",
    () => {
      // Pre-existing .gitignore already has .claude/agent-memory/
      const existingGitignore = "node_modules/\n.claude/agent-memory/\n";
      const target = createFakeTarget({ existingGitignore });
      const userSettings = createFakeUserSettings();
      const result = runInstallSh([target], {
        KADMON_USER_SETTINGS_PATH: userSettings,
      });

      expect(result.status, `stderr: ${result.stderr}`).toBe(0);
      const content = fs.readFileSync(path.join(target, ".gitignore"), "utf8");
      // Existing entry NOT duplicated
      const memoryLines = content
        .split("\n")
        .filter((line) => line.trim() === ".claude/agent-memory/");
      expect(memoryLines.length).toBe(1);
      // New required entries added
      expect(content).toMatch(/\.claude\/settings\.local\.json/);
      expect(content).toMatch(/dist\//);
    },
  );

  it.runIf(bashAvailable)(
    "Test 10: writes extraKnownMarketplaces + enabledPlugins to user settings (plan-019 new)",
    () => {
      const target = createFakeTarget();
      // Start with empty user settings — install.sh must create the entries
      const userSettings = createFakeUserSettings({});
      const result = runInstallSh([target], {
        KADMON_USER_SETTINGS_PATH: userSettings,
      });

      expect(result.status, `stderr: ${result.stderr}`).toBe(0);
      const user = readJson(userSettings);

      // extraKnownMarketplaces must have a kadmon-harness entry pointing at the harness repo
      const marketplaces = user["extraKnownMarketplaces"] as
        | Record<string, unknown>
        | undefined;
      expect(marketplaces).toBeDefined();
      expect(marketplaces?.["kadmon-harness"]).toBeDefined();

      // enabledPlugins must mark kadmon-harness@kadmon-harness as true
      const enabled = user["enabledPlugins"] as
        | Record<string, unknown>
        | undefined;
      expect(enabled).toBeDefined();
      expect(enabled?.["kadmon-harness@kadmon-harness"]).toBe(true);
    },
  );

  it.runIf(bashAvailable)(
    "Test 12: filters __proto__/constructor/prototype from malicious settings (spektr HIGH 2026-04-20)",
    () => {
      const maliciousProject = JSON.parse(
        '{"__proto__": {"polluted": true}, "constructor": {"x": 1}, "permissions": {"deny": ["Custom(foo:*)"]}}',
      ) as Record<string, unknown>;
      const target = createFakeTarget({ existingSettings: maliciousProject });
      const maliciousUser = JSON.parse(
        '{"__proto__": {"polluted": true}, "enabledPlugins": {"other": true}}',
      ) as Record<string, unknown>;
      const userSettings = createFakeUserSettings(maliciousUser);

      const result = runInstallSh([target], {
        KADMON_USER_SETTINGS_PATH: userSettings,
      });

      expect(result.status, `stderr: ${result.stderr}`).toBe(0);

      // Project settings: raw bytes must not contain forbidden keys
      const projectRaw = fs.readFileSync(
        path.join(target, ".claude", "settings.json"),
        "utf8",
      );
      expect(projectRaw).not.toContain("__proto__");
      expect(projectRaw).not.toContain('"constructor"');
      const project = readJson(path.join(target, ".claude", "settings.json"));
      expect(project["permissions"]).toBeDefined();

      // User settings: raw bytes must not contain forbidden keys
      const userRaw = fs.readFileSync(userSettings, "utf8");
      expect(userRaw).not.toContain("__proto__");
      const user = readJson(userSettings);
      const enabled = user["enabledPlugins"] as Record<string, unknown>;
      expect(enabled["other"]).toBe(true);
      expect(enabled["kadmon-harness@kadmon-harness"]).toBe(true);
    },
  );

  it.runIf(bashAvailable)(
    "Test 11: target path with embedded spaces completes without corruption",
    () => {
      // Simulate Abraham-on-Windows: path under Documents/ or OneDrive/ with spaces
      const parent = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-space-"));
      tempTargets.push(parent);
      const target = path.join(parent, "with spaces", "nested");
      fs.mkdirSync(path.join(target, ".claude"), { recursive: true });
      const userSettings = createFakeUserSettings();

      const result = runInstallSh([target], {
        KADMON_USER_SETTINGS_PATH: userSettings,
      });

      expect(result.status, `stderr: ${result.stderr}`).toBe(0);
      // All critical files must exist under the spaced path
      expect(fs.existsSync(path.join(target, ".kadmon-version"))).toBe(true);
      expect(fs.existsSync(path.join(target, ".claude", "rules"))).toBe(true);
      expect(
        fs.existsSync(path.join(target, ".claude", "settings.json")),
      ).toBe(true);
    },
  );
});
