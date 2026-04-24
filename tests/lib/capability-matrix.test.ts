// Tests for scripts/lib/capability-matrix.ts — plan-029 Phase 1-2.
// RED-first per TDD: these reference a module that does not exist yet.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseAgentFrontmatter,
  parseSkillFrontmatter,
  buildCapabilityMatrix,
  scanHeuristicTools,
  findViolations,
} from "../../scripts/lib/capability-matrix.js";
import type {
  AgentEntry,
  SkillEntry,
  CommandEntry,
  CapabilityMatrix,
} from "../../scripts/lib/capability-matrix.js";

function makeMatrix(partial: {
  agents?: AgentEntry[];
  skills?: SkillEntry[];
  commands?: CommandEntry[];
  commandLevelSkills?: Set<string>;
}): CapabilityMatrix {
  return {
    agents: partial.agents ?? [],
    skills: partial.skills ?? [],
    commands: partial.commands ?? [],
    commandLevelSkills: partial.commandLevelSkills ?? new Set(),
    parseErrors: [],
  };
}

function agent(
  name: string,
  tools: string[],
  skills: string[] = [],
): AgentEntry {
  return {
    name,
    filePath: `.claude/agents/${name}.md`,
    tools,
    skills,
    model: "sonnet",
  };
}

function skill(
  name: string,
  opts: Partial<SkillEntry> = {},
): SkillEntry {
  return {
    name,
    filePath: `.claude/skills/${name}/SKILL.md`,
    declaredOwner: opts.declaredOwner,
    requiresTools: opts.requiresTools ?? [],
    heuristicTools: opts.heuristicTools ?? [],
    isCommandLevel: opts.isCommandLevel ?? false,
  };
}

describe("parseAgentFrontmatter", () => {
  it("(a) scalar-form tools: Read, Grep, Write -> string array", () => {
    const content = [
      "---",
      "name: demo",
      "description: demo agent",
      "tools: Read, Grep, Write",
      "---",
      "",
      "body",
    ].join("\n");
    const result = parseAgentFrontmatter(content, "/fake/demo.md");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.tools).toEqual(["Read", "Grep", "Write"]);
  });

  it("(b) YAML block-list skills -> string array", () => {
    const content = [
      "---",
      "name: demo",
      "description: demo agent",
      "skills:",
      "  - coding-standards",
      "  - git-workflow",
      "---",
    ].join("\n");
    const result = parseAgentFrontmatter(content, "/fake/demo.md");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.skills).toEqual(["coding-standards", "git-workflow"]);
  });
});

describe("parseSkillFrontmatter", () => {
  it("(c) flow-style requires_tools: [Task] -> [Task]", () => {
    const content = [
      "---",
      "name: council",
      "description: council skill",
      "requires_tools: [Task]",
      "---",
    ].join("\n");
    const result = parseSkillFrontmatter(content, "/fake/council/SKILL.md");
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.requiresTools).toEqual(["Task"]);
  });

  it("(d) block-list requires_tools -> both items", () => {
    const content = [
      "---",
      "name: deep-research",
      "description: research skill",
      "requires_tools:",
      "  - Task",
      "  - WebFetch",
      "---",
    ].join("\n");
    const result = parseSkillFrontmatter(
      content,
      "/fake/deep-research/SKILL.md",
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.requiresTools).toEqual(["Task", "WebFetch"]);
  });

  it("(e) skill without requires_tools -> empty array", () => {
    const content = [
      "---",
      "name: coding-standards",
      "description: a basic skill",
      "---",
    ].join("\n");
    const result = parseSkillFrontmatter(
      content,
      "/fake/coding-standards/SKILL.md",
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.requiresTools).toEqual([]);
  });

  it("(f) malformed YAML (no closing ---) -> error object, no throw", () => {
    const content = "---\nname: broken\ndescription: no closing\n";
    const result = parseSkillFrontmatter(content, "/fake/broken/SKILL.md");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(typeof result.error).toBe("string");
      expect(result.error.length).toBeGreaterThan(0);
    }
  });
});

