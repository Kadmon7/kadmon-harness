import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

const HOOK = path.resolve(".claude/hooks/scripts/commit-format-guard.js");

function runHook(input: object): { code: number; stderr: string } {
  try {
    execFileSync("node", [HOOK], {
      encoding: "utf8",
      input: JSON.stringify(input),
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { code: 0, stderr: "" };
  } catch (err: unknown) {
    const e = err as { status: number; stderr: string };
    return { code: e.status ?? 1, stderr: e.stderr ?? "" };
  }
}

describe("commit-format-guard", () => {
  it("allows non-git-commit commands", () => {
    const r = runHook({ tool_input: { command: "npm test" } });
    expect(r.code).toBe(0);
  });

  it("allows valid conventional commit", () => {
    const r = runHook({
      tool_input: { command: 'git commit -m "feat: add dashboard"' },
    });
    expect(r.code).toBe(0);
  });

  it("allows conventional commit with scope", () => {
    const r = runHook({
      tool_input: { command: 'git commit -m "fix(hooks): resolve path issue"' },
    });
    expect(r.code).toBe(0);
  });

  it("allows commit with HEREDOC format", () => {
    const r = runHook({
      tool_input: {
        command:
          "git commit -m \"$(cat <<'EOF'\nfeat(dashboard): add cost section\n\nCo-Authored-By: Claude\nEOF\n)\"",
      },
    });
    expect(r.code).toBe(0);
  });

  it("allows HEREDOC with multi-line body and Co-Authored-By", () => {
    const r = runHook({
      tool_input: {
        command:
          "git commit -m \"$(cat <<'EOF'\\nfeat(kplan): smart routing — architect+planner based on signals\\n\\nCo-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>\\nEOF\\n)\"",
      },
    });
    expect(r.code).toBe(0);
  });

  it("blocks bad HEREDOC commit message", () => {
    const r = runHook({
      tool_input: {
        command: "git commit -m \"$(cat <<'EOF'\\nbad message here\\nEOF\\n)\"",
      },
    });
    expect(r.code).toBe(2);
  });

  it("blocks non-conventional commit message", () => {
    const r = runHook({
      tool_input: { command: 'git commit -m "updated stuff"' },
    });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("conventional commit");
  });

  it("blocks commit with capital type", () => {
    const r = runHook({
      tool_input: { command: 'git commit -m "Feat: add thing"' },
    });
    expect(r.code).toBe(2);
  });

  it("allows git commit --amend (no message to validate)", () => {
    const r = runHook({
      tool_input: { command: "git commit --amend" },
    });
    expect(r.code).toBe(0);
  });

  it("exits 0 on missing input", () => {
    const r = runHook({});
    expect(r.code).toBe(0);
  });
});
