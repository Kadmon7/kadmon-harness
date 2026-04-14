// TDD [feniks] — Phase 1 Bug A: hook_events.duration_ms always NULL
// RED: assert durationMs is a positive integer in every logHookEvent call.
// Before the fix, durationMs is missing from all callers → test fails.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Unique run prefix to avoid cross-test pollution
const RUN_PREFIX = `test-dur-${Date.now()}`;
const KADMON_TMP = path.join(os.tmpdir(), "kadmon");

// Helpers -------------------------------------------------------------------

function hookPath(name: string): string {
  return path.resolve(`.claude/hooks/scripts/${name}.js`);
}

function hookEventsFile(sessionId: string): string {
  return path.join(KADMON_TMP, sessionId, "hook-events.jsonl");
}

function cleanSession(sessionId: string): void {
  const dir = path.join(KADMON_TMP, sessionId);
  fs.rmSync(dir, { recursive: true, force: true });
}

function runHook(
  hookName: string,
  input: object,
  env: Record<string, string> = {},
  cwd?: string,
): { exitCode: number; stderr: string } {
  const result = spawnSync("node", [hookPath(hookName)], {
    encoding: "utf8",
    input: JSON.stringify(input),
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ...env },
    ...(cwd !== undefined ? { cwd } : {}),
  });
  return {
    exitCode: result.status ?? 0,
    stderr: result.stderr ?? "",
  };
}

/** Read last JSONL line written to hook-events.jsonl for a session. */
function lastHookEvent(sessionId: string): Record<string, unknown> | null {
  const file = hookEventsFile(sessionId);
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
  if (lines.length === 0) return null;
  return JSON.parse(lines[lines.length - 1]) as Record<string, unknown>;
}

/** Assert durationMs is a non-negative integer below 500ms. */
function assertDurationMs(
  event: Record<string, unknown> | null,
  hookLabel: string,
): void {
  expect(event, `${hookLabel}: hook-events.jsonl was not written`).not.toBeNull();
  const dm = (event as Record<string, unknown>).durationMs;
  expect(
    typeof dm,
    `${hookLabel}: durationMs should be a number, got ${typeof dm} (value: ${String(dm)})`,
  ).toBe("number");
  expect(
    (dm as number) >= 0,
    `${hookLabel}: durationMs should be >= 0, got ${String(dm)}`,
  ).toBe(true);
  expect(
    (dm as number) < 500,
    `${hookLabel}: durationMs should be < 500ms (was ${String(dm)}ms — is the hook hanging?)`,
  ).toBe(true);
}

// Per-test session ID and obs dir setup -------------------------------------

let sessionId: string;
let obsDir: string;
let obsFile: string;

beforeEach(() => {
  sessionId = `${RUN_PREFIX}-${Math.random().toString(36).slice(2, 8)}`;
  obsDir = path.join(KADMON_TMP, sessionId);
  obsFile = path.join(obsDir, "observations.jsonl");
  fs.mkdirSync(obsDir, { recursive: true });
});

afterEach(() => {
  cleanSession(sessionId);
});

