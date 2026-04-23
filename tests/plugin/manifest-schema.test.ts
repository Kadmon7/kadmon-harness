// TDD [feniks] — plan-019 Phase A.1 — RED phase (updated 2026-04-20)
// Tests for plugin manifest schema: plugin.json + hooks.json
//
// ADR-019 (2026-04-20) changes the contract:
//   - plugin.json MUST NOT contain `commands` or `skills` fields.
//     The loader auto-discovers from canonical root paths `./agents`, `./skills`,
//     `./commands` — which are symlinks into `.claude/<type>/` (plan-019 Step A.2).
//   - Three root symlinks MUST exist and resolve into `.claude/<type>/`.
//
// RED/GREEN forecast per test:
//   Test 1:  PASS  — .claude-plugin/plugin.json exists.                       Unchanged.
//   Test 2:  RED   — plugin.json still has `commands`/`skills` (A.3 removes). GREEN after Step A.3.
//   Test 2b: PASS  — name/version canonical values unchanged.                  Unchanged.
//   Test 3:  PASS  — agents dir exists on disk with >=15 .md files.           Unchanged.
//   Test 4:  RED   — ./commands symlink does not exist yet.                    GREEN after Step A.2.
//   Test 5:  RED   — ./skills symlink does not exist yet.                      GREEN after Step A.2.
//   Test 6:  PASS  — every agent .md has .md extension.                       Unchanged.
//   Test SYM: RED  — symlinks ./agents ./skills ./commands do not exist yet.  GREEN after Step A.2.
//   Test 7:  PASS  — hooks.json exists.                                        Unchanged.
//   Test 8:  PASS  — hooks.json has SessionStart, Stop, PreCompact.            Unchanged.
//   Test 9:  PASS  — every hook command has HOOK_CMD_PREFIX.                   Unchanged.
//   Test 10: PASS  — lifecycle events are registered.                          Unchanged.
//   Test 11: PASS  — no orphaned hook script references.                       Unchanged.

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

// Flat plugin.json schema per ADR-019 (2026-04-20).
// `commands` and `skills` fields are REMOVED — the loader auto-discovers from
// canonical root symlinks (./commands, ./skills) which resolve into .claude/<type>/.
// Only `hooks` remains as a declared component path.
interface PluginJson {
  name: string;
  version: string;
  description: string;
  author?: { name: string } | string;
  license?: string;
  agents?: string;
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
    // Test 1 — PASS (unchanged): file exists and parses as valid JSON.
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
    // Test 2 — RED after A.1: plugin.json must NOT have `commands` or `skills` fields
    // (per ADR-019 the loader auto-discovers from canonical root symlinks).
    // Current plugin.json still has these fields until Step A.3 removes them → RED.
    // GREEN after Step A.3: fields absent from plugin.json.
    "plugin.json has required fields (name, version, description, hooks) and MUST NOT contain commands or skills fields (ADR-019)",
    () => {
      const manifest = loadJson(PLUGIN_JSON_PATH) as PluginJson & Record<string, unknown>;

      expect(typeof manifest.name).toBe("string");
      expect(manifest.name.length).toBeGreaterThan(0);

      expect(typeof manifest.version).toBe("string");
      expect(manifest.version.length).toBeGreaterThan(0);

      expect(typeof manifest.description).toBe("string");
      expect(manifest.description.length).toBeGreaterThan(0);

      // hooks path must still be present — hooks are declared explicitly, not auto-discovered.
      expect(typeof manifest.hooks).toBe("string");
      expect((manifest.hooks as string)).toMatch(/^\.\//);
      expect((manifest.hooks as string)).toMatch(/hooks\.json$/);

      // ADR-019: commands + skills MUST be absent from plugin.json.
      // The loader auto-discovers from canonical root symlinks (./commands, ./skills).
      // If these fields are present, the test goes RED — Step A.3 removes them.
      expect(
        "commands" in manifest,
        "plugin.json must NOT contain a 'commands' field (ADR-019: loader uses ./commands symlink)",
      ).toBe(false);

      expect(
        "skills" in manifest,
        "plugin.json must NOT contain a 'skills' field (ADR-019: loader uses ./skills symlink)",
      ).toBe(false);
    },
  );

  it(
    // Test 2b — PASS (unchanged): canonical field values per ADR-010 contract.
    "plugin.json name is 'kadmon-harness' and version is '1.2.3'",
    () => {
      const manifest = loadJson(PLUGIN_JSON_PATH) as PluginJson;
      expect(manifest.name).toBe("kadmon-harness");
      expect(manifest.version).toBe("1.2.3");
    },
  );
});

