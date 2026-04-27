import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/agent-metadata-sync.js");

// Absolute paths to real catalog files (never mutated — tests use tmp copies)
const REAL_CLAUDE_MD = path.resolve("CLAUDE.md");
const REAL_AGENTS_MD = path.resolve(".claude/agents/CATALOG.md");

// Minimal alchemik agent file with opus model (matches real frontmatter)
const ALCHEMIK_OPUS_CONTENT = `---
name: alchemik
description: Invoked exclusively via /evolve command.
model: opus
tools: Read, Grep, Glob, Bash
memory: project
skills: search-first, continuous-learning-v2
---

Body content here. Not frontmatter.
`;

const ALCHEMIK_SONNET_CONTENT = `---
name: alchemik
description: Invoked exclusively via /evolve command.
model: sonnet
tools: Read, Grep, Glob, Bash
memory: project
skills: search-first, continuous-learning-v2
---

Body content here. Not frontmatter.
`;

const ALCHEMIK_NO_MODEL_CONTENT = `---
name: alchemik
description: Invoked exclusively via /evolve command.
tools: Read, Grep, Glob, Bash
---

Body content here.
`;

const ALCHEMIK_BODY_ONLY_CHANGE = `---
name: alchemik
description: Invoked exclusively via /evolve command.
model: opus
tools: Read, Grep, Glob, Bash
memory: project
skills: search-first, continuous-learning-v2
---

Body content CHANGED here. Still not frontmatter.
New line added.
`;

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

function runHook(
  input: object,
  env?: Record<string, string>,
  cwd?: string,
): RunResult {
  const start = Date.now();
  try {
    const stdout = execFileSync("node", [HOOK], {
      encoding: "utf8",
      input: JSON.stringify(input),
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
      cwd,
    });
    return { code: 0, stdout, stderr: "", durationMs: Date.now() - start };
  } catch (err: unknown) {
    const e = err as { status: number; stdout: string; stderr: string };
    return {
      code: e.status ?? 1,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      durationMs: Date.now() - start,
    };
  }
}

// Creates a fresh tmp dir with copies of real catalog files + a tmp agent file.
// The agent file is placed under <tmpDir>/.claude/agents/ so the hook's path
// guard (regex: /.claude/agents/*.md) fires correctly.
function setupTmpFixtures(agentContent: string): {
  tmpDir: string;
  tmpClaudeMd: string;
  tmpAgentsMd: string;
  tmpAgentFile: string;
} {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-metadata-sync-"));
  const agentsDir = path.join(tmpDir, ".claude", "agents");
  fs.mkdirSync(agentsDir, { recursive: true });

  const tmpClaudeMd = path.join(tmpDir, "CLAUDE.md");
  const tmpAgentsMd = path.join(tmpDir, "agents.md");
  const tmpAgentFile = path.join(agentsDir, "alchemik.md");

  fs.copyFileSync(REAL_CLAUDE_MD, tmpClaudeMd);
  fs.copyFileSync(REAL_AGENTS_MD, tmpAgentsMd);
  fs.writeFileSync(tmpAgentFile, agentContent, "utf8");

  return { tmpDir, tmpClaudeMd, tmpAgentsMd, tmpAgentFile };
}