// ---------------------------------------------------------------------------
// 1. block-no-verify — logHookEvent on rejection branch (exit 2)
// ---------------------------------------------------------------------------
describe("hook duration: block-no-verify", () => {
  it("writes durationMs when blocking --no-verify", () => {
    runHook("block-no-verify", {
      session_id: sessionId,
      tool_name: "Bash",
      tool_input: { command: "git commit --no-verify" },
    });
    const event = lastHookEvent(sessionId);
    assertDurationMs(event, "block-no-verify");
    expect(event?.hookName).toBe("block-no-verify");
    expect(event?.exitCode).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 2. commit-format-guard — logHookEvent on rejection branch (exit 2)
// ---------------------------------------------------------------------------
describe("hook duration: commit-format-guard", () => {
  it("writes durationMs when blocking invalid commit format", () => {
    runHook("commit-format-guard", {
      session_id: sessionId,
      tool_name: "Bash",
      tool_input: { command: 'git commit -m "bad commit message no type"' },
    });
    const event = lastHookEvent(sessionId);
    assertDurationMs(event, "commit-format-guard");
    expect(event?.hookName).toBe("commit-format-guard");
    expect(event?.exitCode).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 3. commit-quality — logHookEvent when quality issues found (exit 2)
//    Requires a real git repo with staged changes containing console.log.
// ---------------------------------------------------------------------------
describe("hook duration: commit-quality", () => {
  let tmpRepo: string;

  beforeEach(() => {
    tmpRepo = path.join(os.tmpdir(), `kadmon-cq-dur-${Date.now()}`);
    fs.mkdirSync(tmpRepo, { recursive: true });
    execSync("git init", { cwd: tmpRepo, stdio: "ignore" });
    execSync('git config user.email "test@test.com"', { cwd: tmpRepo, stdio: "ignore" });
    execSync('git config user.name "Test"', { cwd: tmpRepo, stdio: "ignore" });
    // Initial commit so git diff --cached has a base
    fs.writeFileSync(path.join(tmpRepo, "README.md"), "init\n");
    execSync("git add README.md", { cwd: tmpRepo, stdio: "ignore" });
    execSync('git commit -m "init"', { cwd: tmpRepo, stdio: "ignore" });
  });

  afterEach(() => {
    fs.rmSync(tmpRepo, { recursive: true, force: true });
  });

  it("writes durationMs when blocking quality issue (console.log in production file)", () => {
    const srcDir = path.join(tmpRepo, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, "app.ts"),
      'export function run() { console.log("debug"); }\n',
    );
    execSync("git add src/app.ts", { cwd: tmpRepo, stdio: "ignore" });

    const result = runHook(
      "commit-quality",
      {
        session_id: sessionId,
        tool_name: "Bash",
        tool_input: { command: 'git commit -m "feat: add app"' },
      },
      {},
      tmpRepo,
    );

    // The hook must have found the staged console.log and fired logHookEvent
    expect(result.exitCode).toBe(2);
    const event = lastHookEvent(sessionId);
    assertDurationMs(event, "commit-quality");
    expect(event?.hookName).toBe("commit-quality");
    expect(event?.exitCode).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 4. git-push-reminder — logHookEvent on warning branch (exit 1)
//    Trigger: push with production code and no verify/review in observations
// ---------------------------------------------------------------------------
describe("hook duration: git-push-reminder", () => {
  it("writes durationMs when warning before push", () => {
    // Write minimal observations (no verify or review recorded)
    fs.writeFileSync(
      obsFile,
      JSON.stringify({ toolName: "Read", filePath: "README.md" }) + "\n",
    );

    runHook(
      "git-push-reminder",
      {
        session_id: sessionId,
        tool_name: "Bash",
        tool_input: { command: "git push origin main" },
      },
      { KADMON_TEST_PUSH_FILES: "scripts/lib/state-store.ts" },
    );

    const event = lastHookEvent(sessionId);
    assertDurationMs(event, "git-push-reminder");
    expect(event?.hookName).toBe("git-push-reminder");
    expect(event?.exitCode).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 5. config-protection — two logHookEvent call sites
//    5a: truncated stdin branch
//    5b: dangerous pattern in protected file branch
// ---------------------------------------------------------------------------
describe("hook duration: config-protection", () => {
  it("writes durationMs when blocking truncated stdin", () => {
    runHook("config-protection", {
      _truncated: true,
      session_id: sessionId,
      tool_name: "Edit",
      tool_input: {
        file_path: "/project/tsconfig.json",
        new_string: '{ "compilerOptions": { "strict": true } }',
      },
    });
    const event = lastHookEvent(sessionId);
    assertDurationMs(event, "config-protection (truncated path)");
    expect(event?.hookName).toBe("config-protection");
    expect(event?.exitCode).toBe(2);
  });

  it("writes durationMs when blocking dangerous pattern in protected file", () => {
    runHook("config-protection", {
      session_id: sessionId,
      tool_name: "Edit",
      tool_input: {
        file_path: "/project/tsconfig.json",
        new_string: '{ "compilerOptions": { "strict": false } }',
      },
    });
    const event = lastHookEvent(sessionId);
    assertDurationMs(event, "config-protection (dangerous pattern)");
    expect(event?.hookName).toBe("config-protection");
    expect(event?.exitCode).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 6. deps-change-reminder — logHookEvent on warning branch (exit 1)
//    Trigger: package.json edit with a dependency section in content
// ---------------------------------------------------------------------------
describe("hook duration: deps-change-reminder", () => {
  it("writes durationMs when warning about dependency change", () => {
    runHook("deps-change-reminder", {
      session_id: sessionId,
      tool_name: "Edit",
      tool_input: {
        file_path: "/project/package.json",
        new_string: '{ "dependencies": { "vitest": "^1.0.0" } }',
      },
    });
    const event = lastHookEvent(sessionId);
    assertDurationMs(event, "deps-change-reminder");
    expect(event?.hookName).toBe("deps-change-reminder");
    expect(event?.exitCode).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 7. no-context-guard — two logHookEvent call sites
//    7a: truncated stdin branch
//    7b: no-prior-read branch
// ---------------------------------------------------------------------------
describe("hook duration: no-context-guard", () => {
  it("writes durationMs when blocking truncated stdin", () => {
    runHook("no-context-guard", {
      _truncated: true,
      session_id: sessionId,
      tool_name: "Write",
      tool_input: { file_path: "src/main.ts" },
    });
    const event = lastHookEvent(sessionId);
    assertDurationMs(event, "no-context-guard (truncated path)");
    expect(event?.hookName).toBe("no-context-guard");
    expect(event?.exitCode).toBe(2);
  });

  it("writes durationMs when blocking edit without prior Read", () => {
    // Write an empty observations file — no prior Read recorded
    fs.writeFileSync(obsFile, "");

    runHook("no-context-guard", {
      session_id: sessionId,
      tool_name: "Write",
      tool_input: { file_path: "src/main.ts" },
    });
    const event = lastHookEvent(sessionId);
    assertDurationMs(event, "no-context-guard (no-read path)");
    expect(event?.hookName).toBe("no-context-guard");
    expect(event?.exitCode).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 8. console-log-warn — logHookEvent on warning branch (exit 1)
//    Trigger: production TS file content containing console.log(
// ---------------------------------------------------------------------------
describe("hook duration: console-log-warn", () => {
  it("writes durationMs when warning about console.log in production code", () => {
    runHook("console-log-warn", {
      session_id: sessionId,
      tool_name: "Edit",
      tool_input: {
        file_path: "scripts/lib/my-module.ts",
        new_string: 'export function foo() { console.log("debug"); }',
      },
    });
    const event = lastHookEvent(sessionId);
    assertDurationMs(event, "console-log-warn");
    expect(event?.hookName).toBe("console-log-warn");
    expect(event?.exitCode).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 9. ts-review-reminder — logHookEvent when 5+ TS edits without review
//    Trigger: write 5 .ts edit observations, no review agent present
// ---------------------------------------------------------------------------
describe("hook duration: ts-review-reminder", () => {
  it("writes durationMs when warning about unreviewed TS edits", () => {
    const obs = [
      { toolName: "Edit", filePath: "a.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "b.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "c.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "d.ts", eventType: "tool_pre" },
      { toolName: "Edit", filePath: "e.ts", eventType: "tool_pre" },
    ];
    fs.writeFileSync(obsFile, obs.map((o) => JSON.stringify(o)).join("\n") + "\n");

    runHook("ts-review-reminder", {
      session_id: sessionId,
      tool_input: { file_path: "f.ts" },
    });
    const event = lastHookEvent(sessionId);
    assertDurationMs(event, "ts-review-reminder");
    expect(event?.hookName).toBe("ts-review-reminder");
    expect(event?.exitCode).toBe(1);
  });
});
