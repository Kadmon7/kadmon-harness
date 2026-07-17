import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  buildCatalog,
  buildTelemetry,
} from "../../scripts/lib/dashboard-web-data.js";
import {
  openDb,
  closeDb,
  upsertSession,
  upsertInstinct,
  insertCostEvent,
  insertHookEvent,
  insertAgentInvocation,
} from "../../scripts/lib/state-store.js";

// ─── Fixture helpers ───

function writeFrontmatterFile(
  filePath: string,
  frontmatter: Record<string, string>,
  body = "Body content.\n",
): void {
  const lines = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    // Quote values containing a colon so they mirror real agent files
    // (e.g. feniks.md's description field).
    lines.push(
      value.includes(":") ? `${key}: "${value}"` : `${key}: ${value}`,
    );
  }
  lines.push("---", "", body);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, lines.join("\n"));
}

function buildFixtureTree(rootDir: string): void {
  // ─── Agents: 2 real + CATALOG.md (exclude) + _TEMPLATE.md.example (exclude) ───
  writeFrontmatterFile(path.join(rootDir, ".claude/agents/feniks.md"), {
    name: "feniks",
    model: "sonnet",
    description: "TDD enforcer: Command /abra-kdabra, red-green-refactor.",
  });
  writeFrontmatterFile(path.join(rootDir, ".claude/agents/arkitect.md"), {
    name: "arkitect",
    model: "opus",
    description: "Architecture decisions.",
  });
  fs.writeFileSync(
    path.join(rootDir, ".claude/agents/CATALOG.md"),
    "# Agent Catalog\n\nnot a real agent\n",
  );
  fs.writeFileSync(
    path.join(rootDir, ".claude/agents/_TEMPLATE.md.example"),
    "---\nname: TEMPLATE\nmodel: sonnet\n---\n\ntemplate body\n",
  );

  // ─── Skills: 2 ───
  writeFrontmatterFile(
    path.join(rootDir, ".claude/skills/tdd-workflow/SKILL.md"),
    { name: "tdd-workflow", description: "Red-green-refactor guidance." },
  );
  writeFrontmatterFile(
    path.join(rootDir, ".claude/skills/coding-standards/SKILL.md"),
    { name: "coding-standards", description: "Naming and style conventions." },
  );

  // ─── Commands: 2 ───
  writeFrontmatterFile(path.join(rootDir, ".claude/commands/nexus.md"), {
    description: "Show the Kadmon Harness dashboard.",
  });
  writeFrontmatterFile(path.join(rootDir, ".claude/commands/chekpoint.md"), {
    description: "Run the verification + review gate.",
  });

  // ─── settings.json with 3 hook scripts across event groups ───
  const settings = {
    hooks: {
      PreToolUse: [
        {
          matcher: "Edit|Write",
          hooks: [
            {
              type: "command",
              command:
                "node .claude/hooks/scripts/config-protection.js",
            },
            {
              type: "command",
              command: "node .claude/hooks/scripts/no-context-guard.js",
            },
          ],
        },
      ],
      Stop: [
        {
          matcher: "",
          hooks: [
            {
              type: "command",
              command: "node .claude/hooks/scripts/session-end-all.js",
            },
          ],
        },
      ],
    },
  };
  fs.mkdirSync(path.join(rootDir, ".claude"), { recursive: true });
  fs.writeFileSync(
    path.join(rootDir, ".claude/settings.json"),
    JSON.stringify(settings, null, 2),
  );

  // ─── tests/ dir with 2 nested .test.ts files (for testFileCount) ───
  fs.mkdirSync(path.join(rootDir, "tests/lib"), { recursive: true });
  fs.writeFileSync(path.join(rootDir, "tests/lib/foo.test.ts"), "// fixture\n");
  fs.mkdirSync(path.join(rootDir, "tests/hooks"), { recursive: true });
  fs.writeFileSync(
    path.join(rootDir, "tests/hooks/bar.test.ts"),
    "// fixture\n",
  );
  // Non-test file should not count
  fs.writeFileSync(path.join(rootDir, "tests/lib/helpers.ts"), "// helper\n");
}

