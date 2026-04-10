import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";

// Direct ESM import — wasTruncated and isDisabled are pure functions with no
// stdin dependency, so we can import and call them directly in-process.
const { wasTruncated, isDisabled } = (await import(
  path.resolve(".claude/hooks/scripts/parse-stdin.js")
)) as {
  wasTruncated: (input: unknown) => boolean;
  isDisabled: (hookName: string) => boolean;
};

// Restore KADMON_DISABLED_HOOKS after each test that mutates it
const originalDisabledHooks = process.env.KADMON_DISABLED_HOOKS;
afterEach(() => {
  if (originalDisabledHooks === undefined) {
    delete process.env.KADMON_DISABLED_HOOKS;
  } else {
    process.env.KADMON_DISABLED_HOOKS = originalDisabledHooks;
  }
});

// ---------------------------------------------------------------------------
// wasTruncated
// ---------------------------------------------------------------------------

describe("wasTruncated", () => {
  it("returns true when _truncated is strictly true", () => {
    expect(wasTruncated({ _truncated: true })).toBe(true);
  });

  it("returns false when _truncated is absent", () => {
    expect(wasTruncated({ tool_name: "Bash" })).toBe(false);
  });

  it("returns false when _truncated is false", () => {
    expect(wasTruncated({ _truncated: false })).toBe(false);
  });

  it("returns false for null input (optional chaining guard)", () => {
    expect(wasTruncated(null)).toBe(false);
  });

  it("returns false for undefined input (optional chaining guard)", () => {
    expect(wasTruncated(undefined)).toBe(false);
  });

  it("returns false when _truncated is a truthy non-boolean value", () => {
    // Strict === true check means "1" or 1 must not qualify
    expect(wasTruncated({ _truncated: 1 })).toBe(false);
    expect(wasTruncated({ _truncated: "true" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isDisabled — NEVER_DISABLE set
// ---------------------------------------------------------------------------

describe("isDisabled — security-critical hooks (NEVER_DISABLE)", () => {
  it("returns false for 'block-no-verify' even when listed in KADMON_DISABLED_HOOKS", () => {
    process.env.KADMON_DISABLED_HOOKS = "block-no-verify";
    expect(isDisabled("block-no-verify")).toBe(false);
  });

  it("returns false for 'config-protection' even when listed in KADMON_DISABLED_HOOKS", () => {
    process.env.KADMON_DISABLED_HOOKS = "config-protection";
    expect(isDisabled("config-protection")).toBe(false);
  });

  it("returns false for 'commit-quality' even when listed in KADMON_DISABLED_HOOKS", () => {
    process.env.KADMON_DISABLED_HOOKS = "commit-quality";
    expect(isDisabled("commit-quality")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isDisabled — non-critical hooks
// ---------------------------------------------------------------------------

describe("isDisabled — non-critical hooks", () => {
  it("returns true when hook name is present in KADMON_DISABLED_HOOKS", () => {
    process.env.KADMON_DISABLED_HOOKS = "git-push-reminder";
    expect(isDisabled("git-push-reminder")).toBe(true);
  });

  it("returns false when hook name is NOT in KADMON_DISABLED_HOOKS", () => {
    process.env.KADMON_DISABLED_HOOKS = "some-other-hook";
    expect(isDisabled("git-push-reminder")).toBe(false);
  });

  it("returns false when KADMON_DISABLED_HOOKS is empty string", () => {
    process.env.KADMON_DISABLED_HOOKS = "";
    expect(isDisabled("git-push-reminder")).toBe(false);
  });

  it("returns false when KADMON_DISABLED_HOOKS is undefined", () => {
    delete process.env.KADMON_DISABLED_HOOKS;
    expect(isDisabled("git-push-reminder")).toBe(false);
  });

  it("returns true when hook is one of several comma-separated entries", () => {
    process.env.KADMON_DISABLED_HOOKS =
      "post-edit-typecheck,git-push-reminder,quality-gate";
    expect(isDisabled("git-push-reminder")).toBe(true);
  });

  it("trims whitespace around comma-separated entries", () => {
    process.env.KADMON_DISABLED_HOOKS =
      " post-edit-typecheck , git-push-reminder ";
    expect(isDisabled("git-push-reminder")).toBe(true);
  });

  it("returns false for unknown hook name when env is unset", () => {
    delete process.env.KADMON_DISABLED_HOOKS;
    expect(isDisabled("nonexistent-hook")).toBe(false);
  });
});
