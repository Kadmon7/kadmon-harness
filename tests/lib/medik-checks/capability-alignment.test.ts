// TDD — Check #14 capability-alignment (plan-029 Phase 4.1)
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCheck } from "../../../scripts/lib/medik-checks/capability-alignment.js";

describe("capability-alignment check (#14)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "cap-align-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function seedClaude(): void {
    mkdirSync(join(tmp, ".claude", "agents"), { recursive: true });
    mkdirSync(join(tmp, ".claude", "skills"), { recursive: true });
    mkdirSync(join(tmp, ".claude", "commands"), { recursive: true });
    mkdirSync(join(tmp, ".claude", "rules", "common"), { recursive: true });
  }

  function writeAgent(name: string, fm: Record<string, string>): void {
    const lines = ["---", `name: ${name}`];
    for (const [k, v] of Object.entries(fm)) lines.push(`${k}: ${v}`);
    lines.push("---", "body");
    writeFileSync(
      join(tmp, ".claude", "agents", `${name}.md`),
      lines.join("\n"),
    );
  }

  function writeSkill(name: string, fm: Record<string, string>): void {
    mkdirSync(join(tmp, ".claude", "skills", name), { recursive: true });
    const lines = ["---", `name: ${name}`, "description: test"];
    for (const [k, v] of Object.entries(fm)) lines.push(`${k}: ${v}`);
    lines.push("---", "body");
    writeFileSync(
      join(tmp, ".claude", "skills", name, "SKILL.md"),
      lines.join("\n"),
    );
  }

  it("(a) aligned matrix -> PASS runtime category", () => {
    seedClaude();
    writeAgent("kody", { model: "sonnet", tools: "Read, Task", skills: "\n  - council" });
    writeSkill("council", { requires_tools: "[Task]", owner: "kody" });
    const result = runCheck({ projectHash: "test", cwd: tmp });
    expect(result.status).toBe("PASS");
    expect(result.category).toBe("runtime");
    expect(result.message).toMatch(/aligned|clean|0 FAIL/i);
  });

  it("(b) capability-mismatch -> FAIL runtime", () => {
    seedClaude();
    writeAgent("konstruct", { model: "opus", tools: "Read, Grep", skills: "\n  - council" });
    writeSkill("council", { requires_tools: "[Task]", owner: "konstruct" });
    const result = runCheck({ projectHash: "test", cwd: tmp });
    expect(result.status).toBe("FAIL");
    expect(result.category).toBe("runtime");
    expect(result.message).toContain("council");
    expect(result.message).toContain("Task");
  });

  it("(c) only orphan-skill NOTE -> NOTE knowledge-hygiene", () => {
    seedClaude();
    writeSkill("lonely", {});
    const result = runCheck({ projectHash: "test", cwd: tmp });
    expect(result.status).toBe("NOTE");
    expect(result.category).toBe("knowledge-hygiene");
  });

  it("(d) mixed 1 FAIL + 1 WARN + 1 NOTE -> FAIL worst-wins", () => {
    seedClaude();
    // FAIL: capability-mismatch
    writeAgent("konstruct", { model: "opus", tools: "Read", skills: "\n  - council" });
    writeSkill("council", { requires_tools: "[Task]", owner: "konstruct" });
    // WARN: ownership-drift (agent owns but does not list)
    writeAgent("kody", { model: "sonnet", tools: "Read, Grep" });
    writeSkill("coding-standards", { owner: "kody" });
    // NOTE: orphan
    writeSkill("lonely", {});
    const result = runCheck({ projectHash: "test", cwd: tmp });
    expect(result.status).toBe("FAIL");
    expect(result.message).toMatch(/FAIL/);
  });

  it("(e) missing .claude/ -> PASS (consistent with stale-plans)", () => {
    // tmp exists but no .claude subdir
    const result = runCheck({ projectHash: "test", cwd: tmp });
    expect(result.status).toBe("PASS");
  });

  it("(f) malformed YAML in an agent file -> does not throw, PASS or NOTE only", () => {
    seedClaude();
    // Malformed: no closing ---
    writeFileSync(
      join(tmp, ".claude", "agents", "broken.md"),
      "---\nname: broken\nno closing",
    );
    const result = runCheck({ projectHash: "test", cwd: tmp });
    expect(["PASS", "NOTE"]).toContain(result.status);
  });
});
