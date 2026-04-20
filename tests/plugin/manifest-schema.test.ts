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

interface PluginComponents {
  agents: string;
  commands: string;
  skills: string;
  hooks: string;
}

interface PluginJson {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  engines?: Record<string, string>;
  components: PluginComponents;
}

interface HookEntry {
  name: string;
  command: string;
  env?: Record<string, string>;
  matcher?: string;
}

interface HooksJson {
  hooks: Record<string, HookEntry[]>;
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
    // GREEN after Step 2.2: all four required fields present.
    "plugin.json has required fields: name, version, description, components",
    () => {
      const manifest = loadJson(PLUGIN_JSON_PATH) as PluginJson;

      expect(typeof manifest.name).toBe("string");
      expect(manifest.name.length).toBeGreaterThan(0);

      expect(typeof manifest.version).toBe("string");
      expect(manifest.version.length).toBeGreaterThan(0);

      expect(typeof manifest.description).toBe("string");
      expect(manifest.description.length).toBeGreaterThan(0);

      expect(manifest.components).toBeDefined();
      expect(typeof manifest.components).toBe("object");
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

describe("plugin.json — components globs match expected file counts", () => {
  it(
    // Test 3 — RED today: ENOENT on plugin.json.
    // GREEN after Step 2.2: agents glob matches >=15 .md files.
    // .claude/agents/*.md includes _TEMPLATE.md (17 total on disk). Lower bound >=15 survives growth.
    "plugin.json.components.agents glob matches at least 15 agent .md files",
    () => {
      const manifest = loadJson(PLUGIN_JSON_PATH) as PluginJson;

      // Validate the glob string has the expected shape
      expect(manifest.components.agents).toMatch(/\.claude\/agents\/\*\.md/);

      // Count matching files on disk
      const agentCount = countGlob2(AGENTS_DIR, ".md");
      expect(agentCount).toBeGreaterThanOrEqual(15);
    },
  );

  it(
    // Test 4 — RED today: ENOENT on plugin.json.
    // GREEN after Step 2.2: commands glob matches >=11 .md files.
    "plugin.json.components.commands glob matches at least 11 command .md files",
    () => {
      const manifest = loadJson(PLUGIN_JSON_PATH) as PluginJson;

      expect(manifest.components.commands).toMatch(/\.claude\/commands\/\*\.md/);

      const commandCount = countGlob2(COMMANDS_DIR, ".md");
      expect(commandCount).toBeGreaterThanOrEqual(11);
    },
  );

  it(
    // Test 5 — RED today: ENOENT on plugin.json.
    // GREEN after Step 2.2: skills glob matches >=40 SKILL.md files.
    // ADR-013: skills live at .claude/skills/<name>/SKILL.md — 3-segment glob.
    "plugin.json.components.skills glob matches at least 40 SKILL.md files",
    () => {
      const manifest = loadJson(PLUGIN_JSON_PATH) as PluginJson;

      // Must use 3-segment glob per ADR-013 subdirectory layout
      expect(manifest.components.skills).toMatch(/\.claude\/skills\/\*\/SKILL\.md/);

      const skillCount = countGlob3(SKILLS_BASE_DIR, "SKILL.md");
      expect(skillCount).toBeGreaterThanOrEqual(40);
    },
  );
});

describe("plugin.json — all agent files are discoverable (no orphans)", () => {
  it(
    // Test 6 — RED today: ENOENT on plugin.json.
    // GREEN after Step 2.2: every .claude/agents/*.md is reachable via manifest agents glob.
    "every .claude/agents/*.md file is discoverable by the agent glob (no agent orphaned)",
    () => {
      const manifest = loadJson(PLUGIN_JSON_PATH) as PluginJson;
      const agentGlob = manifest.components.agents;
      expect(agentGlob).toBeTruthy();

      // List of all .md files on disk under agents/
      const diskBasenames = basenamesGlob2(AGENTS_DIR, ".md");

      // The glob (.claude/agents/*.md) covers all *.md files in that dir — no filtering
      // applied by the manifest itself. So every disk file must be covered.
      for (const name of diskBasenames) {
        // If the glob is *.md it matches all .md files — no orphan is possible unless
        // the glob were narrowed (e.g. specific filenames). Verify the glob is a wildcard.
        const isWildcardGlob = agentGlob.includes("*");
        const msg = "agents glob must be a wildcard pattern to avoid orphaning agent files";
        expect(isWildcardGlob, msg).toBe(true);

        // Confirm the file has .md extension (matches *.md glob)
        const matchesMd = name.endsWith(".md");
        expect(matchesMd).toBe(true);
      }

      // Sanity: at least 15 agent files covered
      expect(diskBasenames.length).toBeGreaterThanOrEqual(15);
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

      // Collect all hook entries across all event types
      const allEntries: HookEntry[] = Object.values(hooksJson.hooks).flat();
      expect(allEntries.length, "hooks.json must contain at least one hook entry").toBeGreaterThan(0);

      // Build the placeholder string by concatenation to avoid parser issues with dollar-brace sequences
      const PLACEHOLDER = "$" + "{HOOK_CMD_PREFIX}";

      for (const entry of allEntries) {
        const hasPlaceholder = entry.command.includes(PLACEHOLDER);
        const msg = "hook '" + entry.name + "' command must contain the HOOK_CMD_PREFIX placeholder";
        expect(hasPlaceholder, msg).toBe(true);
      }
    },
  );
});

describe("hooks.json — lifecycle hooks carry KADMON_RUNTIME_ROOT env var", () => {
  it(
    // Test 10 — RED today: ENOENT.
    // GREEN after Step 2.4: SessionStart, Stop, PreCompact entries have
    // env.KADMON_RUNTIME_ROOT set to the CLAUDE_PLUGIN_DATA placeholder value.
    "SessionStart, Stop, and PreCompact hooks carry KADMON_RUNTIME_ROOT env pointing to CLAUDE_PLUGIN_DATA",
    () => {
      const hooksJson = loadJson(HOOKS_JSON_PATH) as HooksJson;

      const lifecycleGroups = ["SessionStart", "Stop", "PreCompact"];
      // Build the expected value by concatenation to avoid parser issues with dollar-brace sequences
      const EXPECTED_ENV_VALUE = "$" + "{CLAUDE_PLUGIN_DATA}";

      for (const groupName of lifecycleGroups) {
        const entries = hooksJson.hooks[groupName];

        const arrayMsg = "hooks." + groupName + " must be an array";
        expect(Array.isArray(entries), arrayMsg).toBe(true);

        for (const entry of entries) {
          const envMsg = "hook '" + entry.name + "' in " + groupName + " must have an env block";
          expect(entry.env, envMsg).toBeDefined();

          const runtimeRootMsg = "hook '" + entry.name + "' in " + groupName + " must have env.KADMON_RUNTIME_ROOT set to the CLAUDE_PLUGIN_DATA placeholder";
          expect(entry.env?.["KADMON_RUNTIME_ROOT"], runtimeRootMsg).toBe(EXPECTED_ENV_VALUE);
        }
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
    "every hooks.json entry references an existing script in .claude/hooks/scripts/",
    () => {
      const hooksJson = loadJson(HOOKS_JSON_PATH) as HooksJson;

      const allEntries: HookEntry[] = Object.values(hooksJson.hooks).flat();
      const sizeMsg = "hooks.json must contain at least one hook entry";
      expect(allEntries.length, sizeMsg).toBeGreaterThan(0);

      // Regex to extract the script filename from the hook command string.
      // Expected command prefix: HOOK_CMD_PREFIX + CLAUDE_PLUGIN_ROOT path + .claude/hooks/scripts/<name>.js
      const SCRIPT_RE = /\.claude\/hooks\/scripts\/([\w-]+\.js)/;

      for (const entry of allEntries) {
        const match = SCRIPT_RE.exec(entry.command);

        const matchMsg = "hook '" + entry.name + "' command does not reference a .claude/hooks/scripts/*.js path";
        expect(match, matchMsg).not.toBeNull();

        if (match) {
          const scriptName = match[1];
          const scriptPath = path.join(HOOKS_SCRIPTS_DIR, scriptName);
          const existsMsg = "hook '" + entry.name + "' references script '" + scriptName + "' which does NOT exist on disk";
          expect(fs.existsSync(scriptPath), existsMsg).toBe(true);
        }
      }
    },
  );
});
