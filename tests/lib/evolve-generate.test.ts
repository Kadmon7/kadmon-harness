// Kadmon Harness — Tests for runEvolveGenerate (Phase 2, ADR-008, plan-008)
// TDD: written before implementation. Run RED first, then GREEN.
// Covers Parts A-D (purity, category routing, projectHash isolation, stale instincts).
// Phase 3 tests (Parts E-I: applyEvolveGenerate mutator) appended below.

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  openDb,
  closeDb,
  upsertInstinct,
} from "../../scripts/lib/state-store.js";
import {
  runEvolveGenerate,
  applyEvolveGenerate,
} from "../../scripts/lib/evolve-generate.js";
import type { EvolveGeneratePreview, GenerateProposal } from "../../scripts/lib/types.js";
import {
  makeClusterReport,
  writeClusterReportToFile,
} from "../fixtures/make-cluster-report.js";

// ─── Helpers ───

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-evolve-gen-test-"));
}

function removeTmpDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

/**
 * Seeds the in-memory DB with active instincts so the stale-filter passes.
 * Accepts an array of instinct IDs to register under the given projectHash.
 */
function seedInstincts(projectHash: string, instinctIds: string[]): void {
  const now = new Date().toISOString();
  for (const id of instinctIds) {
    upsertInstinct({
      id,
      projectHash,
      pattern: `pattern-${id}`,
      action: `action-${id}`,
      confidence: 0.7,
      occurrences: 3,
      contradictions: 0,
      sourceSessions: ["test-session-seed"],
      status: "active",
      scope: "project",
      createdAt: now,
      updatedAt: now,
    });
  }
}

// ─── Part A: Purity — runEvolveGenerate must never write to disk ───

describe("runEvolveGenerate — Part A: purity", () => {
  let tmpCwd: string;
  let tmpReportsDir: string;

  beforeEach(async () => {
    await openDb(":memory:");
    tmpCwd = makeTmpDir();
    tmpReportsDir = makeTmpDir();
  });

  afterEach(() => {
    closeDb();
    removeTmpDir(tmpCwd);
    removeTmpDir(tmpReportsDir);
    vi.restoreAllMocks();
  });

  it("returns a valid EvolveGeneratePreview without writing any files", async () => {
    const report = makeClusterReport({ projectHash: "test-hash-aaaa" });
    writeClusterReportToFile(report, tmpReportsDir);

    // Seed live instincts so the default cluster members pass the stale filter
    seedInstincts("test-hash-aaaa", ["instinct-default-00", "instinct-default-01"]);

    const writeFileSyncSpy = vi.spyOn(fs, "writeFileSync");

    const preview = await runEvolveGenerate({
      projectHash: "test-hash-aaaa",
      cwd: tmpCwd,
      reportsDir: tmpReportsDir,
      now: new Date(),
    });

    // Must return a valid EvolveGeneratePreview
    expect(preview).toBeDefined();
    expect(Array.isArray(preview.proposals)).toBe(true);
    expect(typeof preview.sourceReportCount).toBe("number");
    expect(typeof preview.deferredHookCount).toBe("number");
    expect(preview.sourceWindow).toBeDefined();
    expect(typeof preview.sourceWindow.from).toBe("string");
    expect(typeof preview.sourceWindow.to).toBe("string");

    // Must NOT have written anything to tmpCwd
    const dotClaudePath = path.join(tmpCwd, ".claude");
    expect(fs.existsSync(dotClaudePath)).toBe(false);

    // Must NOT have called writeFileSync
    expect(writeFileSyncSpy).not.toHaveBeenCalled();
  });

  it("returns skipped: no-reports-in-window when no matching reports exist", async () => {
    const preview = await runEvolveGenerate({
      projectHash: "test-hash-aaaa",
      cwd: tmpCwd,
      reportsDir: tmpReportsDir,
      now: new Date(),
    });

    expect(preview.proposals).toHaveLength(0);
    expect(preview.sourceReportCount).toBe(0);
    expect(preview.skipped).toBe("no-reports-in-window");
    expect(preview.deferredHookCount).toBe(0);
  });
});

// ─── Part B: Category routing ───