describe("buildCatalog", () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-catalog-"));
    buildFixtureTree(rootDir);
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it("returns exactly the 2 real agents, excluding CATALOG.md and _TEMPLATE.md.example", () => {
    const catalog = buildCatalog(rootDir);
    expect(catalog.agents).toHaveLength(2);
    const names = catalog.agents.map((a) => a.name).sort();
    expect(names).toEqual(["arkitect", "feniks"]);
  });

  it("extracts model frontmatter for each agent", () => {
    const catalog = buildCatalog(rootDir);
    const feniks = catalog.agents.find((a) => a.name === "feniks");
    expect(feniks).toBeDefined();
    expect(feniks!.model).toBe("sonnet");
    expect(feniks!.description).toContain("TDD enforcer");

    const arkitect = catalog.agents.find((a) => a.name === "arkitect");
    expect(arkitect!.model).toBe("opus");
  });

  it("returns exactly the 2 skills with names and descriptions", () => {
    const catalog = buildCatalog(rootDir);
    expect(catalog.skills).toHaveLength(2);
    const names = catalog.skills.map((s) => s.name).sort();
    expect(names).toEqual(["coding-standards", "tdd-workflow"]);
    const tdd = catalog.skills.find((s) => s.name === "tdd-workflow");
    expect(tdd!.description).toContain("Red-green-refactor");
  });

  it("returns exactly the 2 commands with names and descriptions", () => {
    const catalog = buildCatalog(rootDir);
    expect(catalog.commands).toHaveLength(2);
    const names = catalog.commands.map((c) => c.name).sort();
    expect(names).toEqual(["chekpoint", "nexus"]);
    const nexus = catalog.commands.find((c) => c.name === "nexus");
    expect(nexus!.description).toContain("dashboard");
  });

  it("counts unique hook scripts referenced in settings.json", () => {
    const catalog = buildCatalog(rootDir);
    expect(catalog.hookCount).toBe(3);
  });

  it("counts .test.ts files recursively under tests/, excluding non-test files", () => {
    const catalog = buildCatalog(rootDir);
    expect(catalog.testFileCount).toBe(2);
  });

  it("includes a valid ISO generatedAt timestamp", () => {
    const before = Date.now();
    const catalog = buildCatalog(rootDir);
    const generated = new Date(catalog.generatedAt).getTime();
    expect(generated).toBeGreaterThanOrEqual(before);
    expect(generated).toBeLessThanOrEqual(Date.now());
  });

  it("handles a missing .claude directory gracefully (empty catalog)", () => {
    const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-empty-"));
    try {
      const catalog = buildCatalog(emptyRoot);
      expect(catalog.agents).toEqual([]);
      expect(catalog.skills).toEqual([]);
      expect(catalog.commands).toEqual([]);
      expect(catalog.hookCount).toBe(0);
      expect(catalog.testFileCount).toBe(0);
    } finally {
      fs.rmSync(emptyRoot, { recursive: true, force: true });
    }
  });
});

