// Agent frontmatter linter for the Kadmon Harness.
//
// Enforces ADR-012 (YAML block-list syntax) and ADR-013 (subdirectory
// path resolution): every agent declares its skills: field as a YAML
// block list, and every declared skill exists at
// `.claude/skills/<name>/SKILL.md` (per Anthropic's native sub-agent
// loader contract at https://code.claude.com/docs/en/skills). Prevents
// regression of the scalar bug where `skills: a, b, c` was silently
// parsed as a single string AND the flat-path bug where the loader
// silently dropped skills that weren't in the subdirectory layout.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface LintViolation {
  file: string;
  message: string;
}

export interface LintResult {
  ok: boolean;
  filesChecked: number;
  violations: LintViolation[];
}

export interface LintOptions {
  agentsDir: string;
  skillsDir: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
// Strict skill name: lowercase alphanumeric + dash/underscore, must start with
// alphanumeric. Rejects path separators, parent traversal, quotes, whitespace.
const VALID_SKILL_NAME = /^[a-z0-9][a-z0-9_-]*$/i;

export function lintAgentFrontmatter(options: LintOptions): LintResult {
  const { agentsDir, skillsDir } = options;

  if (!existsSync(agentsDir)) {
    return {
      ok: false,
      filesChecked: 0,
      violations: [
        { file: agentsDir, message: `agents directory not found: ${agentsDir}` },
      ],
    };
  }

  const files = readdirSync(agentsDir)
    .filter((f) => f.endsWith(".md"))
    .sort();

  const violations: LintViolation[] = [];

  for (const file of files) {
    const filePath = join(agentsDir, file);
    const content = readFileSync(filePath, "utf8");
    const fmMatch = content.match(FRONTMATTER_RE);
    if (!fmMatch) {
      violations.push({ file, message: "no YAML frontmatter block" });
      continue;
    }

    const fmLines = fmMatch[1].split(/\r?\n/);
    const skillsIdx = fmLines.findIndex((l) => /^skills:/.test(l));
    if (skillsIdx === -1) {
      // skills field missing — allowed (agent declares no skills)
      continue;
    }

    const skillsLine = fmLines[skillsIdx];
    const afterColon = skillsLine.slice("skills:".length).trim();
    if (afterColon !== "") {
      violations.push({
        file,
        message: `skills field must be a YAML block list, got scalar: "${afterColon}"`,
      });
      continue;
    }

    // Block list form: collect subsequent indented `- item` lines. Blank
    // lines and comments are allowed inside the list (valid YAML).
    const listItems: string[] = [];
    for (let i = skillsIdx + 1; i < fmLines.length; i++) {
      const line = fmLines[i];
      const itemMatch = line.match(/^\s+-\s+(.+?)\s*$/);
      if (itemMatch) {
        listItems.push(itemMatch[1]);
        continue;
      }
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.startsWith("#")) {
        // Blank or comment: keep scanning.
        continue;
      }
      // Anything else (next top-level key) ends the list.
      break;
    }

    if (listItems.length === 0) {
      // Empty declaration — allowed.
      continue;
    }

    for (const skill of listItems) {
      if (!VALID_SKILL_NAME.test(skill)) {
        violations.push({
          file,
          message: `invalid skill name (must match [a-z0-9][a-z0-9_-]*): "${skill}"`,
        });
        continue;
      }
      const skillPath = join(skillsDir, skill, "SKILL.md");
      if (!existsSync(skillPath)) {
        violations.push({
          file,
          message: `declared skill not found: ${skill}/SKILL.md`,
        });
      }
    }
  }

  return {
    ok: violations.length === 0,
    filesChecked: files.length,
    violations,
  };
}