describe("runEvolveGenerate — Part B: category routing", () => {
  let tmpCwd: string;
  let tmpReportsDir: string;

  beforeEach(async () => {
    await openDb(":memory:");
    tmpCwd = makeTmpDir();
    tmpReportsDir = makeTmpDir();
  });

  afterEach(() => {
    closeDb();
    removeTmpDir(tmpCwd);
    removeTmpDir(tmpReportsDir);
  });

  it("maps PROMOTE -> skill proposal with correct targetPath", async () => {
    seedInstincts("test-hash-aaaa", ["instinct-promote-01"]);
    const report = makeClusterReport({
      projectHash: "test-hash-aaaa",
      clusters: [
        {
          id: "cluster-promote-01",
          suggestedCategory: "PROMOTE",
          label: "read-before-edit workflow",
          members: [{ instinctId: "instinct-promote-01", membership: 0.8 }],
          metrics: { meanConfidence: 0.8, totalOccurrences: 5, contradictionCount: 0, distinctSessions: 3 },
          rationale: "Promote test",
        },
      ],
    });
    writeClusterReportToFile(report, tmpReportsDir);

    const preview = await runEvolveGenerate({
      projectHash: "test-hash-aaaa",
      cwd: tmpCwd,
      reportsDir: tmpReportsDir,
      now: new Date(),
    });

    const skillProposals = preview.proposals.filter((p) => p.type === "skill");
    expect(skillProposals.length).toBeGreaterThanOrEqual(1);
    const skillProposal = skillProposals[0]!;
    expect(skillProposal.type).toBe("skill");
    expect(skillProposal.targetPath).toMatch(/^\.claude\/skills\//);
    expect(skillProposal.targetPath).toMatch(/\.md$/);
  });

  it("maps CREATE_COMMAND -> command proposal with correct targetPath", async () => {
    seedInstincts("test-hash-aaaa", ["instinct-command-01"]);
    const report = makeClusterReport({
      projectHash: "test-hash-aaaa",
      clusters: [
        {
          id: "cluster-command-01",
          suggestedCategory: "CREATE_COMMAND",
          label: "test-after-change command",
          members: [{ instinctId: "instinct-command-01", membership: 0.7 }],
          metrics: { meanConfidence: 0.7, totalOccurrences: 4, contradictionCount: 0, distinctSessions: 2 },
          rationale: "Command test",
        },
      ],
    });
    writeClusterReportToFile(report, tmpReportsDir);

    const preview = await runEvolveGenerate({
      projectHash: "test-hash-aaaa",
      cwd: tmpCwd,
      reportsDir: tmpReportsDir,
      now: new Date(),
    });

    const commandProposals = preview.proposals.filter((p) => p.type === "command");
    expect(commandProposals.length).toBeGreaterThanOrEqual(1);
    const commandProposal = commandProposals[0]!;
    expect(commandProposal.type).toBe("command");
    expect(commandProposal.targetPath).toMatch(/^\.claude\/commands\//);
    expect(commandProposal.targetPath).toMatch(/\.md$/);
  });

  it("maps CREATE_AGENT -> agent proposal with correct targetPath", async () => {
    seedInstincts("test-hash-aaaa", ["instinct-agent-01"]);
    const report = makeClusterReport({
      projectHash: "test-hash-aaaa",
      clusters: [
        {
          id: "cluster-agent-01",
          suggestedCategory: "CREATE_AGENT",
          label: "performance profiler agent",
          members: [{ instinctId: "instinct-agent-01", membership: 0.6 }],
          metrics: { meanConfidence: 0.6, totalOccurrences: 3, contradictionCount: 0, distinctSessions: 2 },
          rationale: "Agent test",
        },
      ],
    });
    writeClusterReportToFile(report, tmpReportsDir);

    const preview = await runEvolveGenerate({
      projectHash: "test-hash-aaaa",
      cwd: tmpCwd,
      reportsDir: tmpReportsDir,
      now: new Date(),
    });

    const agentProposals = preview.proposals.filter((p) => p.type === "agent");
    expect(agentProposals.length).toBeGreaterThanOrEqual(1);
    const agentProposal = agentProposals[0]!;
    expect(agentProposal.type).toBe("agent");
    expect(agentProposal.targetPath).toMatch(/^\.claude\/agents\//);
    expect(agentProposal.targetPath).toMatch(/\.md$/);
  });

  it("maps CREATE_RULE -> rule proposal with correct targetPath", async () => {
    seedInstincts("test-hash-aaaa", ["instinct-rule-01"]);
    const report = makeClusterReport({
      projectHash: "test-hash-aaaa",
      clusters: [
        {
          id: "cluster-rule-01",
          suggestedCategory: "CREATE_RULE",
          label: "ts-async-error-handling rule",
          members: [{ instinctId: "instinct-rule-01", membership: 0.75 }],
          metrics: { meanConfidence: 0.75, totalOccurrences: 4, contradictionCount: 0, distinctSessions: 2 },
          rationale: "Rule test",
        },
      ],
    });
    writeClusterReportToFile(report, tmpReportsDir);

    const preview = await runEvolveGenerate({
      projectHash: "test-hash-aaaa",
      cwd: tmpCwd,
      reportsDir: tmpReportsDir,
      now: new Date(),
    });

    const ruleProposals = preview.proposals.filter((p) => p.type === "rule");
    expect(ruleProposals.length).toBeGreaterThanOrEqual(1);
    const ruleProposal = ruleProposals[0]!;
    expect(ruleProposal.type).toBe("rule");
    expect(ruleProposal.targetPath).toMatch(/^\.claude\/rules\//);
    expect(ruleProposal.targetPath).toMatch(/\.md$/);
  });

  it("emits 4 proposals for PROMOTE/CREATE_COMMAND/CREATE_AGENT/CREATE_RULE, deferredHookCount=0", async () => {
    seedInstincts("test-hash-aaaa", [
      "instinct-mixed-01",
      "instinct-mixed-02",
      "instinct-mixed-03",
      "instinct-mixed-04",
    ]);
    const report = makeClusterReport({
      projectHash: "test-hash-aaaa",
      clusters: [
        {
          id: "cluster-mixed-01",
          suggestedCategory: "PROMOTE",
          label: "workflow promotion pattern",
          members: [{ instinctId: "instinct-mixed-01", membership: 0.8 }],
          metrics: { meanConfidence: 0.8, totalOccurrences: 5, contradictionCount: 0, distinctSessions: 3 },
          rationale: "Mixed test - promote",
        },
        {
          id: "cluster-mixed-02",
          suggestedCategory: "CREATE_COMMAND",
          label: "test workflow command",
          members: [{ instinctId: "instinct-mixed-02", membership: 0.7 }],
          metrics: { meanConfidence: 0.7, totalOccurrences: 4, contradictionCount: 0, distinctSessions: 2 },
          rationale: "Mixed test - command",
        },
        {
          id: "cluster-mixed-03",
          suggestedCategory: "CREATE_AGENT",
          label: "debug helper agent",
          members: [{ instinctId: "instinct-mixed-03", membership: 0.6 }],
          metrics: { meanConfidence: 0.6, totalOccurrences: 3, contradictionCount: 0, distinctSessions: 2 },
          rationale: "Mixed test - agent",
        },
        {
          id: "cluster-mixed-04",
          suggestedCategory: "CREATE_RULE",
          label: "typescript error rule",
          members: [{ instinctId: "instinct-mixed-04", membership: 0.75 }],
          metrics: { meanConfidence: 0.75, totalOccurrences: 4, contradictionCount: 0, distinctSessions: 2 },
          rationale: "Mixed test - rule",
        },
      ],
    });
    writeClusterReportToFile(report, tmpReportsDir);

    const preview = await runEvolveGenerate({
      projectHash: "test-hash-aaaa",
      cwd: tmpCwd,
      reportsDir: tmpReportsDir,
      now: new Date(),
    });

    expect(preview.proposals).toHaveLength(4);
    expect(preview.deferredHookCount).toBe(0);
  });

  it("emits 0 proposals and deferredHookCount=1 for CREATE_HOOK + OPTIMIZE only", async () => {
    // Seed hook/optimize member IDs — they should still be dropped since categories are skipped
    seedInstincts("test-hash-aaaa", ["instinct-hook-01", "instinct-optimize-01"]);
    const report = makeClusterReport({
      projectHash: "test-hash-aaaa",
      clusters: [
        {
          id: "cluster-hook-01",
          suggestedCategory: "CREATE_HOOK",
          label: "auto-format hook",
          members: [{ instinctId: "instinct-hook-01", membership: 0.65 }],
          metrics: { meanConfidence: 0.65, totalOccurrences: 3, contradictionCount: 0, distinctSessions: 2 },
          rationale: "Hook test - deferred",
        },
        {
          id: "cluster-optimize-01",
          suggestedCategory: "OPTIMIZE",
          label: "optimize sql query",
          members: [{ instinctId: "instinct-optimize-01", membership: 0.5 }],
          metrics: { meanConfidence: 0.5, totalOccurrences: 2, contradictionCount: 0, distinctSessions: 1 },
          rationale: "Optimize test - skipped",
        },
      ],
    });
    writeClusterReportToFile(report, tmpReportsDir);

    const preview = await runEvolveGenerate({
      projectHash: "test-hash-aaaa",
      cwd: tmpCwd,
      reportsDir: tmpReportsDir,
      now: new Date(),
    });

    expect(preview.proposals).toHaveLength(0);
    expect(preview.deferredHookCount).toBe(1);
  });
});

// ─── Part C: projectHash isolation ───

describe("runEvolveGenerate — Part C: projectHash isolation", () => {
  let tmpCwd: string;
  let tmpReportsDir: string;

  beforeEach(async () => {
    await openDb(":memory:");
    tmpCwd = makeTmpDir();
    tmpReportsDir = makeTmpDir();
  });

  afterEach(() => {
    closeDb();
    removeTmpDir(tmpCwd);
    removeTmpDir(tmpReportsDir);
  });

  it("only returns proposals from the matching projectHash (ADR-008:217)", async () => {
    // Seed live instinct for project aaaa1111 only
    seedInstincts("aaaa1111", ["instinct-a-01"]);
    // NOTE: instinct-b-01 is NOT seeded for aaaa1111 — it belongs to bbbb2222

    // Report A — target project
    const reportA = makeClusterReport({
      projectHash: "aaaa1111",
      clusters: [
        {
          id: "cluster-a-01",
          suggestedCategory: "CREATE_AGENT",
          label: "analytics agent pattern",
          members: [{ instinctId: "instinct-a-01", membership: 0.7 }],
          metrics: { meanConfidence: 0.7, totalOccurrences: 4, contradictionCount: 0, distinctSessions: 2 },
          rationale: "Report A cluster",
        },
      ],
    });
    writeClusterReportToFile(reportA, tmpReportsDir);

    // Report B — different project, must NOT contribute proposals
    const reportB = makeClusterReport({
      projectHash: "bbbb2222",
      clusters: [
        {
          id: "cluster-b-01",
          suggestedCategory: "CREATE_COMMAND",
          label: "sports training command",
          members: [{ instinctId: "instinct-b-01", membership: 0.8 }],
          metrics: { meanConfidence: 0.8, totalOccurrences: 5, contradictionCount: 0, distinctSessions: 3 },
          rationale: "Report B cluster",
        },
      ],
    });
    writeClusterReportToFile(reportB, tmpReportsDir);

    const preview = await runEvolveGenerate({
      projectHash: "aaaa1111",
      cwd: tmpCwd,
      reportsDir: tmpReportsDir,
      now: new Date(),
    });

    expect(preview.proposals).toHaveLength(1);
    expect(preview.proposals[0]!.type).toBe("agent");
    // Must NOT contain command proposals from report B
    const commandProposals = preview.proposals.filter((p) => p.type === "command");
    expect(commandProposals).toHaveLength(0);
  });
});

// ─── Part D: Stale instinctId handling + path safety ───

describe("runEvolveGenerate — Part D: stale instincts + path safety", () => {
  let tmpCwd: string;
  let tmpReportsDir: string;

  beforeEach(async () => {
    await openDb(":memory:");
    tmpCwd = makeTmpDir();
    tmpReportsDir = makeTmpDir();
  });

  afterEach(() => {
    closeDb();
    removeTmpDir(tmpCwd);
    removeTmpDir(tmpReportsDir);
  });

  it("(D.1) drops clusters whose members are all stale and surfaces staleInstinctIds", async () => {
    // Plant a fixture with instinctIds not present in the :memory: DB (empty DB = all stale)
    const report = makeClusterReport({
      projectHash: "test-hash-aaaa",
      clusters: [
        {
          id: "cluster-stale-01",
          suggestedCategory: "PROMOTE",
          label: "stale workflow pattern",
          members: [
            { instinctId: "stale-1", membership: 0.8 },
            { instinctId: "stale-2", membership: 0.7 },
          ],
          metrics: { meanConfidence: 0.75, totalOccurrences: 5, contradictionCount: 0, distinctSessions: 2 },
          rationale: "Stale cluster test",
        },
      ],
    });
    writeClusterReportToFile(report, tmpReportsDir);

    const preview = await runEvolveGenerate({
      projectHash: "test-hash-aaaa",
      cwd: tmpCwd,
      reportsDir: tmpReportsDir,
      now: new Date(),
    });

    // All members are stale — no proposals emitted
    expect(preview.proposals).toHaveLength(0);
    // Stale IDs surfaced as diagnostic
    expect(preview.staleInstinctIds).toBeDefined();
    expect(preview.staleInstinctIds).toContain("stale-1");
    expect(preview.staleInstinctIds).toContain("stale-2");
  });

  it("(D.2) rejects cluster with pathological slug derived from label", async () => {
    // Seed live instinct so it passes the stale filter — rejection must happen at slug validation
    seedInstincts("test-hash-aaaa", ["instinct-path-01"]);

    // The label will derive a slug that either contains path traversal chars or is invalid
    const report = makeClusterReport({
      projectHash: "test-hash-aaaa",
      clusters: [
        {
          id: "cluster-path-01",
          suggestedCategory: "PROMOTE",
          // This label is entirely non-alphanumeric, so it normalizes to an empty slug
          // after stripping special characters — which fails the SLUG_REGEX check.
          // Choice: pipeline rejects silently (doesn't emit proposal) per plan-008:2.4
          label: "!!!---///---!!!",
          members: [{ instinctId: "instinct-path-01", membership: 0.8 }],
          metrics: { meanConfidence: 0.8, totalOccurrences: 5, contradictionCount: 0, distinctSessions: 3 },
          rationale: "Path traversal test",
        },
      ],
    });
    writeClusterReportToFile(report, tmpReportsDir);

    const preview = await runEvolveGenerate({
      projectHash: "test-hash-aaaa",
      cwd: tmpCwd,
      reportsDir: tmpReportsDir,
      now: new Date(),
    });

    // Must NOT emit a proposal for the pathological label
    // The pipeline either rejects via rejectedSlugs meta or simply produces 0 proposals
    expect(preview.proposals).toHaveLength(0);
  });
});

// ─── Part E: applyEvolveGenerate — write to cwd ───
//
// Verifies: artifacts land on disk in {tmpCwd}/.claude/{type}/{slug}.md,
// directories are created if missing, content includes name/slug,
// result shape is correct (written, no collisions, no errors).

describe("applyEvolveGenerate — Part E: write to cwd", () => {
  let tmpCwd: string;
  let tmpReportsDir: string;

  beforeEach(async () => {
    await openDb(":memory:");
    tmpCwd = path.join(os.tmpdir(), `kadmon-evolve-apply-e-${Date.now()}`);
    tmpReportsDir = makeTmpDir();
    // Do NOT pre-create tmpCwd — the mutator must create it via mkdirSync
  });

  afterEach(() => {
    closeDb();
    removeTmpDir(tmpCwd);
    removeTmpDir(tmpReportsDir);
    vi.restoreAllMocks();
  });

  it("writes skill + command artifacts to {tmpCwd}/.claude/, creates missing dirs", async () => {
    seedInstincts("test-hash-e", ["instinct-e-01", "instinct-e-02"]);

    const report = makeClusterReport({
      projectHash: "test-hash-e",
      clusters: [
        {
          id: "cluster-e-skill",
          suggestedCategory: "PROMOTE",
          label: "read-before-edit workflow",
          members: [{ instinctId: "instinct-e-01", membership: 0.8 }],
          metrics: { meanConfidence: 0.8, totalOccurrences: 5, contradictionCount: 0, distinctSessions: 3 },
          rationale: "Skill proposal for Part E",
        },
        {
          id: "cluster-e-command",
          suggestedCategory: "CREATE_COMMAND",
          label: "test after change command",
          members: [{ instinctId: "instinct-e-02", membership: 0.7 }],
          metrics: { meanConfidence: 0.7, totalOccurrences: 4, contradictionCount: 0, distinctSessions: 2 },
          rationale: "Command proposal for Part E",
        },
      ],
    });
    writeClusterReportToFile(report, tmpReportsDir);

    const preview = await runEvolveGenerate({
      projectHash: "test-hash-e",
      cwd: tmpCwd,
      reportsDir: tmpReportsDir,
      now: new Date(),
    });

    expect(preview.proposals).toHaveLength(2);

    const result = applyEvolveGenerate(
      preview,
      { approvedIndices: [1, 2] },
      { projectHash: "test-hash-e", cwd: tmpCwd, reportsDir: tmpReportsDir },
    );

    // Result shape
    expect(result.written).toHaveLength(2);
    expect(result.collisions).toHaveLength(0);
    expect(result.errors).toHaveLength(0);

    // Files must exist on disk
    for (const w of result.written) {
      expect(fs.existsSync(w.targetPath)).toBe(true);
    }

    // Skill file under .claude/skills/
    const skillEntry = result.written.find((w) => w.type === "skill");
    expect(skillEntry).toBeDefined();
    expect(skillEntry!.targetPath).toContain(path.join(".claude", "skills"));

    // Command file under .claude/commands/
    const commandEntry = result.written.find((w) => w.type === "command");
    expect(commandEntry).toBeDefined();
    expect(commandEntry!.targetPath).toContain(path.join(".claude", "commands"));

    // Content of skill file must include the proposal name or slug
    const skillContent = fs.readFileSync(skillEntry!.targetPath, "utf8");
    const skillProposal = preview.proposals.find((p) => p.type === "skill")!;
    // Either the name or slug should appear in the rendered content
    const nameOrSlugPresent =
      skillContent.includes(skillProposal.name) ||
      skillContent.includes(skillProposal.slug);
    expect(nameOrSlugPresent).toBe(true);

    // Content of command file must include the proposal name or slug
    const commandContent = fs.readFileSync(commandEntry!.targetPath, "utf8");
    const commandProposal = preview.proposals.find((p) => p.type === "command")!;
    const cmdNameOrSlugPresent =
      commandContent.includes(commandProposal.name) ||
      commandContent.includes(commandProposal.slug);
    expect(cmdNameOrSlugPresent).toBe(true);

    // .claude/skills/ directory was created (it didn't exist before the call)
    const skillsDir = path.join(tmpCwd, ".claude", "skills");
    expect(fs.existsSync(skillsDir)).toBe(true);
    const skillsDirStat = fs.statSync(skillsDir);
    expect(skillsDirStat.isDirectory()).toBe(true);
  });

  it("returns empty written/collisions/errors when approvedIndices is empty", async () => {
    seedInstincts("test-hash-e-empty", ["instinct-e-empty-01"]);
    const report = makeClusterReport({
      projectHash: "test-hash-e-empty",
      clusters: [
        {
          id: "cluster-e-empty",
          suggestedCategory: "CREATE_RULE",
          label: "some rule pattern",
          members: [{ instinctId: "instinct-e-empty-01", membership: 0.7 }],
          metrics: { meanConfidence: 0.7, totalOccurrences: 3, contradictionCount: 0, distinctSessions: 1 },
          rationale: "Empty approval test",
        },
      ],
    });
    writeClusterReportToFile(report, tmpReportsDir);

    const preview = await runEvolveGenerate({
      projectHash: "test-hash-e-empty",
      cwd: tmpCwd,
      reportsDir: tmpReportsDir,
      now: new Date(),
    });

    const result = applyEvolveGenerate(
      preview,
      { approvedIndices: [] },
      { projectHash: "test-hash-e-empty", cwd: tmpCwd, reportsDir: tmpReportsDir },
    );

    expect(result.written).toHaveLength(0);
    expect(result.collisions).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── Part F: Transactional collision abort ───
//
// Critical invariant from ADR-008:62: if ANY target path already exists,
// ZERO files are written — the batch is transactionally aborted.
// Even proposals without collisions must not be written.

describe("applyEvolveGenerate — Part F: transactional collision abort", () => {
  let tmpCwd: string;
  let tmpReportsDir: string;

  beforeEach(async () => {
    await openDb(":memory:");
    tmpCwd = path.join(os.tmpdir(), `kadmon-evolve-apply-f-${Date.now()}`);
    tmpReportsDir = makeTmpDir();
    fs.mkdirSync(tmpCwd, { recursive: true });
  });

  afterEach(() => {
    closeDb();
    removeTmpDir(tmpCwd);
    removeTmpDir(tmpReportsDir);
  });

  it("aborts ALL writes when any target path already exists (ADR-008:62)", async () => {
    seedInstincts("test-hash-f", [
      "instinct-f-01",
      "instinct-f-02",
      "instinct-f-03",
    ]);

    const report = makeClusterReport({
      projectHash: "test-hash-f",
      clusters: [
        {
          id: "cluster-f-01",
          suggestedCategory: "CREATE_RULE",
          label: "proposal one rule",
          members: [{ instinctId: "instinct-f-01", membership: 0.8 }],
          metrics: { meanConfidence: 0.8, totalOccurrences: 5, contradictionCount: 0, distinctSessions: 3 },
          rationale: "Collision test proposal 1",
        },
        {
          id: "cluster-f-02",
          suggestedCategory: "CREATE_COMMAND",
          label: "proposal two command",
          members: [{ instinctId: "instinct-f-02", membership: 0.7 }],
          metrics: { meanConfidence: 0.7, totalOccurrences: 4, contradictionCount: 0, distinctSessions: 2 },
          rationale: "Collision test proposal 2 — WILL BE PRE-SEEDED",
        },
        {
          id: "cluster-f-03",
          suggestedCategory: "CREATE_AGENT",
          label: "proposal three agent",
          members: [{ instinctId: "instinct-f-03", membership: 0.6 }],
          metrics: { meanConfidence: 0.6, totalOccurrences: 3, contradictionCount: 0, distinctSessions: 2 },
          rationale: "Collision test proposal 3",
        },
      ],
    });
    writeClusterReportToFile(report, tmpReportsDir);

    const preview = await runEvolveGenerate({
      projectHash: "test-hash-f",
      cwd: tmpCwd,
      reportsDir: tmpReportsDir,
      now: new Date(),
    });

    expect(preview.proposals).toHaveLength(3);

    // Find proposal #2 (the command) and pre-seed a file at its target path
    const prop2 = preview.proposals.find((p) => p.type === "command")!;
    expect(prop2).toBeDefined();
    const prop2AbsPath = path.resolve(tmpCwd, prop2.targetPath);
    fs.mkdirSync(path.dirname(prop2AbsPath), { recursive: true });
    const seedContent = "# pre-seeded — must not be overwritten\n";
    fs.writeFileSync(prop2AbsPath, seedContent, "utf8");

    // Approve all 3
    const result = applyEvolveGenerate(
      preview,
      { approvedIndices: [1, 2, 3] },
      { projectHash: "test-hash-f", cwd: tmpCwd, reportsDir: tmpReportsDir },
    );

    // Transactional abort: ZERO files written
    expect(result.written).toHaveLength(0);

    // Collision list contains the pre-seeded path
    expect(result.collisions).toHaveLength(1);
    expect(result.collisions[0]).toBe(prop2AbsPath);

    // Pre-seeded file is still present and unmodified
    expect(fs.existsSync(prop2AbsPath)).toBe(true);
    const afterContent = fs.readFileSync(prop2AbsPath, "utf8");
    expect(afterContent).toBe(seedContent);

    // Proposals #1 and #3's target paths do NOT exist on disk
    const prop1 = preview.proposals.find((p) => p.type === "rule")!;
    const prop3 = preview.proposals.find((p) => p.type === "agent")!;
    const prop1AbsPath = path.resolve(tmpCwd, prop1.targetPath);
    const prop3AbsPath = path.resolve(tmpCwd, prop3.targetPath);
    expect(fs.existsSync(prop1AbsPath)).toBe(false);
    expect(fs.existsSync(prop3AbsPath)).toBe(false);
  });
});

// ─── Part G: Windows path safety — cwd with spaces ───
//
// Verifies path.join/path.resolve usage (no URL-encoded %20).
// Uses a tmpCwd containing spaces, the standard adversarial case on Windows.

describe("applyEvolveGenerate — Part G: Windows path safety (spaces in cwd)", () => {
  let tmpCwd: string;
  let tmpReportsDir: string;

  beforeEach(async () => {
    await openDb(":memory:");
    // Intentional spaces — this is the adversarial path
    tmpCwd = path.join(os.tmpdir(), "kadmon evolve test");
    tmpReportsDir = makeTmpDir();
    // Do NOT pre-create tmpCwd — the mutator must handle it
  });

  afterEach(() => {
    closeDb();
    removeTmpDir(tmpCwd);
    removeTmpDir(tmpReportsDir);
  });

  it("writes correctly when cwd contains spaces — no %20 in result paths", async () => {
    seedInstincts("test-hash-g", ["instinct-g-01"]);

    const report = makeClusterReport({
      projectHash: "test-hash-g",
      clusters: [
        {
          id: "cluster-g-01",
          suggestedCategory: "CREATE_RULE",
          label: "path safety rule pattern",
          members: [{ instinctId: "instinct-g-01", membership: 0.75 }],
          metrics: { meanConfidence: 0.75, totalOccurrences: 4, contradictionCount: 0, distinctSessions: 2 },
          rationale: "Windows path safety test",
        },
      ],
    });
    writeClusterReportToFile(report, tmpReportsDir);

    const preview = await runEvolveGenerate({
      projectHash: "test-hash-g",
      cwd: tmpCwd,
      reportsDir: tmpReportsDir,
      now: new Date(),
    });

    expect(preview.proposals).toHaveLength(1);

    const result = applyEvolveGenerate(
      preview,
      { approvedIndices: [1] },
      { projectHash: "test-hash-g", cwd: tmpCwd, reportsDir: tmpReportsDir },
    );

    // Success — file was written
    expect(result.written).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.collisions).toHaveLength(0);

    const writtenEntry = result.written[0]!;

    // File actually exists on disk
    expect(fs.existsSync(writtenEntry.targetPath)).toBe(true);

    // Path preserves spaces — no URL-encoded %20
    expect(writtenEntry.targetPath).not.toContain("%20");

    // Path is under tmpCwd (which contains spaces)
    expect(writtenEntry.targetPath.startsWith(tmpCwd)).toBe(true);

    // path.sep is used correctly — no raw slash in a Windows absolute path
    // (On Windows this means backslashes; on Unix forward slashes. Either is correct
    // as long as the path is resolvable, which fs.existsSync above already confirms.)
    expect(path.resolve(writtenEntry.targetPath)).toBe(writtenEntry.targetPath);
  });
});

// ─── Part H: End-to-end integration (happy path) ───
//
// Full pipeline: plant reports -> runEvolveGenerate -> applyEvolveGenerate
// -> read files back -> assert content correctness.
// Tests CREATE_AGENT + CREATE_RULE clusters specifically (non-PROMOTE types
// write directly without plugin hand-off).

describe("applyEvolveGenerate — Part H: end-to-end integration", () => {
  let tmpCwd: string;
  let tmpReportsDir: string;

  beforeEach(async () => {
    await openDb(":memory:");
    tmpCwd = makeTmpDir();
    tmpReportsDir = makeTmpDir();
  });

  afterEach(() => {
    closeDb();
    removeTmpDir(tmpCwd);
    removeTmpDir(tmpReportsDir);
  });

  it("full pipeline: 2 proposals (agent + rule) — content is template-substituted correctly", async () => {
    seedInstincts("test-hash-h", ["instinct-h-agent", "instinct-h-rule"]);

    const report = makeClusterReport({
      projectHash: "test-hash-h",
      clusters: [
        {
          id: "cluster-h-agent",
          suggestedCategory: "CREATE_AGENT",
          label: "perf profiler agent",
          members: [{ instinctId: "instinct-h-agent", membership: 0.8 }],
          metrics: { meanConfidence: 0.8, totalOccurrences: 5, contradictionCount: 0, distinctSessions: 3 },
          rationale: "E2E test — agent cluster",
        },
        {
          id: "cluster-h-rule",
          suggestedCategory: "CREATE_RULE",
          label: "ts async error handling",
          members: [{ instinctId: "instinct-h-rule", membership: 0.75 }],
          metrics: { meanConfidence: 0.75, totalOccurrences: 4, contradictionCount: 0, distinctSessions: 2 },
          rationale: "E2E test — rule cluster",
        },
      ],
    });
    writeClusterReportToFile(report, tmpReportsDir);

    // Step 1: run the pure pipeline
    const preview = await runEvolveGenerate({
      projectHash: "test-hash-h",
      cwd: tmpCwd,
      reportsDir: tmpReportsDir,
      now: new Date(),
    });

    expect(preview.proposals).toHaveLength(2);

    // Step 2: apply all approved
    const result = applyEvolveGenerate(
      preview,
      { approvedIndices: [1, 2] },
      { projectHash: "test-hash-h", cwd: tmpCwd, reportsDir: tmpReportsDir },
    );

    expect(result.written).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.collisions).toHaveLength(0);

    // Step 3: read each written file back and assert content
    for (const w of result.written) {
      const content = fs.readFileSync(w.targetPath, "utf8");
      const proposal = preview.proposals.find(
        (p) => path.resolve(tmpCwd, p.targetPath) === w.targetPath,
      )!;

      // Name must appear in content (every template uses {{NAME}})
      expect(content).toContain(proposal.name);

      // Slug must appear for types whose templates include {{SLUG}} in frontmatter.
      // rule.template.md does not include {{SLUG}} (no frontmatter) — for rules we
      // verify that at least the name is present (already asserted above).
      if (proposal.type !== "rule") {
        expect(content).toContain(proposal.slug);
      }

      // sourceInstinctIds reference must appear
      for (const instinctId of proposal.sourceInstinctIds) {
        expect(content).toContain(instinctId);
      }

      // Generated at timestamp placeholder must be substituted
      expect(content).toContain("Generated at:");
      expect(content).not.toContain("{{GENERATED_AT}}");

      // No remaining {{TOKEN}} placeholders
      expect(content).not.toMatch(/\{\{[A-Z_]+\}\}/);
    }

    // Agent file must have frontmatter (starts with ---)
    const agentEntry = result.written.find((w) => w.type === "agent")!;
    expect(agentEntry).toBeDefined();
    const agentContent = fs.readFileSync(agentEntry.targetPath, "utf8");
    expect(agentContent.startsWith("---")).toBe(true);

    // Rule file does NOT require frontmatter per template (rule.template.md starts with # heading)
    const ruleEntry = result.written.find((w) => w.type === "rule")!;
    expect(ruleEntry).toBeDefined();
    const ruleContent = fs.readFileSync(ruleEntry.targetPath, "utf8");
    expect(ruleContent.length).toBeGreaterThan(0);
  });
});

// ─── Part I: Path traversal rejection ───
//
// Safety: proposals with targetPath escaping .claude/ are rejected.
// Verified by constructing a proposal manually and passing it directly.

describe("applyEvolveGenerate — Part I: path traversal rejection", () => {
  let tmpCwd: string;

  beforeEach(async () => {
    await openDb(":memory:");
    tmpCwd = makeTmpDir();
  });

  afterEach(() => {
    closeDb();
    removeTmpDir(tmpCwd);
  });

  it("rejects a proposal whose targetPath escapes .claude/ via path traversal", () => {
    // Build a synthetic proposal with a malicious targetPath.
    // path.resolve(cwd, "../../etc/passwd") resolves outside .claude/ on any OS.
    const maliciousProposal: GenerateProposal = {
      index: 1,
      type: "rule",
      slug: "evil-rule",
      name: "Evil Rule",
      targetPath: "../../evil-file.md", // escapes .claude/ when resolved
      sourceClusterIds: ["cluster-evil"],
      sourceInstinctIds: ["instinct-evil"],
      suggestedCategory: "CREATE_RULE",
      complexity: "S",
      confidence: "HIGH",
      rationale: "Path traversal attempt",
      spec: {
        kind: "rule",
        scope: "common",
        category: "security",
        sourceClusterIds: ["cluster-evil"],
      },
    };

    const fakePreview: EvolveGeneratePreview = {
      proposals: [maliciousProposal],
      sourceReportCount: 1,
      sourceWindow: { from: new Date().toISOString(), to: new Date().toISOString() },
      deferredHookCount: 0,
    };

    const result = applyEvolveGenerate(
      fakePreview,
      { approvedIndices: [1] },
      { projectHash: "test-hash-i", cwd: tmpCwd },
    );

    // The traversal must be rejected
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Path traversal rejected");

    // Nothing was written
    expect(result.written).toHaveLength(0);

    // No file outside .claude/ was created
    const escapedPath = path.resolve(tmpCwd, "../../evil-file.md");
    expect(fs.existsSync(escapedPath)).toBe(false);
  });

  it("accepts a normal proposal after a rejected traversal proposal (errors do not abort batch)", async () => {
    // This test verifies that path traversal errors push to errors[] but do NOT
    // add to the tasks list, so a mixed batch (bad + good) still writes the good ones.
    seedInstincts("test-hash-i2", ["instinct-i2-01"]);

    const tmpReportsDir = makeTmpDir();
    const report = makeClusterReport({
      projectHash: "test-hash-i2",
      clusters: [
        {
          id: "cluster-i2-01",
          suggestedCategory: "CREATE_RULE",
          label: "good valid rule",
          members: [{ instinctId: "instinct-i2-01", membership: 0.7 }],
          metrics: { meanConfidence: 0.7, totalOccurrences: 3, contradictionCount: 0, distinctSessions: 1 },
          rationale: "Good proposal",
        },
      ],
    });
    writeClusterReportToFile(report, tmpReportsDir);

    const preview = await runEvolveGenerate({
      projectHash: "test-hash-i2",
      cwd: tmpCwd,
      reportsDir: tmpReportsDir,
      now: new Date(),
    });

    expect(preview.proposals).toHaveLength(1);
    const goodProposal = preview.proposals[0]!;

    // Inject a malicious proposal with index 2 alongside the good one
    const maliciousProposal: GenerateProposal = {
      index: 2,
      type: "rule",
      slug: "evil-rule-2",
      name: "Evil Rule 2",
      targetPath: "../../../escape.md",
      sourceClusterIds: ["cluster-evil-2"],
      sourceInstinctIds: ["instinct-evil-2"],
      suggestedCategory: "CREATE_RULE",
      complexity: "S",
      confidence: "HIGH",
      rationale: "Path traversal attempt 2",
      spec: {
        kind: "rule",
        scope: "common",
        category: "security",
        sourceClusterIds: ["cluster-evil-2"],
      },
    };

    const mixedPreview: EvolveGeneratePreview = {
      proposals: [goodProposal, maliciousProposal],
      sourceReportCount: preview.sourceReportCount,
      sourceWindow: preview.sourceWindow,
      deferredHookCount: 0,
    };

    const result = applyEvolveGenerate(
      mixedPreview,
      { approvedIndices: [1, 2] },
      { projectHash: "test-hash-i2", cwd: tmpCwd, reportsDir: tmpReportsDir },
    );

    // The traversal error is recorded
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Path traversal rejected");

    // The good proposal was still written (errors don't abort the batch, only collisions do)
    expect(result.written).toHaveLength(1);
    expect(result.written[0]!.type).toBe("rule");
    expect(fs.existsSync(result.written[0]!.targetPath)).toBe(true);

    // No file escaped to the parent path
    const escapedPath = path.resolve(tmpCwd, "../../../escape.md");
    expect(fs.existsSync(escapedPath)).toBe(false);

    removeTmpDir(tmpReportsDir);
  });
});
