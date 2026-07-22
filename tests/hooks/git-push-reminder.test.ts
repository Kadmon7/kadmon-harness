import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/git-push-reminder.js");
const SESSION_ID = `test-push-${Date.now()}`;
const OBS_DIR = path.join(os.tmpdir(), "kadmon", SESSION_ID);
const OBS_FILE = path.join(OBS_DIR, "observations.jsonl");

function runHook(
  input: object,
  env: Record<string, string> = {},
  cwd?: string,
): {
  code: number;
  stdout: string;
  stderr: string;
} {
  try {
    const stdout = execFileSync("node", [HOOK], {
      encoding: "utf8",
      input: JSON.stringify(input),
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
      cwd,
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err: unknown) {
    const e = err as { status: number; stdout: string; stderr: string };
    return {
      code: e.status ?? 1,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
    };
  }
}

function gitExec(args: string[], cwd: string): void {
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function writeObservations(entries: object[]): void {
  fs.mkdirSync(OBS_DIR, { recursive: true });
  const content = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  fs.writeFileSync(OBS_FILE, content);
}

describe("git-push-reminder", () => {
  beforeEach(() => {
    fs.mkdirSync(OBS_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(OBS_DIR, { recursive: true, force: true });
  });

  it("exits 0 when command is not git push", () => {
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { command: "npm test" },
    });
    expect(r.code).toBe(0);
  });

  it("exits 0 when command is git push but no session_id", () => {
    const r = runHook({
      tool_input: { command: "git push origin main" },
    });
    expect(r.code).toBe(0);
  });

  it("warns when git push and no verify/review in observations (production code)", () => {
    writeObservations([
      { eventType: "tool_pre", toolName: "Read", metadata: { command: null } },
    ]);
    const r = runHook(
      {
        session_id: SESSION_ID,
        tool_input: { command: "git push origin main" },
      },
      { KADMON_TEST_PUSH_FILES: "scripts/lib/state-store.ts" },
    );
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("typecheck/tests not run");
    expect(r.stderr).toContain("production code unreviewed");
  });

  it("exits 0 when observations contain verify and review entries", () => {
    writeObservations([
      {
        eventType: "tool_pre",
        toolName: "Bash",
        metadata: { command: "npx tsc --noEmit" },
      },
      {
        eventType: "tool_pre",
        toolName: "Agent",
        metadata: { agentType: "kody", command: null },
      },
    ]);
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { command: "git push origin main" },
    });
    expect(r.code).toBe(0);
  });

  it("exits 0 when observations contain verify and a python-reviewer review entry", () => {
    // Regression test: the reviewer allowlist only recognized
    // kody/typescript-reviewer, so a session that correctly invoked
    // python-reviewer (the right reviewer for a Python-only diff) still
    // got nagged as if no review happened.
    writeObservations([
      {
        eventType: "tool_pre",
        toolName: "Bash",
        metadata: { command: "npx vitest run" },
      },
      {
        eventType: "tool_pre",
        toolName: "Agent",
        metadata: { agentType: "python-reviewer", command: null },
      },
    ]);
    const r = runHook(
      {
        session_id: SESSION_ID,
        tool_input: { command: "git push origin main" },
      },
      { KADMON_TEST_PUSH_FILES: "src/api/handler.py" },
    );
    expect(r.code).toBe(0);
  });

  it("warns when only verify found but no review (production code)", () => {
    writeObservations([
      {
        eventType: "tool_pre",
        toolName: "Bash",
        metadata: { command: "npx vitest run" },
      },
    ]);
    const r = runHook(
      {
        session_id: SESSION_ID,
        tool_input: { command: "git push origin main" },
      },
      { KADMON_TEST_PUSH_FILES: ".claude/hooks/scripts/quality-gate.js" },
    );
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("production code unreviewed");
    expect(r.stderr).not.toContain("typecheck/tests not run");
  });

  it("does NOT warn about review for docs-only commits (skip tier)", () => {
    writeObservations([
      {
        eventType: "tool_pre",
        toolName: "Bash",
        metadata: { command: "npx vitest run" },
      },
    ]);
    const r = runHook(
      {
        session_id: SESSION_ID,
        tool_input: { command: "git push origin main" },
      },
      { KADMON_TEST_PUSH_FILES: "README.md:docs/roadmap/v1.1-learning-system.md" },
    );
    // No production code, verify present, review absent — skip tier is legitimate
    expect(r.code).toBe(0);
    expect(r.stderr).not.toContain("production code unreviewed");
    expect(r.stderr).not.toContain("kody not invoked");
  });

  it("warns when a Python production file is unreviewed (ADR-034 getDiffScope parity)", () => {
    // Regression test: the old hasProductionCode check hardcoded
    // scripts/lib/ + .claude/hooks/scripts/ with .ts/.js extensions only,
    // so a Python production file (e.g. src/) never tripped the warning.
    writeObservations([
      {
        eventType: "tool_pre",
        toolName: "Bash",
        metadata: { command: "npx vitest run" },
      },
    ]);
    const r = runHook(
      {
        session_id: SESSION_ID,
        tool_input: { command: "git push origin main" },
      },
      { KADMON_TEST_PUSH_FILES: "src/api/handler.py" },
    );
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("production code unreviewed");
  });

  it("warns when 10+ files unreviewed even without production code (refactor catch)", () => {
    writeObservations([
      {
        eventType: "tool_pre",
        toolName: "Bash",
        metadata: { command: "npx vitest run" },
      },
    ]);
    const tenFiles = Array.from({ length: 10 }, (_, i) => `docs/file-${i}.md`).join(":");
    const r = runHook(
      {
        session_id: SESSION_ID,
        tool_input: { command: "git push origin main" },
      },
      { KADMON_TEST_PUSH_FILES: tenFiles },
    );
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("10 files unreviewed");
  });

  it("warns when only review found but no verify (skip tier files)", () => {
    writeObservations([
      {
        eventType: "tool_pre",
        toolName: "Agent",
        metadata: { agentType: "kody", command: null },
      },
    ]);
    // Empty file list simulates a skip-tier commit (no production code, no
    // large refactor). Only the verify warning should fire.
    const r = runHook(
      {
        session_id: SESSION_ID,
        tool_input: { command: "git push origin main" },
      },
      { KADMON_TEST_PUSH_FILES: "" },
    );
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("typecheck/tests not run");
    expect(r.stderr).not.toContain("production code unreviewed");
  });

  // AUD-15 (2026-07-12 audit) — session_id from stdin must be validated
  // against /^[a-zA-Z0-9_-]+$/ before being used to build a filesystem path.
  // Regression test: plant a decoy observations.jsonl OUTSIDE the kadmon
  // sandbox at the location a "../" session_id resolves to. Pre-fix, this
  // hook did `path.join(os.tmpdir(), "kadmon", sid, "observations.jsonl")`
  // with no validation, so session_id="../evil-gpr-X" resolved to
  // os.tmpdir()/evil-gpr-X/observations.jsonl (escaping the "kadmon" dir)
  // and the hook would read a decoy planted there. This decoy has NO verify
  // command, so pre-fix the hook would warn (exit 1) after reading it. Post-fix
  // the malformed session_id is rejected by safeSessionDir() and the whole
  // observations check is skipped — behaving like the "no session_id" case
  // (exit 0) instead of reading attacker-controlled content.
  it("does not read observations from a path outside the kadmon sandbox for a traversal session_id", () => {
    const escapedName = `evil-gpr-${Date.now()}`;
    const escapedDir = path.join(os.tmpdir(), escapedName);
    fs.mkdirSync(escapedDir, { recursive: true });
    fs.writeFileSync(
      path.join(escapedDir, "observations.jsonl"),
      JSON.stringify({ eventType: "tool_pre", toolName: "Read", metadata: {} }) + "\n",
    );
    try {
      const r = runHook(
        {
          session_id: `../${escapedName}`,
          tool_input: { command: "git push origin main" },
        },
        { KADMON_TEST_PUSH_FILES: "scripts/lib/state-store.ts" },
      );
      // Fails open — same contract as a missing session_id — instead of
      // reading the decoy and warning about missing verify/review.
      expect(r.code).toBe(0);
    } finally {
      fs.rmSync(escapedDir, { recursive: true, force: true });
    }
  });

  // ─── Cross-repo cwd (B1, 2026-07-21) ──────────────────────────────────────
  // The hook's own `git diff @{u}..HEAD` must resolve against the repo the
  // Bash COMMAND targets, not the session's process.cwd().
  //
  // The assertion is deliberately DIFFERENTIAL — an earlier version accepted
  // `[0, 1]`, which passes identically whether or not the cwd fix is wired
  // up, so it proved only that the hook does not crash. Here the two repos
  // are constructed to disagree: the TARGET is synced with its upstream (an
  // empty unpushed diff, so nothing to warn about), while process.cwd() is a
  // repo with no upstream at all (its diff call throws, and the hook's
  // warn-safe fallback assumes production code). Reading the wrong one is
  // therefore visible as exit 1 instead of exit 0. Both repos are temp dirs,
  // so the live repo's state cannot influence the result.
  it("reads the cd target's repo, not process.cwd(): synced target exits 0 while the cwd repo would warn", () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-gpr-bare-"));
    const target = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-gpr-target-"));
    const cwdRepo = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-gpr-cwd-"));
    try {
      gitExec(["init", "--bare", "."], bare);

      // Target repo: cloned from the bare remote and fully pushed, so
      // `git diff @{u}..HEAD` is empty — no unreviewed files, no warning.
      gitExec(["clone", bare, "."], target);
      gitExec(["config", "user.email", "test@test.com"], target);
      gitExec(["config", "user.name", "Test"], target);
      fs.writeFileSync(path.join(target, "README.md"), "init\n");
      gitExec(["add", "."], target);
      gitExec(["commit", "-m", "init"], target);
      gitExec(["push", "-u", "origin", "HEAD"], target);

      // process.cwd() repo: no upstream, so the hook's diff call throws and
      // its warn-safe fallback reports production code — the wrong answer.
      gitExec(["init", "."], cwdRepo);
      gitExec(["config", "user.email", "test@test.com"], cwdRepo);
      gitExec(["config", "user.name", "Test"], cwdRepo);
      fs.writeFileSync(path.join(cwdRepo, "README.md"), "init\n");
      gitExec(["add", "."], cwdRepo);
      gitExec(["commit", "-m", "init"], cwdRepo);

      // Seed a verify observation so the only warning left in play is the
      // production-code one this test is about.
      writeObservations([
        {
          eventType: "tool_pre",
          toolName: "Bash",
          metadata: { command: "npx vitest run" },
        },
      ]);

      const r = runHook(
        {
          session_id: SESSION_ID,
          tool_input: { command: `cd ${target} && git push origin HEAD` },
        },
        {},
        cwdRepo,
      );
      expect(r.code).toBe(0);
      expect(r.stderr).not.toContain("production code unreviewed");
    } finally {
      for (const dir of [bare, target, cwdRepo]) {
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
      }
    }
  });

  it("exits 0 when observations file does not exist", () => {
    // Remove the observations file (dir exists but no file)
    try {
      fs.unlinkSync(OBS_FILE);
    } catch {
      /* may not exist */
    }
    const r = runHook({
      session_id: SESSION_ID,
      tool_input: { command: "git push origin main" },
    });
    // No observations file means warnings array stays empty (no push into it)
    expect(r.code).toBe(0);
  });
});