describe("buildTelemetry", () => {
  const projectHash = "proj-telemetry";

  beforeEach(async () => {
    await openDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  function seedTelemetryFixtures(): void {
    // ─── Sessions: one ended, one live (the "orphan") ───
    upsertSession({
      id: "s1",
      projectHash,
      branch: "main",
      startedAt: "2026-07-15T10:00:00Z",
      endedAt: "2026-07-15T11:00:00Z",
      durationMs: 3600000,
      filesModified: ["a.ts", "b.ts"],
      messageCount: 42,
      estimatedCostUsd: 0.45,
    });
    upsertSession({
      id: "s2-live",
      projectHash,
      branch: "feat/live",
      startedAt: "2026-07-16T09:00:00Z",
      messageCount: 5,
      estimatedCostUsd: 0.0,
    });

    // ─── Instincts: two confidences, two scopes ───
    upsertInstinct({
      id: "i-project",
      projectHash,
      pattern: "Read before edit",
      action: "Always read first",
      confidence: 0.3,
      occurrences: 1,
      status: "active",
      scope: "project",
    });
    upsertInstinct({
      id: "i-global",
      projectHash,
      pattern: "Batch edits",
      action: "Group related changes",
      confidence: 0.8,
      occurrences: 5,
      status: "active",
      scope: "global",
    });

    // ─── Cost events: two models ───
    insertCostEvent({
      sessionId: "s1",
      timestamp: "2026-07-15T10:30:00Z",
      model: "claude-opus-4",
      inputTokens: 50000,
      outputTokens: 10000,
      estimatedCostUsd: 0.4,
    });
    insertCostEvent({
      sessionId: "s1",
      timestamp: "2026-07-15T10:45:00Z",
      model: "claude-sonnet-4",
      inputTokens: 30000,
      outputTokens: 5000,
      estimatedCostUsd: 0.05,
    });

    // ─── Hook events: one 50ms-budget hook, one blocked 100ms-budget hook,
    // one exempt (toolchain-spawning) hook ───
    insertHookEvent({
      sessionId: "s1",
      hookName: "observe-pre",
      eventType: "pre_tool",
      toolName: "Read",
      exitCode: 0,
      blocked: false,
      durationMs: 10,
      timestamp: "2026-07-15T10:00:01Z",
    });
    insertHookEvent({
      sessionId: "s1",
      hookName: "no-context-guard",
      eventType: "pre_tool",
      toolName: "Write",
      exitCode: 2,
      blocked: true,
      durationMs: 60,
      error: "no_context",
      timestamp: "2026-07-15T10:00:02Z",
    });
    insertHookEvent({
      sessionId: "s1",
      hookName: "quality-gate",
      eventType: "post_tool",
      toolName: "Edit",
      exitCode: 0,
      blocked: false,
      durationMs: 900,
      timestamp: "2026-07-15T10:00:03Z",
    });

    // ─── Agent invocations: one success, one failure ───
    insertAgentInvocation({
      sessionId: "s1",
      agentType: "feniks",
      model: "sonnet",
      description: "TDD guide",
      durationMs: 45000,
      success: true,
      timestamp: "2026-07-15T10:05:00Z",
    });
    insertAgentInvocation({
      sessionId: "s1",
      agentType: "kody",
      model: "sonnet",
      description: "Review",
      durationMs: 30000,
      success: false,
      error: "review failed",
      timestamp: "2026-07-15T10:10:00Z",
    });
  }

  it("returns instinct counts split by scope (active/global/project)", () => {
    seedTelemetryFixtures();
    const telemetry = buildTelemetry(projectHash);
    expect(telemetry.projectHash).toBe(projectHash);
    expect(telemetry.instincts.counts).toEqual({
      active: 2,
      global: 1,
      project: 1,
    });
    expect(telemetry.instincts.items).toHaveLength(2);
    const projectItem = telemetry.instincts.items.find(
      (i) => i.scope === "project",
    );
    expect(projectItem).toBeDefined();
    expect(projectItem!.pattern).toBe("Read before edit");
    expect(projectItem!.confidence).toBe(0.3);
    expect(projectItem!.occurrences).toBe(1);
  });

  it("returns recent sessions and orphan count", () => {
    seedTelemetryFixtures();
    const telemetry = buildTelemetry(projectHash);
    expect(telemetry.sessions.recent).toHaveLength(2);
    const live = telemetry.sessions.recent.find((s) => s.id === "s2-live");
    expect(live).toBeDefined();
    expect(live!.filesModified).toBe(0);
    expect(live!.messageCount).toBe(5);

    const ended = telemetry.sessions.recent.find((s) => s.id === "s1");
    expect(ended!.filesModified).toBe(2);
    expect(ended!.costUsd).toBeCloseTo(0.45, 2);

    // s2-live has no endedAt -> counts as an orphan session
    expect(telemetry.sessions.orphanCount).toBe(1);
  });

  it("returns cost aggregated by model", () => {
    seedTelemetryFixtures();
    const telemetry = buildTelemetry(projectHash);
    expect(telemetry.cost.byModel).toHaveLength(2);
    const opus = telemetry.cost.byModel.find(
      (m) => m.model === "claude-opus-4",
    );
    expect(opus).toBeDefined();
    expect(opus!.totalUsd).toBeCloseTo(0.4, 2);
    expect(opus!.inputTokens).toBe(50000);
    expect(opus!.outputTokens).toBe(10000);
  });

  it("maps hook health rows to latency budgets and exempt flags", () => {
    seedTelemetryFixtures();
    const telemetry = buildTelemetry(projectHash);
    expect(telemetry.hookHealth).toHaveLength(3);

    const observePre = telemetry.hookHealth.find(
      (h) => h.hookName === "observe-pre",
    );
    expect(observePre).toBeDefined();
    expect(observePre!.budgetMs).toBe(50);
    expect(observePre!.exempt).toBe(false);
    expect(observePre!.events).toBe(1);
    expect(observePre!.blocked).toBe(0);

    const noContextGuard = telemetry.hookHealth.find(
      (h) => h.hookName === "no-context-guard",
    );
    expect(noContextGuard!.budgetMs).toBe(100);
    expect(noContextGuard!.exempt).toBe(false);
    expect(noContextGuard!.blocked).toBe(1);

    const qualityGate = telemetry.hookHealth.find(
      (h) => h.hookName === "quality-gate",
    );
    expect(qualityGate!.budgetMs).toBe(500);
    expect(qualityGate!.exempt).toBe(true);
  });

  it("returns agent stats with invocations, successRate, and avgDurationMs", () => {
    seedTelemetryFixtures();
    const telemetry = buildTelemetry(projectHash);
    expect(telemetry.agents).toHaveLength(2);

    const feniks = telemetry.agents.find((a) => a.agentType === "feniks");
    expect(feniks).toBeDefined();
    expect(feniks!.invocations).toBe(1);
    expect(feniks!.successRate).toBe(1);
    expect(feniks!.avgDurationMs).toBe(45000);

    const kody = telemetry.agents.find((a) => a.agentType === "kody");
    expect(kody!.successRate).toBe(0);
  });

  it("includes a valid ISO generatedAt timestamp", () => {
    const before = Date.now();
    const telemetry = buildTelemetry(projectHash);
    const generated = new Date(telemetry.generatedAt).getTime();
    expect(generated).toBeGreaterThanOrEqual(before);
    expect(generated).toBeLessThanOrEqual(Date.now());
  });

  it("handles empty database gracefully (no data for project)", () => {
    const telemetry = buildTelemetry("empty-project");
    expect(telemetry.instincts.counts).toEqual({
      active: 0,
      global: 0,
      project: 0,
    });
    expect(telemetry.instincts.items).toEqual([]);
    expect(telemetry.sessions.recent).toEqual([]);
    expect(telemetry.sessions.orphanCount).toBe(0);
    expect(telemetry.cost.byModel).toEqual([]);
    expect(telemetry.hookHealth).toEqual([]);
    expect(telemetry.agents).toEqual([]);
  });
});