function cleanupTmpDir(tmpDir: string): void {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

describe("agent-metadata-sync", () => {
  let tmpDir: string;
  let tmpClaudeMd: string;
  let tmpAgentsMd: string;
  let tmpAgentFile: string;

  beforeEach(() => {
    ({ tmpDir, tmpClaudeMd, tmpAgentsMd, tmpAgentFile } = setupTmpFixtures(
      ALCHEMIK_OPUS_CONTENT,
    ));
  });

  afterEach(() => {
    cleanupTmpDir(tmpDir);
  });

  it("syncs model change from opus to sonnet in both CLAUDE.md and agents.md", () => {
    // Write sonnet version of alchemik to the tmp agent file
    fs.writeFileSync(tmpAgentFile, ALCHEMIK_SONNET_CONTENT, "utf8");

    const r = runHook(
      {
        tool_name: "Edit",
        tool_input: { file_path: tmpAgentFile },
      },
      {
        KADMON_SYNC_CLAUDE_MD_PATH: tmpClaudeMd,
        KADMON_SYNC_AGENTS_MD_PATH: tmpAgentsMd,
      },
    );

    expect(r.code).toBe(0);

    const claudeMd = fs.readFileSync(tmpClaudeMd, "utf8");
    const agentsMd = fs.readFileSync(tmpAgentsMd, "utf8");

    // alchemik row must now show sonnet (was opus)
    expect(claudeMd).toMatch(/\|\s*alchemik\s*\|\s*sonnet\s*\|/);
    expect(agentsMd).toMatch(/\|\s*alchemik\s*\|\s*sonnet\s*\|/);

    // The old opus entry for alchemik must not remain
    // (other opus agents like arkitect must still have opus)
    expect(claudeMd).toMatch(/\|\s*arkitect\s*\|\s*opus\s*\|/);
    expect(agentsMd).toMatch(/\|\s*arkitect\s*\|\s*opus\s*\|/);
  });

  it("latency budget: hook completes in under 500ms on real sync", () => {
    fs.writeFileSync(tmpAgentFile, ALCHEMIK_SONNET_CONTENT, "utf8");

    const r = runHook(
      {
        tool_name: "Edit",
        tool_input: { file_path: tmpAgentFile },
      },
      {
        KADMON_SYNC_CLAUDE_MD_PATH: tmpClaudeMd,
        KADMON_SYNC_AGENTS_MD_PATH: tmpAgentsMd,
      },
    );

    expect(r.code).toBe(0);
    expect(r.durationMs).toBeLessThan(500);
  });

  it("body-only change is a no-op: CLAUDE.md and agents.md unchanged", () => {
    // The tmp agent file has model: opus (same as in the catalog)
    // Only the body changed
    fs.writeFileSync(tmpAgentFile, ALCHEMIK_BODY_ONLY_CHANGE, "utf8");

    const claudeMdBefore = fs.readFileSync(tmpClaudeMd, "utf8");
    const agentsMdBefore = fs.readFileSync(tmpAgentsMd, "utf8");

    const r = runHook(
      {
        tool_name: "Edit",
        tool_input: { file_path: tmpAgentFile },
      },
      {
        KADMON_SYNC_CLAUDE_MD_PATH: tmpClaudeMd,
        KADMON_SYNC_AGENTS_MD_PATH: tmpAgentsMd,
      },
    );

    expect(r.code).toBe(0);

    const claudeMdAfter = fs.readFileSync(tmpClaudeMd, "utf8");
    const agentsMdAfter = fs.readFileSync(tmpAgentsMd, "utf8");

    expect(claudeMdAfter).toBe(claudeMdBefore);
    expect(agentsMdAfter).toBe(agentsMdBefore);
  });

  it("missing model: key emits warning exit 1 without crashing", () => {
    fs.writeFileSync(tmpAgentFile, ALCHEMIK_NO_MODEL_CONTENT, "utf8");

    const claudeMdBefore = fs.readFileSync(tmpClaudeMd, "utf8");
    const agentsMdBefore = fs.readFileSync(tmpAgentsMd, "utf8");

    const r = runHook(
      {
        tool_name: "Edit",
        tool_input: { file_path: tmpAgentFile },
      },
      {
        KADMON_SYNC_CLAUDE_MD_PATH: tmpClaudeMd,
        KADMON_SYNC_AGENTS_MD_PATH: tmpAgentsMd,
      },
    );

    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/model/i);

    // Catalogs must remain untouched
    expect(fs.readFileSync(tmpClaudeMd, "utf8")).toBe(claudeMdBefore);
    expect(fs.readFileSync(tmpAgentsMd, "utf8")).toBe(agentsMdBefore);
  });

  it("unknown agent name not in catalog emits warning exit 1 without crashing", () => {
    // Create a brand-new agent file under .claude/agents/ with a name not in either catalog
    const agentsDir = path.join(tmpDir, ".claude", "agents");
    const unknownAgentFile = path.join(agentsDir, "brand-new-agent.md");
    fs.writeFileSync(
      unknownAgentFile,
      `---\nname: brand-new-agent\nmodel: haiku\ntools: Read\n---\n\nBody.\n`,
      "utf8",
    );

    const claudeMdBefore = fs.readFileSync(tmpClaudeMd, "utf8");
    const agentsMdBefore = fs.readFileSync(tmpAgentsMd, "utf8");

    const r = runHook(
      {
        tool_name: "Edit",
        tool_input: { file_path: unknownAgentFile },
      },
      {
        KADMON_SYNC_CLAUDE_MD_PATH: tmpClaudeMd,
        KADMON_SYNC_AGENTS_MD_PATH: tmpAgentsMd,
      },
    );

    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/not found in catalog/i);

    // Catalogs must remain untouched
    expect(fs.readFileSync(tmpClaudeMd, "utf8")).toBe(claudeMdBefore);
    expect(fs.readFileSync(tmpAgentsMd, "utf8")).toBe(agentsMdBefore);
  });

  it("non-agent file path is a no-op: exits 0 quickly", () => {
    const claudeMdBefore = fs.readFileSync(tmpClaudeMd, "utf8");
    const agentsMdBefore = fs.readFileSync(tmpAgentsMd, "utf8");

    const r = runHook(
      {
        tool_name: "Edit",
        tool_input: { file_path: "scripts/lib/state-store.ts" },
      },
      {
        KADMON_SYNC_CLAUDE_MD_PATH: tmpClaudeMd,
        KADMON_SYNC_AGENTS_MD_PATH: tmpAgentsMd,
      },
    );

    expect(r.code).toBe(0);
    // Fast bail: should complete well under 500ms (targeting < 50ms)
    expect(r.durationMs).toBeLessThan(500);

    // No changes to either catalog
    expect(fs.readFileSync(tmpClaudeMd, "utf8")).toBe(claudeMdBefore);
    expect(fs.readFileSync(tmpAgentsMd, "utf8")).toBe(agentsMdBefore);
  });

  it("exits 0 on empty input without crashing", () => {
    const r = runHook(
      {},
      {
        KADMON_SYNC_CLAUDE_MD_PATH: tmpClaudeMd,
        KADMON_SYNC_AGENTS_MD_PATH: tmpAgentsMd,
      },
    );
    expect(r.code).toBe(0);
  });

  // Production path: ensure the hook defaults to .claude/agents/CATALOG.md
  // (NOT the legacy .claude/rules/common/agents.md) when no env override is set.
  // This guards ADR-035 against regression.
  it("production path: defaults to .claude/agents/CATALOG.md, not rules/common/agents.md", () => {
    // Build a synthetic project layout under tmpDir that mirrors a real Kadmon project
    const projectRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "agent-metadata-sync-prod-"),
    );
    const projAgentsDir = path.join(projectRoot, ".claude", "agents");
    const projLegacyRulesDir = path.join(projectRoot, ".claude", "rules", "common");
    fs.mkdirSync(projAgentsDir, { recursive: true });
    fs.mkdirSync(projLegacyRulesDir, { recursive: true });

    const projClaudeMd = path.join(projectRoot, "CLAUDE.md");
    const projCatalog = path.join(projAgentsDir, "CATALOG.md");
    const projLegacy = path.join(projLegacyRulesDir, "agents.md");
    const projAgentFile = path.join(projAgentsDir, "alchemik.md");

    // Seed: real CLAUDE.md + real CATALOG.md + an OLD-shape agents.md (must NOT be touched)
    fs.copyFileSync(REAL_CLAUDE_MD, projClaudeMd);
    fs.copyFileSync(REAL_AGENTS_MD, projCatalog);
    fs.writeFileSync(
      projLegacy,
      `# Legacy agents.md should not be written by hook\n| alchemik | opus |\n`,
      "utf8",
    );
    fs.writeFileSync(projAgentFile, ALCHEMIK_SONNET_CONTENT, "utf8");

    const legacyBefore = fs.readFileSync(projLegacy, "utf8");

    // Run hook WITHOUT env override, with cwd at the synthetic project root.
    // Strip the override env vars to force production resolution.
    const r = runHook(
      {
        tool_name: "Edit",
        tool_input: { file_path: projAgentFile },
      },
      {
        KADMON_SYNC_CLAUDE_MD_PATH: "",
        KADMON_SYNC_AGENTS_MD_PATH: "",
        NODE_ENV: "production",
        VITEST: "",
      },
      projectRoot,
    );

    expect(r.code).toBe(0);

    // CATALOG.md must contain the synced sonnet row
    const catalogAfter = fs.readFileSync(projCatalog, "utf8");
    expect(catalogAfter).toMatch(/\|\s*alchemik\s*\|\s*sonnet\s*\|/);

    // Legacy agents.md must be UNTOUCHED — the hook no longer writes here
    const legacyAfter = fs.readFileSync(projLegacy, "utf8");
    expect(legacyAfter).toBe(legacyBefore);

    // Cleanup
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });
});