describe("plugin.json — component directory paths resolve expected file counts", () => {
  it(
    // Test 3 — PASS (unchanged): agents directory EXISTS on disk with >=15 .md files.
    // plugin.json.agents field was deferred (Sprint D Step 2.5 dogfood showed
    // Claude Code rejects the directory-string; ADR-019 root-symlink approach
    // auto-discovers agents from ./agents symlink). install.sh copies directly.
    "agents directory exists on disk with at least 15 .md files (plugin.json.agents deferred)",
    () => {
      const agentCount = countGlob2(AGENTS_DIR, ".md");
      expect(agentCount).toBeGreaterThanOrEqual(15);
    },
  );

  it(
    // Test 4 — RED after A.1: ./commands symlink does not exist yet.
    // GREEN after Step A.2: symlink created + COMMANDS_DIR has >=11 .md files.
    //
    // ADR-019: plugin.json no longer declares `commands` path. The loader
    // auto-discovers from the canonical root symlink `./commands` → `.claude/commands/`.
    "canonical ./commands symlink exists and resolves to a directory with at least 11 .md files (ADR-019)",
    () => {
      // Assert the root symlink exists (A.2 creates it — RED until then)
      const symlinkPath = path.join(REPO_ROOT, "commands");
      const stat = fs.lstatSync(symlinkPath);
      expect(
        stat.isSymbolicLink(),
        "./commands at repo root must be a symlink (plan-019 Step A.2 not yet run)",
      ).toBe(true);

      // Assert the commands source dir has the expected file count
      const commandCount = countGlob2(COMMANDS_DIR, ".md");
      expect(commandCount).toBeGreaterThanOrEqual(11);
    },
  );

  it(
    // Test 5 — RED after A.1: ./skills symlink does not exist yet.
    // GREEN after Step A.2: symlink created + SKILLS_BASE_DIR has >=40 <name>/SKILL.md files.
    //
    // ADR-019: plugin.json no longer declares `skills` path. The loader
    // auto-discovers from the canonical root symlink `./skills` → `.claude/skills/`.
    // ADR-013: skills live at .claude/skills/<name>/SKILL.md.
    "canonical ./skills symlink exists and resolves to a directory with at least 40 <name>/SKILL.md files (ADR-019)",
    () => {
      // Assert the root symlink exists (A.2 creates it — RED until then)
      const symlinkPath = path.join(REPO_ROOT, "skills");
      const stat = fs.lstatSync(symlinkPath);
      expect(
        stat.isSymbolicLink(),
        "./skills at repo root must be a symlink (plan-019 Step A.2 not yet run)",
      ).toBe(true);

      // Assert the skills source dir has the expected file count
      const skillCount = countGlob3(SKILLS_BASE_DIR, "SKILL.md");
      expect(skillCount).toBeGreaterThanOrEqual(40);
    },
  );
});

describe("plugin.json — agent distribution (pending Sprint E)", () => {
  it(
    // Test 6 — PASS (unchanged): every agent .md file on disk has the .md extension.
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

describe("canonical root symlinks — existence and resolution (ADR-019)", () => {
  it(
    // Test SYM (NEW) — RED after A.1: symlinks ./agents ./skills ./commands do not exist yet.
    // GREEN after Step A.2: three symlinks created at repo root pointing into .claude/<type>/.
    //
    // Verifies per ADR-019:
    //   - Each entry at repo root is a symlink (lstat — not stat — to avoid following the link).
    //   - readlinkSync target matches `.claude/<type>` (normalized, accepting both POSIX and
    //     Windows separators via path.normalize comparison).
    //   - Symlinks resolve to the correct real directory (realpathSync both sides match).
    //   - File counts through each symlink match the source: agents=16, skills=46, commands=11.
    "canonical root symlinks ./agents, ./skills, ./commands exist and resolve to .claude/<type>/ per ADR-019",
    () => {
      const types = ["agents", "skills", "commands"] as const;

      // Expected file counts accessible through each symlink
      const expectedCounts: Record<string, number> = {
        agents: 16,
        skills: 46,
        commands: 11,
      };

      for (const type of types) {
        const linkPath = path.join(REPO_ROOT, type);

        // 1. Symlink must exist at repo root (lstat — does not follow the symlink)
        let stat: fs.Stats;
        try {
          stat = fs.lstatSync(linkPath);
        } catch {
          throw new Error(
            `./${type} does not exist at repo root — plan-019 Step A.2 not yet run`,
          );
        }
        expect(
          stat.isSymbolicLink(),
          `./${type} at repo root must be a symlink (not a real directory or file)`,
        ).toBe(true);

        // 2. readlinkSync target must resolve into .claude/<type> (accept both separators)
        const rawTarget = fs.readlinkSync(linkPath);
        // Normalize both to forward-slash for cross-platform comparison
        const normalizedTarget = rawTarget.replace(/\\/g, "/");
        expect(
          normalizedTarget,
          `./${type} symlink target must point into .claude/${type}`,
        ).toMatch(new RegExp(`\\.claude/${type}$`));

        // 3. Resolved real path must match the canonical source directory
        const resolvedLink = fs.realpathSync(linkPath);
        const expectedTarget = path.join(REPO_ROOT, ".claude", type);
        const resolvedTarget = fs.realpathSync(expectedTarget);
        expect(resolvedLink).toBe(resolvedTarget);

        // 4. File count through the symlink must match the source
        // (agents + commands: flat .md; skills: <name>/SKILL.md subdirectory layout)
        // Agents filter: underscore-prefixed files (e.g. _TEMPLATE.md) are loader-ignored
        // per ADR-017 agent template convention — exclude from the count.
        let count: number;
        if (type === "skills") {
          count = countGlob3(linkPath, "SKILL.md");
        } else if (type === "agents") {
          count = basenamesGlob2(linkPath, ".md").filter(
            (n) => !n.startsWith("_"),
          ).length;
        } else {
          count = countGlob2(linkPath, ".md");
        }
        expect(
          count,
          `File count through ./${type} symlink must be ${expectedCounts[type]} (got ${count})`,
        ).toBe(expectedCounts[type]);
      }
    },
  );
});

describe("hooks.json — existence, JSON validity, and lifecycle hooks", () => {
  it(
    // Test 7 — PASS (unchanged): hooks.json exists and parses as valid JSON.
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
    // Test 8 — PASS (unchanged): hooks.json has SessionStart, Stop, PreCompact.
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
    // Test 9 — PASS (unchanged): every hook command contains the literal HOOK_CMD_PREFIX placeholder.
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
    // Test 10 — PASS (unchanged): SessionStart, Stop, PreCompact event types
    // are present with at least one matcher group each.
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
    // Test 11 — PASS (unchanged): every command references a .js file that
    // actually exists in .claude/hooks/scripts/.
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