describe("buildCapabilityMatrix", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "capmatrix-"));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  function seedMinimalHarness(): void {
    const claude = join(tmpRoot, ".claude");
    mkdirSync(join(claude, "agents"), { recursive: true });
    mkdirSync(join(claude, "skills", "coding-standards"), { recursive: true });
    mkdirSync(join(claude, "skills", "council"), { recursive: true });
    mkdirSync(join(claude, "commands"), { recursive: true });
    mkdirSync(join(claude, "rules", "common"), { recursive: true });

    writeFileSync(
      join(claude, "agents", "kody.md"),
      [
        "---",
        "name: kody",
        "model: sonnet",
        "tools: Read, Grep, Bash",
        "skills:",
        "  - coding-standards",
        "---",
        "body",
      ].join("\n"),
    );

    writeFileSync(
      join(claude, "skills", "coding-standards", "SKILL.md"),
      [
        "---",
        "name: coding-standards",
        "description: standards skill",
        "---",
        "body",
      ].join("\n"),
    );

    writeFileSync(
      join(claude, "skills", "council", "SKILL.md"),
      [
        "---",
        "name: council",
        "description: council skill",
        "requires_tools: [Task]",
        "---",
        "body",
      ].join("\n"),
    );

    writeFileSync(
      join(claude, "commands", "chekpoint.md"),
      [
        "---",
        "description: chekpoint",
        "agent: kody",
        "skills:",
        "  - coding-standards",
        "---",
        "body",
      ].join("\n"),
    );

    writeFileSync(
      join(claude, "rules", "common", "agents.md"),
      [
        "# Agents",
        "",
        "## Command-Level Skills",
        "",
        "| Skill | Loaded by | Why |",
        "|---|---|---|",
        "| `council` | /abra-kdabra | orchestrator-level |",
        "",
        "## Next Section",
        "",
      ].join("\n"),
    );
  }

  it("(g) matrix.agents count matches on-disk agents", () => {
    seedMinimalHarness();
    const matrix = buildCapabilityMatrix({ cwd: tmpRoot });
    expect(matrix.agents).toHaveLength(1);
    expect(matrix.agents[0].name).toBe("kody");
  });

  it("(h) skill listed in Command-Level Skills table has isCommandLevel=true", () => {
    seedMinimalHarness();
    const matrix = buildCapabilityMatrix({ cwd: tmpRoot });
    const council = matrix.skills.find((s) => s.name === "council");
    expect(council).toBeDefined();
    expect(council!.isCommandLevel).toBe(true);
    const cs = matrix.skills.find((s) => s.name === "coding-standards");
    expect(cs).toBeDefined();
    expect(cs!.isCommandLevel).toBe(false);
  });

  it("(i) command.skills parses YAML block-list form", () => {
    seedMinimalHarness();
    const matrix = buildCapabilityMatrix({ cwd: tmpRoot });
    const cmd = matrix.commands.find((c) => c.name === "chekpoint");
    expect(cmd).toBeDefined();
    expect(cmd!.skills).toEqual(["coding-standards"]);
  });

  it("(j) missing .claude/ dir -> empty matrix, no throw", () => {
    // tmpRoot exists but has no .claude subdir
    const matrix = buildCapabilityMatrix({ cwd: tmpRoot });
    expect(matrix.agents).toEqual([]);
    expect(matrix.skills).toEqual([]);
    expect(matrix.commands).toEqual([]);
    expect(matrix.commandLevelSkills.size).toBe(0);
    expect(matrix.parseErrors).toEqual([]);
  });
});

