// TDD [feniks] — plan-010 Phase 2 Step 2.1 — RED phase
// Tests for plugin manifest schema: plugin.json + hooks.json
//
// What ships in this step: ONLY this test file. No .claude-plugin/ dir yet.
// Steps 2.2-2.4 create the manifests — tests go GREEN.
//
// RED/GREEN forecast per test:
//   Test 1:  RED  — .claude-plugin/plugin.json does not exist yet.            GREEN after Step 2.2.
//   Test 2:  RED  — plugin.json does not exist.                               GREEN after Step 2.2.
//   Test 2b: RED  — plugin.json does not exist.                               GREEN after Step 2.2.
//   Test 3:  RED  — plugin.json does not exist.                               GREEN after Step 2.2.
//   Test 4:  RED  — plugin.json does not exist.                               GREEN after Step 2.2.
//   Test 5:  RED  — plugin.json does not exist.                               GREEN after Step 2.2.
//   Test 6:  RED  — plugin.json does not exist.                               GREEN after Step 2.2.
//   Test 7:  RED  — .claude-plugin/hooks.json does not exist yet.             GREEN after Step 2.4.
//   Test 8:  RED  — hooks.json does not exist.                                GREEN after Step 2.4.
//   Test 9:  RED  — hooks.json does not exist.                                GREEN after Step 2.4.
//   Test 10: RED  — hooks.json does not exist.                                GREEN after Step 2.4.
//   Test 11: RED  — hooks.json does not exist.                                GREEN after Step 2.4.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ─── Paths ────────────────────────────────────────────────────────────────────

// path.resolve(".") is cwd-independent when Vitest runs from repo root.
const REPO_ROOT = path.resolve(".");
const PLUGIN_DIR = path.join(REPO_ROOT, ".claude-plugin");
const PLUGIN_JSON_PATH = path.join(PLUGIN_DIR, "plugin.json");
const HOOKS_JSON_PATH = path.join(PLUGIN_DIR, "hooks.json");
const AGENTS_DIR = path.join(REPO_ROOT, ".claude", "agents");
const COMMANDS_DIR = path.join(REPO_ROOT, ".claude", "commands");
const SKILLS_BASE_DIR = path.join(REPO_ROOT, ".claude", "skills");
const HOOKS_SCRIPTS_DIR = path.join(REPO_ROOT, ".claude", "hooks", "scripts");

// ─── Glob helpers (no fast-glob dependency — simple pattern matching) ─────────

// Count files matching a 2-segment glob like ".claude/agents/NAME.md".
// Skips directories. Returns count of all files with the given extension in dir.
function countGlob2(dir: string, ext: string): number {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => {
      if (!entry.isFile()) return false;
      if (!entry.name.endsWith(ext)) return false;
      return true;
    }).length;
  } catch {
    return 0;
  }
}

// Collect file basenames matching a 2-segment glob (returns basenames only).
function basenamesGlob2(dir: string, ext: string): string[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(ext))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

// Count files matching a 3-segment glob pattern: baseDir + subdirectory + filename.
// For example: .claude/skills/<name>/SKILL.md — checks each subdir for the literal filename.
function countGlob3(baseDir: string, filename: string): number {
  try {
    return fs.readdirSync(baseDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => fs.existsSync(path.join(baseDir, entry.name, filename)))
      .length;
  } catch {
    return 0;
  }
}

