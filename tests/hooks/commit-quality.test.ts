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
    fs.rmSync(tmpRepo, { recursive: true, force: true, maxRetries: 5 });
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

  it("fails closed (exit 2) when stdin is malformed JSON", () => {
    let threw = false;
    try {
      execFileSync("node", [HOOK], {
        encoding: "utf8",
        input: "{not valid json!!",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err: unknown) {
      threw = true;
      const e = err as { status: number; stderr: string };
      expect(e.status).toBe(2);
      expect(e.stderr).toContain("error");
    }
    expect(threw).toBe(true);
  });

  // ─── Python debug markers (plan-020 Phase B) ──────────────────────────────

  it("blocks when staged diff contains print() in a .py file", () => {
    fs.mkdirSync(path.join(tmpRepo, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRepo, "src/app.py"),
      'print("debug")\nx = 1\n',
    );
    gitExec("git add src/app.py", tmpRepo);

    const r = runHook(
      { tool_input: { command: 'git commit -m "feat: app"' } },
      tmpRepo,
    );
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/print/i);
  });

  it("blocks when staged diff contains breakpoint() in a .py file", () => {
    fs.mkdirSync(path.join(tmpRepo, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRepo, "src/dbg.py"),
      "def f():\n    breakpoint()\n    return 1\n",
    );
    gitExec("git add src/dbg.py", tmpRepo);

    const r = runHook(
      { tool_input: { command: 'git commit -m "feat: dbg"' } },
      tmpRepo,
    );
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/breakpoint/i);
  });

  it("allows print() in test_*.py files", () => {
    fs.writeFileSync(
      path.join(tmpRepo, "test_app.py"),
      'def test_x():\n    print("debug")\n',
    );
    gitExec("git add test_app.py", tmpRepo);

    const r = runHook(
      { tool_input: { command: 'git commit -m "test: add"' } },
      tmpRepo,
    );
    expect(r.code).toBe(0);
  });

  it("allows print() in *_test.py files", () => {
    fs.writeFileSync(
      path.join(tmpRepo, "app_test.py"),
      'def test_x():\n    print("debug")\n',
    );
    gitExec("git add app_test.py", tmpRepo);

    const r = runHook(
      { tool_input: { command: 'git commit -m "test: add"' } },
      tmpRepo,
    );
    expect(r.code).toBe(0);
  });

  it("allows .py without print/breakpoint", () => {
    fs.writeFileSync(
      path.join(tmpRepo, "clean.py"),
      "def add(a, b):\n    return a + b\n",
    );
    gitExec("git add clean.py", tmpRepo);

    const r = runHook(
      { tool_input: { command: 'git commit -m "feat: clean"' } },
      tmpRepo,
    );
    expect(r.code).toBe(0);
  });

  // ─── Cross-repo cwd (B1, 2026-07-21) ──────────────────────────────────────
  // The hook's own `git diff --cached` call must target the repo the Bash
  // COMMAND points at (via a leading `cd <repo> &&`), not the session's
  // process.cwd() repo. Without resolveCommandCwd(), these two tests prove
  // the bug: repo B's dirty diff leaks into repo A's commit (false block),
  // and repo A's dirty diff leaks into repo B's commit (false pass).
  describe("cross-repo cwd resolution", () => {
    let repoA: string;
    let repoB: string;

    function initRepo(dir: string): void {
      fs.mkdirSync(dir, { recursive: true });
      gitExec("git init", dir);
      gitExec('git config user.email "test@test.com"', dir);
      gitExec('git config user.name "Test"', dir);
      fs.writeFileSync(path.join(dir, "README.md"), "init");
      gitExec("git add .", dir);
      gitExec('git commit -m "init"', dir);
    }

    beforeEach(() => {
      repoA = path.join(os.tmpdir(), `kadmon-cq-repoA-${Date.now()}`);
      repoB = path.join(os.tmpdir(), `kadmon-cq-repoB-${Date.now()}`);
      initRepo(repoA);
      initRepo(repoB);
    });

    afterEach(() => {
      fs.rmSync(repoA, { recursive: true, force: true, maxRetries: 5 });
      fs.rmSync(repoB, { recursive: true, force: true, maxRetries: 5 });
    });

    it("blocks a commit in repo B when repo B has a console.log staged, even though process.cwd() is repo A", () => {
      fs.writeFileSync(
        path.join(repoB, "app.ts"),
        'console.log("debug");\n',
      );
      gitExec("git add app.ts", repoB);

      const r = runHook(
        {
          tool_input: {
            command: `cd ${repoB} && git commit -m "feat: repoB"`,
          },
        },
        repoA,
      );
      expect(r.code).toBe(2);
      expect(r.stderr).toContain("console.log");
    });

    it("does NOT block a commit targeting a CLEAN repo B, even though the process.cwd() repo A has a dirty console.log staged", () => {
      fs.writeFileSync(
        path.join(repoA, "app.ts"),
        'console.log("debug");\n',
      );
      gitExec("git add app.ts", repoA);

      const r = runHook(
        {
          tool_input: {
            command: `cd ${repoB} && git commit -m "feat: repoB clean"`,
          },
        },
        repoA,
      );
      expect(r.code).toBe(0);
    });

    // Reviewer-verified bypass (2026-07-22): resolving only the FIRST cd sent
    // the scan to a non-repo scratch dir, git diff threw, and the fail-open
    // catch allowed the commit — with a real staged secret — unscanned.
    it("blocks a staged secret when a scratch dir is cd'd through before the real repo", () => {
      const scratch = path.join(os.tmpdir(), `kadmon-cq-scratch-${Date.now()}`);
      fs.mkdirSync(scratch, { recursive: true });
      try {
        fs.writeFileSync(
          path.join(repoB, "config.ts"),
          'const api_key = "AAAAAABBBBBBCCCCCCDDDDDD";\n',
        );
        gitExec("git add config.ts", repoB);

        const r = runHook(
          {
            tool_input: {
              command: `cd ${scratch} && cd ${repoB} && git commit -m "feat: cfg"`,
            },
          },
          repoA,
        );
        expect(r.code).toBe(2);
        expect(r.stderr).toContain("secret");
      } finally {
        fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5 });
      }
    });
  });

  // ─── Debug-marker per-line opt-out (B1) ───────────────────────────────────
  describe("debug-marker opt-out", () => {
    it("allows console.log with a commit-quality: allow marker on the same line", () => {
      fs.mkdirSync(path.join(tmpRepo, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpRepo, "src/app.ts"),
        'console.log("x"); // commit-quality: allow\n',
      );
      gitExec("git add src/app.ts", tmpRepo);

      const r = runHook(
        { tool_input: { command: 'git commit -m "feat: app"' } },
        tmpRepo,
      );
      expect(r.code).toBe(0);
    });

    it("allows console.log with an eslint-disable-line no-console marker", () => {
      fs.mkdirSync(path.join(tmpRepo, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpRepo, "src/app.ts"),
        'console.log("x"); // eslint-disable-line no-console\n',
      );
      gitExec("git add src/app.ts", tmpRepo);

      const r = runHook(
        { tool_input: { command: 'git commit -m "feat: app"' } },
        tmpRepo,
      );
      expect(r.code).toBe(0);
    });

    it("allows print() with a noqa marker in a .py file", () => {
      fs.writeFileSync(
        path.join(tmpRepo, "app.py"),
        'print("x")  # noqa\n',
      );
      gitExec("git add app.py", tmpRepo);

      const r = runHook(
        { tool_input: { command: 'git commit -m "feat: app"' } },
        tmpRepo,
      );
      expect(r.code).toBe(0);
    });

    it("still blocks when a console.log opt-out line coexists with a secret on another line (secrets never skippable)", () => {
      fs.mkdirSync(path.join(tmpRepo, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpRepo, "src/app.ts"),
        'console.log("x"); // commit-quality: allow\nconst api_key = "AAAAAABBBBBBCCCCCCDDDDDD";\n',
      );
      gitExec("git add src/app.ts", tmpRepo);

      const r = runHook(
        { tool_input: { command: 'git commit -m "feat: app"' } },
        tmpRepo,
      );
      expect(r.code).toBe(2);
      expect(r.stderr).toContain("secret");
    });

    it("does not treat a marker word inside a string literal as an opt-out", () => {
      fs.mkdirSync(path.join(tmpRepo, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpRepo, "src/app.ts"),
        'console.log("say noqa to the user");\n',
      );
      gitExec("git add src/app.ts", tmpRepo);

      const r = runHook(
        { tool_input: { command: 'git commit -m "feat: app"' } },
        tmpRepo,
      );
      expect(r.code).toBe(2);
      expect(r.stderr).toContain("console.log");
    });
  });

  // ─── CLI-entrypoint exemption (B1) ─────────────────────────────────────────
  describe("CLI entrypoint exemption", () => {
    // Lock-in for the invariant the exemptions must never reach: a CLI
    // entrypoint is exempt from DEBUG markers only. If a future refactor
    // moved the secret scan inside the exemption gate, this is the test
    // that catches it.
    it("still blocks a secret inside an exempt CLI entrypoint (secrets never skippable)", () => {
      fs.mkdirSync(path.join(tmpRepo, "bin"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpRepo, "bin/tool.js"),
        'console.log("cli output");\nconst token = "AAAAAABBBBBBCCCCCCDDDDDD";\n',
      );
      gitExec("git add bin/tool.js", tmpRepo);

      const r = runHook(
        { tool_input: { command: 'git commit -m "chore: cli"' } },
        tmpRepo,
      );
      expect(r.code).toBe(2);
      expect(r.stderr).toContain("secret");
    });

    it("allows console.log in bin/tool.js", () => {
      fs.mkdirSync(path.join(tmpRepo, "bin"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpRepo, "bin/tool.js"),
        'console.log("cli output");\n',
      );
      gitExec("git add bin/tool.js", tmpRepo);

      const r = runHook(
        { tool_input: { command: 'git commit -m "chore: cli"' } },
        tmpRepo,
      );
      expect(r.code).toBe(0);
    });

    it("allows console.log in src/cli.ts (cli.<ext> filename)", () => {
      fs.mkdirSync(path.join(tmpRepo, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpRepo, "src/cli.ts"),
        'console.log("cli output");\n',
      );
      gitExec("git add src/cli.ts", tmpRepo);

      const r = runHook(
        { tool_input: { command: 'git commit -m "chore: cli"' } },
        tmpRepo,
      );
      expect(r.code).toBe(0);
    });

    it("allows console.log inside a cli/ directory segment", () => {
      fs.mkdirSync(path.join(tmpRepo, "src/cli"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpRepo, "src/cli/index.ts"),
        'console.log("cli output");\n',
      );
      gitExec("git add src/cli/index.ts", tmpRepo);

      const r = runHook(
        { tool_input: { command: 'git commit -m "chore: cli"' } },
        tmpRepo,
      );
      expect(r.code).toBe(0);
    });

    it("still blocks console.log in a regular src file (not exempt)", () => {
      fs.mkdirSync(path.join(tmpRepo, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpRepo, "src/foo.ts"),
        'console.log("not exempt");\n',
      );
      gitExec("git add src/foo.ts", tmpRepo);

      const r = runHook(
        { tool_input: { command: 'git commit -m "feat: foo"' } },
        tmpRepo,
      );
      expect(r.code).toBe(2);
      expect(r.stderr).toContain("console.log");
    });
  });
});