describe("scanHeuristicTools", () => {
  it("(k) mentions Task( outside code fence -> [Task]", () => {
    const body = "This skill invokes sub-agents via Task(role, prompt).";
    expect(scanHeuristicTools(body)).toEqual(["Task"]);
  });

  it("(l) Task( only inside fenced code -> []", () => {
    const body = [
      "Regular prose with no tool mentions.",
      "```",
      "Task(role, prompt)",
      "```",
      "More prose.",
    ].join("\n");
    expect(scanHeuristicTools(body)).toEqual([]);
  });

  it("(m) WebFetch in instruction sentence -> [WebFetch]", () => {
    const body = "Use WebFetch to retrieve the documentation page.";
    expect(scanHeuristicTools(body)).toEqual(["WebFetch"]);
  });

  it("(n) no tool keywords -> []", () => {
    const body = "A plain skill description with no sub-agent invocations.";
    expect(scanHeuristicTools(body)).toEqual([]);
  });

  it("(o) skill body mentions Task but no requires_tools -> heuristicTools=[Task], requiresTools=[]", () => {
    const tmp = mkdtempSync(join(tmpdir(), "capmatrix-heur-"));
    try {
      const skillDir = join(tmp, ".claude", "skills", "heuristic-demo");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, "SKILL.md"),
        [
          "---",
          "name: heuristic-demo",
          "description: demo",
          "---",
          "",
          "This skill invokes voices via Task(role).",
        ].join("\n"),
      );
      const matrix = buildCapabilityMatrix({ cwd: tmp });
      const entry = matrix.skills.find((s) => s.name === "heuristic-demo");
      expect(entry).toBeDefined();
      expect(entry!.heuristicTools).toEqual(["Task"]);
      expect(entry!.requiresTools).toEqual([]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("findViolations", () => {
  it("(p) capability-mismatch FAIL: skill requires Task, owner lacks Task", () => {
    const m = makeMatrix({
      agents: [agent("konstruct", ["Read", "Grep"], ["council"])],
      skills: [
        skill("council", {
          declaredOwner: "konstruct",
          requiresTools: ["Task"],
        }),
      ],
    });
    const v = findViolations(m);
    const mismatch = v.filter((x) => x.kind === "capability-mismatch");
    expect(mismatch).toHaveLength(1);
    expect(mismatch[0].severity).toBe("FAIL");
    expect(mismatch[0].subject).toBe("council");
    expect(mismatch[0].evidence).toContain("Task");
    expect(mismatch[0].evidence).toContain("konstruct");
  });

  it("(q) ownership-drift WARN: agent owns skill but does not list it", () => {
    const m = makeMatrix({
      agents: [agent("kody", ["Read"], [])],
      skills: [
        skill("coding-standards", { declaredOwner: "kody" }),
      ],
    });
    const v = findViolations(m);
    const drift = v.filter((x) => x.kind === "ownership-drift");
    expect(drift).toHaveLength(1);
    expect(drift[0].severity).toBe("WARN");
    expect(drift[0].subject).toBe("coding-standards");
  });

  it("(r) path-drift FAIL: command skills reference contains / (flat-path form)", () => {
    const m = makeMatrix({
      commands: [
        {
          name: "badcmd",
          filePath: ".claude/commands/badcmd.md",
          skills: ["foo/SKILL.md"],
          agents: [],
        },
      ],
    });
    const v = findViolations(m);
    const drift = v.filter((x) => x.kind === "path-drift");
    expect(drift).toHaveLength(1);
    expect(drift[0].severity).toBe("FAIL");
  });

  it("(s) command-skill-drift FAIL: command references non-existent skill", () => {
    const m = makeMatrix({
      skills: [skill("real-skill")],
      commands: [
        {
          name: "cmd",
          filePath: ".claude/commands/cmd.md",
          skills: ["ghost-skill"],
          agents: [],
        },
      ],
    });
    const v = findViolations(m);
    const drift = v.filter((x) => x.kind === "command-skill-drift");
    expect(drift).toHaveLength(1);
    expect(drift[0].severity).toBe("FAIL");
    expect(drift[0].subject).toBe("ghost-skill");
  });

  it("(t) orphan-skill NOTE: skill with no owner and not command-level", () => {
    const m = makeMatrix({
      skills: [skill("lonely")],
    });
    const v = findViolations(m);
    const orphans = v.filter((x) => x.kind === "orphan-skill");
    expect(orphans).toHaveLength(1);
    expect(orphans[0].severity).toBe("NOTE");
    expect(orphans[0].subject).toBe("lonely");
  });

  it("(u) heuristic-tool-mismatch WARN: heuristicTools has Task, requiresTools empty, owner lacks Task", () => {
    const m = makeMatrix({
      agents: [agent("konstruct", ["Read"], ["suspect"])],
      skills: [
        skill("suspect", {
          declaredOwner: "konstruct",
          heuristicTools: ["Task"],
          requiresTools: [],
        }),
      ],
    });
    const v = findViolations(m);
    const h = v.filter((x) => x.kind === "heuristic-tool-mismatch");
    expect(h).toHaveLength(1);
    expect(h[0].severity).toBe("WARN");
  });

  it("(v) clean matrix -> empty violations", () => {
    const m = makeMatrix({
      agents: [agent("kody", ["Read", "Task"], ["coding-standards"])],
      skills: [
        skill("coding-standards", { declaredOwner: "kody" }),
      ],
    });
    const v = findViolations(m);
    expect(v).toEqual([]);
  });
});
