import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lintAgentFrontmatter } from "../../scripts/lib/lint-agent-frontmatter.js";

describe("lint-agent-frontmatter", () => {
  let tmp: string;
  let agentsDir: string;
  let skillsDir: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "lint-agent-"));
    agentsDir = join(tmp, "agents");
    skillsDir = join(tmp, "skills");
    mkdirSync(agentsDir);
    mkdirSync(skillsDir);
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function writeAgent(name: string, frontmatter: string): void {
    writeFileSync(
      join(agentsDir, `${name}.md`),
      `---\n${frontmatter}\n---\n\nbody\n`
    );
  }

  function writeSkill(name: string): void {
    writeFileSync(join(skillsDir, `${name}.md`), "# skill\n");
  }

  it("happy path: block list with all skills existing is OK", () => {
    writeSkill("coding-standards");
    writeSkill("git-workflow");
    writeAgent(
      "kody",
      "name: kody\nskills:\n  - coding-standards\n  - git-workflow"
    );

    const result = lintAgentFrontmatter({ agentsDir, skillsDir });

    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.filesChecked).toBe(1);
  });

  it("scalar regression: comma-separated string is a violation", () => {
    writeSkill("coding-standards");
    writeSkill("git-workflow");
    writeAgent(
      "broken",
      "name: broken\nskills: coding-standards, git-workflow"
    );

    const result = lintAgentFrontmatter({ agentsDir, skillsDir });

    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].file).toBe("broken.md");
    expect(result.violations[0].message).toContain("scalar");
  });

  it("scalar regression: single-skill scalar is still a violation", () => {
    writeSkill("coding-standards");
    writeAgent("kurator", "name: kurator\nskills: coding-standards");

    const result = lintAgentFrontmatter({ agentsDir, skillsDir });

    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].message).toContain("scalar");
  });

  it("unknown skill name: violation per missing skill file", () => {
    writeSkill("coding-standards");
    writeAgent(
      "typo",
      "name: typo\nskills:\n  - coding-standards\n  - nonexistent-skill"
    );

    const result = lintAgentFrontmatter({ agentsDir, skillsDir });

    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].message).toContain("nonexistent-skill");
  });

  it("missing skills field: allowed", () => {
    writeAgent("no-skills", "name: no-skills\ndescription: foo");

    const result = lintAgentFrontmatter({ agentsDir, skillsDir });

    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("empty skills field: allowed", () => {
    writeAgent("empty", "name: empty\nskills:");

    const result = lintAgentFrontmatter({ agentsDir, skillsDir });

    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("multiple agents: aggregates violations across files", () => {
    writeSkill("coding-standards");
    writeAgent("good", "name: good\nskills:\n  - coding-standards");
    writeAgent("bad1", "name: bad1\nskills: coding-standards");
    writeAgent(
      "bad2",
      "name: bad2\nskills:\n  - coding-standards\n  - missing-skill"
    );

    const result = lintAgentFrontmatter({ agentsDir, skillsDir });

    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(2);
    expect(result.filesChecked).toBe(3);
    const files = result.violations.map((v) => v.file).sort();
    expect(files).toEqual(["bad1.md", "bad2.md"]);
  });

  it("no frontmatter: violation", () => {
    writeFileSync(join(agentsDir, "broken.md"), "no frontmatter here\n");

    const result = lintAgentFrontmatter({ agentsDir, skillsDir });

    expect(result.ok).toBe(false);
    expect(result.violations[0].message).toContain("frontmatter");
  });

  it("path traversal: skill name with .. is rejected before fs lookup", () => {
    writeAgent(
      "evil",
      "name: evil\nskills:\n  - coding-standards\n  - ../../../etc/passwd"
    );

    const result = lintAgentFrontmatter({ agentsDir, skillsDir });

    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(2); // missing coding-standards + invalid name
    const invalid = result.violations.find((v) =>
      v.message.includes("invalid skill name")
    );
    expect(invalid).toBeDefined();
    expect(invalid?.message).toContain("../../../etc/passwd");
  });

  it("path separator: skill name with slash is rejected", () => {
    writeSkill("coding-standards");
    writeAgent(
      "sneaky",
      "name: sneaky\nskills:\n  - coding-standards\n  - subdir/skill"
    );

    const result = lintAgentFrontmatter({ agentsDir, skillsDir });

    expect(result.ok).toBe(false);
    const invalid = result.violations.find((v) =>
      v.message.includes("invalid skill name")
    );
    expect(invalid).toBeDefined();
  });

  it("block list with blank lines between items: parses all items", () => {
    writeSkill("a");
    writeSkill("b");
    writeSkill("c");
    writeAgent(
      "spaced",
      "name: spaced\nskills:\n  - a\n\n  - b\n  - c"
    );

    const result = lintAgentFrontmatter({ agentsDir, skillsDir });

    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("missing agents directory: returns violation instead of crashing", () => {
    const result = lintAgentFrontmatter({
      agentsDir: join(tmp, "does-not-exist"),
      skillsDir,
    });

    expect(result.ok).toBe(false);
    expect(result.filesChecked).toBe(0);
    expect(result.violations[0].message).toContain("directory");
  });

  it("integration: real harness agents pass against .claude/skills", () => {
    const realResult = lintAgentFrontmatter({
      agentsDir: ".claude/agents",
      skillsDir: ".claude/skills",
    });

    expect(realResult.violations).toEqual([]);
    expect(realResult.ok).toBe(true);
    expect(realResult.filesChecked).toBeGreaterThanOrEqual(15);
  });
});