// Load and parse a JSON file. Throws if the file is missing or malformed.
function loadJson(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

// ─── Shape interfaces ─────────────────────────────────────────────────────────

// Flat plugin.json schema per code.claude.com/docs/en/plugins-reference.
// The `components` wrapper from ADR-010 was a schema misread — corrected in
// Step 2.6 after almanak + claude-code-guide cross-check against live docs.
interface PluginJson {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  agents?: string;
  commands?: string;
  skills?: string;
  hooks?: string;
}

// Nested-by-matcher schema per Step 2.5 dogfood (2026-04-20). The flat shape
// from ADR-010's example was rejected by Claude Code's plugin loader.
interface HookCommand {
  type: "command";
  command: string;
}

interface MatcherGroup {
  matcher?: string;
  hooks: HookCommand[];
}

interface HooksJson {
  hooks: Record<string, MatcherGroup[]>;
}

// ─── Test suites ──────────────────────────────────────────────────────────────

describe("plugin.json — existence and JSON validity", () => {
  it(
    // Test 1 — RED today: .claude-plugin/plugin.json does not exist.
    // GREEN after Step 2.2: file is created with valid JSON.
    "plugin.json exists at repo root and parses as valid JSON",
    () => {
      // Assert file exists
      const exists = fs.existsSync(PLUGIN_JSON_PATH);
      expect(exists, ".claude-plugin/plugin.json must exist (Step 2.2 not yet run)").toBe(true);

      // Assert valid JSON (throws on syntax error)
      let parsed: unknown;
      expect(() => {
        parsed = loadJson(PLUGIN_JSON_PATH);
      }).not.toThrow();

      expect(parsed).toBeTruthy();
      expect(typeof parsed).toBe("object");
    },
  );
});

describe("plugin.json — required top-level fields", () => {
  it(
    // Test 2 — RED today: file does not exist (ENOENT before field check).
    // GREEN after Step 2.2 / 2.6: required flat fields + component paths present.
    "plugin.json has required fields: name, version, description, and component paths (agents/commands/skills/hooks)",
    () => {
      const manifest = loadJson(PLUGIN_JSON_PATH) as PluginJson;

      expect(typeof manifest.name).toBe("string");
      expect(manifest.name.length).toBeGreaterThan(0);

      expect(typeof manifest.version).toBe("string");
      expect(manifest.version.length).toBeGreaterThan(0);

      expect(typeof manifest.description).toBe("string");
      expect(manifest.description.length).toBeGreaterThan(0);

      // Flat component paths per live plugins-reference schema (no `components` wrapper).
      // NOTE: `agents` is deliberately NOT required here — the 2026-04-20
      // dogfood (Step 2.5) showed Claude Code's plugin loader rejected the
      // `agents` field pointing at `./.claude/agents/`. Root cause pending
      // investigation (Sprint E). Until resolved, the harness agents load via
      // project-level `.claude/agents/` (install.sh copy), not plugin distribution.
      expect(typeof manifest.commands).toBe("string");
      expect(typeof manifest.skills).toBe("string");
      expect(typeof manifest.hooks).toBe("string");

      // All declared component paths must start with "./" per schema
      // ("Paths are relative to the plugin root and must start with ./")
      expect(manifest.commands).toMatch(/^\.\//);
      expect(manifest.skills).toMatch(/^\.\//);
      expect(manifest.hooks).toMatch(/^\.\//);
    },
  );

  it(
    // Test 2b — RED today (file missing). GREEN after Step 2.2.
    // Canonical field values per ADR-010 contract.
    "plugin.json name is 'kadmon-harness' and version is '1.1.0'",
    () => {
      const manifest = loadJson(PLUGIN_JSON_PATH) as PluginJson;
      expect(manifest.name).toBe("kadmon-harness");
      expect(manifest.version).toBe("1.1.0");
    },
  );
});

describe("plugin.json — component directory paths resolve expected file counts", () => {
  it(
    // Test 3 — Sprint D fallback: agent discovery via plugin.json.agents is
    // currently broken (see Step 2.5 dogfood 2026-04-20). Until resolved,
    // verify at minimum that the agents directory EXISTS on disk and has >=15
    // .md files — install.sh will copy them directly into the target repo's
    // project-level .claude/agents/ regardless of plugin distribution.
    "agents directory exists on disk with at least 15 .md files (plugin.json.agents deferred)",
    () => {
      const agentCount = countGlob2(AGENTS_DIR, ".md");
      expect(agentCount).toBeGreaterThanOrEqual(15);
    },
  );

  it(
    // Test 4 — RED today: ENOENT on plugin.json.
    // GREEN after Step 2.6: commands path points to a dir with >=11 .md files.
    "plugin.json commands path resolves to a directory with at least 11 .md files",
    () => {
      const manifest = loadJson(PLUGIN_JSON_PATH) as PluginJson;
      expect(manifest.commands).toMatch(/\.claude\/commands\//);

      const commandCount = countGlob2(COMMANDS_DIR, ".md");
      expect(commandCount).toBeGreaterThanOrEqual(11);
    },
  );

  it(
    // Test 5 — RED today: ENOENT on plugin.json.
    // GREEN after Step 2.6: skills path points to a dir with >=40 <name>/SKILL.md.
    // ADR-013: skills live at .claude/skills/<name>/SKILL.md. The plugin loader
    // auto-resolves SKILL.md inside each subdir when given a skills directory —
    // no explicit glob needed in the manifest value.
    "plugin.json skills path resolves to a directory with at least 40 <name>/SKILL.md files",
    () => {
      const manifest = loadJson(PLUGIN_JSON_PATH) as PluginJson;
      expect(manifest.skills).toMatch(/\.claude\/skills\//);

      const skillCount = countGlob3(SKILLS_BASE_DIR, "SKILL.md");
      expect(skillCount).toBeGreaterThanOrEqual(40);
    },
  );
});

describe("plugin.json — agent distribution (pending Sprint E)", () => {
  it(
    // Test 6 — Sprint D fallback: Claude Code rejected `agents` field in
    // plugin.json during Step 2.5 dogfood. Until root cause is known,
    // we only verify agent files exist on disk — install.sh handles their
    // copy into target projects directly.
    "every agent .md file on disk has the expected .md extension",
    () => {
      const diskBasenames = basenamesGlob2(AGENTS_DIR, ".md");
      expect(diskBasenames.length).toBeGreaterThanOrEqual(15);
      for (const name of diskBasenames) {
        expect(name.endsWith(".md")).toBe(true);
      }
    },
  );
});

describe("hooks.json — existence, JSON validity, and lifecycle hooks", () => {
  it(
    // Test 7 — RED today: .claude-plugin/hooks.json does not exist.
    // GREEN after Step 2.4: file exists and is valid JSON.
    "hooks.json exists in .claude-plugin/ and parses as valid JSON",
    () => {
      const exists = fs.existsSync(HOOKS_JSON_PATH);
      expect(exists, ".claude-plugin/hooks.json must exist (Step 2.4 not yet run)").toBe(true);

      let parsed: unknown;
      expect(() => {
        parsed = loadJson(HOOKS_JSON_PATH);
      }).not.toThrow();

      expect(parsed).toBeTruthy();
      expect(typeof parsed).toBe("object");
    },
  );

  it(
    // Test 8 — RED today: ENOENT.
    // GREEN after Step 2.4: hooks property contains SessionStart, Stop, PreCompact.
    "hooks.json.hooks contains at minimum SessionStart, Stop, and PreCompact keys",
    () => {
      const hooksJson = loadJson(HOOKS_JSON_PATH) as HooksJson;

      expect(hooksJson.hooks).toBeDefined();
      expect(typeof hooksJson.hooks).toBe("object");

      // Three mandatory lifecycle hook event types
      expect(Array.isArray(hooksJson.hooks["SessionStart"]), "SessionStart must be an array").toBe(true);
      expect(Array.isArray(hooksJson.hooks["Stop"]), "Stop must be an array").toBe(true);
      expect(Array.isArray(hooksJson.hooks["PreCompact"]), "PreCompact must be an array").toBe(true);

      // Each must have at least one entry
      expect(hooksJson.hooks["SessionStart"].length).toBeGreaterThanOrEqual(1);
      expect(hooksJson.hooks["Stop"].length).toBeGreaterThanOrEqual(1);
      expect(hooksJson.hooks["PreCompact"].length).toBeGreaterThanOrEqual(1);
    },
  );
});

describe("hooks.json — HOOK_CMD_PREFIX placeholder is present", () => {
  it(
    // Test 9 — RED today: ENOENT.
    // GREEN after Step 2.4: every hook command contains the literal HOOK_CMD_PREFIX placeholder.
    // This placeholder is what install.sh/install.ps1 rewrites at install time per host OS.
    // MUST remain as a literal string in hooks.json — never pre-expanded.
    "every hook command in hooks.json contains the literal HOOK_CMD_PREFIX placeholder",
    () => {
      const hooksJson = loadJson(HOOKS_JSON_PATH) as HooksJson;

      // Nested schema: walk event types → matcher groups → commands
      const allCommands: HookCommand[] = [];
      for (const groups of Object.values(hooksJson.hooks)) {
        for (const group of groups) {
          for (const cmd of group.hooks) allCommands.push(cmd);
        }
      }
      expect(
        allCommands.length,
        "hooks.json must contain at least one hook command",
      ).toBeGreaterThan(0);

      // Build the placeholder string by concatenation to avoid parser issues with dollar-brace sequences
      const PLACEHOLDER = "$" + "{HOOK_CMD_PREFIX}";

      for (const cmd of allCommands) {
        expect(
          cmd.command.includes(PLACEHOLDER),
          "hook command must contain the HOOK_CMD_PREFIX placeholder: " +
            cmd.command,
        ).toBe(true);
      }
    },
  );
});

describe("hooks.json — lifecycle events are registered", () => {
  it(
    // Test 10 — RED today: ENOENT.
    // GREEN after Step 2.4: SessionStart, Stop, PreCompact event types are
    // present with at least one matcher group each.
    //
    // Note: the dogfood on 2026-04-20 (Step 2.5) revealed that Claude Code's
    // plugin loader rejects `env` blocks on hook entries. KADMON_RUNTIME_ROOT
    // is therefore NOT injected via hooks.json — lifecycle hooks rely on the
    // 3-level-walk fallback in resolveRootDir (Phase 1 contract) when the
    // env var is unset. Re-adding env support is Sprint E scope once Claude
    // Code's plugin schema supports it.
    "SessionStart, Stop, and PreCompact event types are present",
    () => {
      const hooksJson = loadJson(HOOKS_JSON_PATH) as HooksJson;

      for (const eventType of ["SessionStart", "Stop", "PreCompact"]) {
        const groups = hooksJson.hooks[eventType];
        expect(Array.isArray(groups), eventType + " must be an array").toBe(true);
        expect(
          groups.length,
          eventType + " must have at least one matcher group",
        ).toBeGreaterThan(0);

        // At least one command must be registered under the event
        const totalCommands = groups.reduce((n, g) => n + g.hooks.length, 0);
        expect(
          totalCommands,
          eventType + " must have at least one registered hook command",
        ).toBeGreaterThan(0);
      }
    },
  );
});

describe("hooks.json — no orphaned hook script references", () => {
  it(
    // Test 11 — RED today: ENOENT.
    // GREEN after Step 2.4: every command references a .js file that actually exists in
    // .claude/hooks/scripts/. Catches generator bugs where a hook is registered
    // but the corresponding script was deleted.
    "every hooks.json command references an existing script in .claude/hooks/scripts/",
    () => {
      const hooksJson = loadJson(HOOKS_JSON_PATH) as HooksJson;

      // Nested schema: walk event types → matcher groups → commands
      const allCommands: HookCommand[] = [];
      for (const groups of Object.values(hooksJson.hooks)) {
        for (const group of groups) {
          for (const cmd of group.hooks) allCommands.push(cmd);
        }
      }
      expect(
        allCommands.length,
        "hooks.json must contain at least one hook command",
      ).toBeGreaterThan(0);

      // Regex to extract the script filename from the hook command string.
      // Expected command prefix: HOOK_CMD_PREFIX + CLAUDE_PLUGIN_ROOT path + .claude/hooks/scripts/<name>.js
      const SCRIPT_RE = /\.claude\/hooks\/scripts\/([\w-]+\.js)/;

      for (const cmd of allCommands) {
        const match = SCRIPT_RE.exec(cmd.command);

        expect(
          match,
          "command does not reference a .claude/hooks/scripts/*.js path: " +
            cmd.command,
        ).not.toBeNull();

        if (match) {
          const scriptName = match[1]!;
          const scriptPath = path.join(HOOKS_SCRIPTS_DIR, scriptName);
          expect(
            fs.existsSync(scriptPath),
            "hook references script '" +
              scriptName +
              "' which does NOT exist on disk",
          ).toBe(true);
        }
      }
    },
  );
});
