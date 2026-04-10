import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/commit-quality.js");

function runHook(
  input: object,
  cwd?: string,
): { code: number; stderr: string } {
  try {
    execFileSync("node", [HOOK], {
      encoding: "utf8",
      input: JSON.stringify(input),
      stdio: ["pipe", "pipe", "pipe"],
      cwd,
    });
    return { code: 0, stderr: "" };
  } catch (err: unknown) {
    const e = err as { status: number; stderr: string };
    return { code: e.status ?? 1, stderr: e.stderr ?? "" };
  }
}

function gitExec(args: string, cwd: string): void {
  execSync(args, { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}

describe("commit-quality", () => {
  let tmpRepo: string;

  beforeEach(() => {
    tmpRepo = path.join(os.tmpdir(), `kadmon-cq-test-${Date.now()}`);
    fs.mkdirSync(tmpRepo, { recursive: true });
    gitExec("git init", tmpRepo);
    gitExec('git config user.email "test@test.com"', tmpRepo);
    gitExec('git config user.name "Test"', tmpRepo);
    // Initial commit so git diff --cached works
    fs.writeFileSync(path.join(tmpRepo, "README.md"), "init");
    gitExec("git add .", tmpRepo);
    gitExec('git commit -m "init"', tmpRepo);
  });

  afterEach(() => {
    fs.rmSync(tmpRepo, { recursive: true, force: true });
  });

  it("exits 0 when command is not git commit", () => {
    const r = runHook({ tool_input: { command: "npm test" } });
    expect(r.code).toBe(0);
  });

  it("exits 0 when command is git commit --amend without -m", () => {
    const r = runHook({ tool_input: { command: "git commit --amend" } });
    expect(r.code).toBe(0);
  });

  it("exits 0 when no staged changes", () => {
    const r = runHook(
      { tool_input: { command: 'git commit -m "test"' } },
      tmpRepo,
    );
    expect(r.code).toBe(0);
  });

  it("blocks when staged diff contains console.log in production file", () => {
    fs.mkdirSync(path.join(tmpRepo, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRepo, "src/app.ts"),
      'console.log("debug");\nexport const x = 1;\n',
    );
    gitExec("git add src/app.ts", tmpRepo);

    const r = runHook(
      { tool_input: { command: 'git commit -m "feat: add app"' } },
      tmpRepo,
    );
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("console.log");
  });

  it("allows console.log in test files", () => {
    fs.writeFileSync(
      path.join(tmpRepo, "app.test.ts"),
      'console.log("test debug");\n',
    );
    gitExec("git add app.test.ts", tmpRepo);

    const r = runHook(
      { tool_input: { command: 'git commit -m "test: add test"' } },
      tmpRepo,
    );
    expect(r.code).toBe(0);
  });

  it("allows console.log in hook scripts", () => {
    fs.mkdirSync(path.join(tmpRepo, ".claude/hooks/scripts"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(tmpRepo, ".claude/hooks/scripts/my-hook.js"),
      'console.log("hook output");\n',
    );
    gitExec("git add .claude/hooks/scripts/my-hook.js", tmpRepo);

    const r = runHook(
      { tool_input: { command: 'git commit -m "chore: add hook"' } },
      tmpRepo,
    );
    expect(r.code).toBe(0);
  });

  it("blocks when staged diff contains debugger statement", () => {
    fs.mkdirSync(path.join(tmpRepo, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRepo, "src/debug.ts"),
      "function foo() {\n  debugger\n  return 1;\n}\n",
    );
    gitExec("git add src/debug.ts", tmpRepo);

    const r = runHook(
      { tool_input: { command: 'git commit -m "feat: debug"' } },
      tmpRepo,
    );
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("debugger");
  });

  it("blocks when staged diff contains secret pattern", () => {
    fs.mkdirSync(path.join(tmpRepo, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRepo, "src/config.ts"),
      'const api_key = "AAAAAABBBBBBCCCCCCDDDDDD";\n',
    );
    gitExec("git add src/config.ts", tmpRepo);

    const r = runHook(
      { tool_input: { command: 'git commit -m "feat: config"' } },
      tmpRepo,
    );
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("secret");
  });

  it("blocks when staged diff contains GitHub PAT (ghp_)", () => {
    fs.mkdirSync(path.join(tmpRepo, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRepo, "src/auth.ts"),
      'const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";\n',
    );
    gitExec("git add src/auth.ts", tmpRepo);

    const r = runHook(
      { tool_input: { command: 'git commit -m "feat: auth"' } },
      tmpRepo,
    );
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("secret");
  });

  it("blocks when staged diff contains Stripe secret key (sk-live)", () => {
    fs.mkdirSync(path.join(tmpRepo, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRepo, "src/payment.ts"),
      'const key = "sk-live-ABCDEFGHIJKLMNOPQRSTUabcdef";\n',
    );
    gitExec("git add src/payment.ts", tmpRepo);

    const r = runHook(
      { tool_input: { command: 'git commit -m "feat: payment"' } },
      tmpRepo,
    );
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("secret");
  });

  it("blocks when staged diff contains Slack token (xoxb-)", () => {
    fs.mkdirSync(path.join(tmpRepo, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRepo, "src/notify.ts"),
      'const slack = "xoxb-1234567890-abcdefghij";\n',
    );
    gitExec("git add src/notify.ts", tmpRepo);

    const r = runHook(
      { tool_input: { command: 'git commit -m "feat: notify"' } },
      tmpRepo,
    );
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("secret");
  });

  it("blocks when staged diff contains Anthropic API key (sk-ant-)", () => {
    fs.mkdirSync(path.join(tmpRepo, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRepo, "src/ai.ts"),
      'const key = "sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZabcd";\n',
    );
    gitExec("git add src/ai.ts", tmpRepo);

    const r = runHook(
      { tool_input: { command: 'git commit -m "feat: ai"' } },
      tmpRepo,
    );
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("secret");
  });

  it("blocks when staged diff contains AWS access key (AKIA)", () => {
    fs.mkdirSync(path.join(tmpRepo, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRepo, "src/aws.ts"),
      'const awsKey = "AKIA1234567890ABCDEF";\n',
    );
    gitExec("git add src/aws.ts", tmpRepo);

    const r = runHook(
      { tool_input: { command: 'git commit -m "feat: aws"' } },
      tmpRepo,
    );
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("secret");
  });

  it("blocks when staged diff contains Supabase service key (sbp_)", () => {
    fs.mkdirSync(path.join(tmpRepo, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRepo, "src/db.ts"),
      'const sbKey = "sbp_1234567890abcdef1234567890abcdef12345678";\n',
    );
    gitExec("git add src/db.ts", tmpRepo);

    const r = runHook(
      { tool_input: { command: 'git commit -m "feat: db"' } },
      tmpRepo,
    );
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("secret");
  });

  it("exits 0 on empty input", () => {
    const r = runHook({});
    expect(r.code).toBe(0);
  });
});
