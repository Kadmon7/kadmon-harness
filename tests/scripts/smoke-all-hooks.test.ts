/**
 * TDD [feniks]
 * Unit tests for scripts/smoke-all-hooks.ts
 * Tests parseSettings, generateStdin, classify, reportTable — NOT runHook (integration).
 */
import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  parseSettings,
  generateStdin,
  classify,
  reportTable,
} from "../../scripts/smoke-all-hooks.js";
import type { HookDef, HookResult } from "../../scripts/smoke-all-hooks.js";

// ---------------------------------------------------------------------------
// Fixture: minimal settings.json with 2 hooks
// ---------------------------------------------------------------------------
const FIXTURE_SETTINGS_PATH = path.resolve(
  "tests/scripts/fixtures/settings-2hooks.json",
);

const REAL_SETTINGS_PATH = path.resolve(".claude/settings.json");

// ---------------------------------------------------------------------------
// 1. parseSettings
// ---------------------------------------------------------------------------
describe("parseSettings", () => {
  it("parses a fixture settings.json with 2 hooks and returns correct shape", () => {
    const hooks = parseSettings(FIXTURE_SETTINGS_PATH);
    expect(hooks).toHaveLength(2);

    const first = hooks[0];
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("script");
    expect(first).toHaveProperty("event");
    expect(first).toHaveProperty("matcher");
    expect(typeof first.name).toBe("string");
    expect(typeof first.script).toBe("string");
    expect(["PreToolUse", "PostToolUse", "PostToolUseFailure", "PreCompact", "SessionStart", "Stop"]).toContain(first.event);
  });

  it("extracts hook name from script path (basename without .js)", () => {
    const hooks = parseSettings(FIXTURE_SETTINGS_PATH);
    expect(hooks[0].name).toBe("block-no-verify");
    expect(hooks[1].name).toBe("observe-pre");
  });

  it("extracts matcher correctly", () => {
    const hooks = parseSettings(FIXTURE_SETTINGS_PATH);
    expect(hooks[0].matcher).toBe("Bash");
    expect(hooks[1].matcher).toBe("");
  });

  it("extracts event correctly", () => {
    const hooks = parseSettings(FIXTURE_SETTINGS_PATH);
    expect(hooks[0].event).toBe("PreToolUse");
    expect(hooks[1].event).toBe("PreToolUse");
  });

  it("returns EXACTLY 21 hooks for the real .claude/settings.json", () => {
    const hooks = parseSettings(REAL_SETTINGS_PATH);
    expect(hooks).toHaveLength(21);
  });

  it("all real hooks have valid event types", () => {
    const validEvents = ["PreToolUse", "PostToolUse", "PostToolUseFailure", "PreCompact", "SessionStart", "Stop"];
    const hooks = parseSettings(REAL_SETTINGS_PATH);
    for (const hook of hooks) {
      expect(validEvents).toContain(hook.event);
    }
  });

  it("all real hooks have non-empty name and script", () => {
    const hooks = parseSettings(REAL_SETTINGS_PATH);
    for (const hook of hooks) {
      expect(hook.name.length).toBeGreaterThan(0);
      expect(hook.script.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. generateStdin
// ---------------------------------------------------------------------------
describe("generateStdin", () => {
  function makeHook(event: HookDef["event"], matcher: string, name = "test-hook"): HookDef {
    return {
      name,
      script: `.claude/hooks/scripts/${name}.js`,
      event,
      matcher,
    };
  }

  it("PreToolUse/Bash → valid JSON with tool_name Bash and git command", () => {
    const stdin = generateStdin(makeHook("PreToolUse", "Bash", "block-no-verify"));
    const parsed = JSON.parse(stdin);
    expect(parsed.tool_name).toBe("Bash");
    expect(parsed.tool_input?.command).toBeDefined();
    expect(typeof parsed.tool_input.command).toBe("string");
  });

  it("PreToolUse/Edit|Write → valid JSON with tool_name Edit and file_path", () => {
    const stdin = generateStdin(makeHook("PreToolUse", "Edit|Write", "config-protection"));
    const parsed = JSON.parse(stdin);
    expect(parsed.tool_name).toBe("Edit");
    expect(parsed.tool_input?.file_path).toBeDefined();
    expect(parsed.tool_input?.old_string).toBeDefined();
    expect(parsed.tool_input?.new_string).toBeDefined();
  });

  it("PreToolUse/mcp__ → valid JSON with tool_name starting with mcp__", () => {
    const stdin = generateStdin(makeHook("PreToolUse", "mcp__", "mcp-health-check"));
    const parsed = JSON.parse(stdin);
    expect(parsed.tool_name).toMatch(/^mcp__/);
    expect(parsed.tool_input).toBeDefined();
  });

  it('PreToolUse/"" → valid JSON with generic tool_name Read', () => {
    const stdin = generateStdin(makeHook("PreToolUse", "", "observe-pre"));
    const parsed = JSON.parse(stdin);
    expect(parsed.tool_name).toBe("Read");
    expect(parsed.tool_input?.file_path).toBeDefined();
  });

  it("PostToolUse/Bash → includes tool_response with output", () => {
    const stdin = generateStdin(makeHook("PostToolUse", "Bash", "pr-created"));
    const parsed = JSON.parse(stdin);
    expect(parsed.tool_name).toBe("Bash");
    expect(parsed.tool_response).toBeDefined();
    expect(parsed.tool_response?.output).toBeDefined();
  });

  it("PostToolUse/Edit|Write → includes tool_response with success", () => {
    const stdin = generateStdin(makeHook("PostToolUse", "Edit|Write", "post-edit-format"));
    const parsed = JSON.parse(stdin);
    expect(parsed.tool_name).toBe("Edit");
    expect(parsed.tool_response?.success).toBe(true);
  });

  it('PostToolUse/"" → includes observe-post shape with tool_response', () => {
    const stdin = generateStdin(makeHook("PostToolUse", "", "observe-post"));
    const parsed = JSON.parse(stdin);
    expect(parsed.tool_name).toBe("Read");
    expect(parsed.tool_response).toBeDefined();
  });

  it("PostToolUseFailure/mcp__ → includes error in tool_response", () => {
    const stdin = generateStdin(makeHook("PostToolUseFailure", "mcp__", "mcp-health-failure"));
    const parsed = JSON.parse(stdin);
    expect(parsed.tool_name).toMatch(/^mcp__/);
    expect(parsed.tool_response?.error).toBeDefined();
  });

  it("PreCompact → valid JSON with trigger field", () => {
    const stdin = generateStdin(makeHook("PreCompact", "", "pre-compact-save"));
    const parsed = JSON.parse(stdin);
    expect(parsed.trigger).toBeDefined();
  });

  it("SessionStart → valid JSON with session_id field", () => {
    const stdin = generateStdin(makeHook("SessionStart", "", "session-start"));
    const parsed = JSON.parse(stdin);
    expect(parsed.session_id).toBeDefined();
    expect(parsed.session_id).toMatch(/^smoke-/);
  });

  it("Stop → valid JSON with session_id field", () => {
    const stdin = generateStdin(makeHook("Stop", "", "session-end-all"));
    const parsed = JSON.parse(stdin);
    expect(parsed.session_id).toBeDefined();
    expect(parsed.session_id).toMatch(/^smoke-/);
  });

  it("all outputs are valid JSON (no parse errors)", () => {
    const hooks = parseSettings(REAL_SETTINGS_PATH);
    for (const hook of hooks) {
      expect(() => JSON.parse(generateStdin(hook))).not.toThrow();
    }
  });

  it("no-context-guard gets Edit stdin with a non-existent path (triggers guard)", () => {
    const stdin = generateStdin(makeHook("PreToolUse", "Edit|Write", "no-context-guard"));
    const parsed = JSON.parse(stdin);
    // The file path must NOT be in observations to trigger exit 2
    expect(parsed.tool_input?.file_path).toMatch(/smoke-no-context-/);
  });
});

// ---------------------------------------------------------------------------
// 3. classify
// ---------------------------------------------------------------------------
describe("classify", () => {
  function makeResult(name: string, exitCode: number, error?: string): HookResult {
    return {
      hook: {
        name,
        script: `.claude/hooks/scripts/${name}.js`,
        event: "PreToolUse",
        matcher: "Bash",
      },
      exitCode,
      stderr: "",
      stdout: "",
      durationMs: 10,
      ...(error ? { error } : {}),
    };
  }

  // exit 0 → always pass
  it("exit 0 is always pass for any hook", () => {
    const result = classify(makeResult("observe-pre", 0));
    expect(result.status).toBe("pass");
  });

  it("exit 0 is pass for block-no-verify", () => {
    const result = classify(makeResult("block-no-verify", 0));
    expect(result.status).toBe("pass");
  });

  // exit 1 → pass for warning-type hooks
  it("exit 1 is pass for git-push-reminder (warning hook)", () => {
    const result = classify(makeResult("git-push-reminder", 1));
    expect(result.status).toBe("pass");
  });

  it("exit 1 is pass for ts-review-reminder (warning hook)", () => {
    const result = classify(makeResult("ts-review-reminder", 1));
    expect(result.status).toBe("pass");
  });

  it("exit 1 is pass for console-log-warn (warning hook)", () => {
    const result = classify(makeResult("console-log-warn", 1));
    expect(result.status).toBe("pass");
  });

  it("exit 1 is pass for deps-change-reminder (warning hook)", () => {
    const result = classify(makeResult("deps-change-reminder", 1));
    expect(result.status).toBe("pass");
  });

  it("exit 1 is pass for quality-gate (warning hook)", () => {
    const result = classify(makeResult("quality-gate", 1));
    expect(result.status).toBe("pass");
  });

  it("exit 1 is pass for post-edit-typecheck (warning hook)", () => {
    const result = classify(makeResult("post-edit-typecheck", 1));
    expect(result.status).toBe("pass");
  });

  it("exit 1 is pass for agent-metadata-sync (warning hook)", () => {
    const result = classify(makeResult("agent-metadata-sync", 1));
    expect(result.status).toBe("pass");
  });

  // exit 2 → pass for guard hooks that triggered
  it("exit 2 is pass for no-context-guard (guard triggered as expected)", () => {
    const result = classify(makeResult("no-context-guard", 2));
    expect(result.status).toBe("pass");
  });

  it("exit 2 is pass for config-protection (guard hook)", () => {
    const result = classify(makeResult("config-protection", 2));
    expect(result.status).toBe("pass");
  });

  it("exit 2 is pass for block-no-verify (guard hook)", () => {
    const result = classify(makeResult("block-no-verify", 2));
    expect(result.status).toBe("pass");
  });

  it("exit 2 is pass for commit-format-guard (guard hook)", () => {
    const result = classify(makeResult("commit-format-guard", 2));
    expect(result.status).toBe("pass");
  });

  it("exit 2 is pass for commit-quality (guard hook)", () => {
    const result = classify(makeResult("commit-quality", 2));
    expect(result.status).toBe("pass");
  });

  // exit 2 unexpected → fail for observe-type hooks
  it("exit 2 is fail for observe-pre (should never exit 2)", () => {
    const result = classify(makeResult("observe-pre", 2));
    expect(result.status).toBe("fail");
  });

  it("exit 2 is fail for observe-post (should never exit 2)", () => {
    const result = classify(makeResult("observe-post", 2));
    expect(result.status).toBe("fail");
  });

  it("exit 2 is fail for pr-created (should never exit 2)", () => {
    const result = classify(makeResult("pr-created", 2));
    expect(result.status).toBe("fail");
  });

  it("exit 2 is fail for post-edit-format (should never exit 2)", () => {
    const result = classify(makeResult("post-edit-format", 2));
    expect(result.status).toBe("fail");
  });

  it("exit 2 is fail for mcp-health-check (always exit 0)", () => {
    const result = classify(makeResult("mcp-health-check", 2));
    expect(result.status).toBe("fail");
  });

  it("exit 2 is fail for mcp-health-failure (always exit 0)", () => {
    const result = classify(makeResult("mcp-health-failure", 2));
    expect(result.status).toBe("fail");
  });

  it("exit 2 is fail for pre-compact-save (should never exit 2)", () => {
    const result = classify(makeResult("pre-compact-save", 2));
    expect(result.status).toBe("fail");
  });

  it("exit 2 is fail for session-start (should never exit 2)", () => {
    const result = classify(makeResult("session-start", 2));
    expect(result.status).toBe("fail");
  });

  it("exit 2 is fail for session-end-all (should never exit 2)", () => {
    const result = classify(makeResult("session-end-all", 2));
    expect(result.status).toBe("fail");
  });

  // execFileSync error → fail
  it("execFileSync error → fail with unexpected status", () => {
    const result = classify(makeResult("observe-pre", -1, "ENOENT: script not found"));
    expect(result.status).toBe("fail");
    expect(result.reason).toContain("error");
  });

  // reason is always present
  it("classify always returns a non-empty reason", () => {
    const cases = [
      makeResult("observe-pre", 0),
      makeResult("no-context-guard", 2),
      makeResult("observe-pre", 2),
      makeResult("git-push-reminder", 1),
    ];
    for (const c of cases) {
      const r = classify(c);
      expect(typeof r.reason).toBe("string");
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. reportTable
// ---------------------------------------------------------------------------
describe("reportTable", () => {
  function makePassResult(name: string): HookResult {
    return {
      hook: { name, script: `.claude/hooks/scripts/${name}.js`, event: "PreToolUse", matcher: "Bash" },
      exitCode: 0,
      stderr: "",
      stdout: "",
      durationMs: 12,
    };
  }

  function makeFailResult(name: string): HookResult {
    return {
      hook: { name, script: `.claude/hooks/scripts/${name}.js`, event: "PostToolUse", matcher: "" },
      exitCode: 2,
      stderr: "something wrong",
      stdout: "",
      durationMs: 30,
    };
  }

  it("output contains the header row", () => {
    const output = reportTable([makePassResult("observe-pre")]);
    expect(output).toMatch(/hook/i);
    expect(output).toMatch(/event/i);
    expect(output).toMatch(/exit/i);
    expect(output).toMatch(/status/i);
  });

  it("output contains hook names", () => {
    const output = reportTable([makePassResult("observe-pre"), makeFailResult("observe-post")]);
    expect(output).toContain("observe-pre");
    expect(output).toContain("observe-post");
  });

  it("output contains pass count and fail count in summary", () => {
    const results = [makePassResult("block-no-verify"), makeFailResult("observe-pre")];
    const output = reportTable(results);
    expect(output).toContain("1");    // at least one pass
    expect(output).toMatch(/pass/i);
    expect(output).toMatch(/fail/i);
  });

  it("output shows pass indicator for passing hooks", () => {
    const output = reportTable([makePassResult("block-no-verify")]);
    // Should contain some pass indicator (checkmark or 'pass')
    expect(output).toMatch(/pass|✓|PASS/);
  });

  it("output shows fail indicator for failing hooks", () => {
    const output = reportTable([makeFailResult("observe-pre")]);
    expect(output).toMatch(/fail|✗|FAIL/);
  });

  it("output contains exit code values", () => {
    const output = reportTable([makePassResult("block-no-verify"), makeFailResult("observe-pre")]);
    expect(output).toContain("0");   // exit code 0
    expect(output).toContain("2");   // exit code 2
  });

  it("output contains duration in ms", () => {
    const output = reportTable([makePassResult("block-no-verify")]);
    expect(output).toContain("12");  // durationMs
  });

  it("summary line mentions total count", () => {
    const results = [makePassResult("a"), makePassResult("b"), makeFailResult("c")];
    const output = reportTable(results);
    expect(output).toContain("3");
  });
});
