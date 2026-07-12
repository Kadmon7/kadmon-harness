import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Direct ESM import — wasTruncated and isDisabled are pure functions with no
// stdin dependency, so we can import and call them directly in-process.
const { wasTruncated, isDisabled } = (await import(
  path.resolve(".claude/hooks/scripts/parse-stdin.js")
)) as {
  wasTruncated: (input: unknown) => boolean;
  isDisabled: (hookName: string) => boolean;
};

const PARSE_STDIN_MODULE = pathToFileURL(
  path.resolve(".claude/hooks/scripts/parse-stdin.js"),
).href;

/**
 * parseStdin() reads from fd 0 (real stdin), so it cannot be called
 * in-process against an arbitrary string the way wasTruncated/isDisabled
 * are above. Spawn a minimal child script (same pattern as the hook tests'
 * execFileSync harness) that imports the module, calls parseStdin() against
 * the piped input, and reports back which own keys survived.
 */
function runParseStdin(rawStdin: string): {
  hasProto: boolean;
  hasConstructor: boolean;
  hasPrototype: boolean;
  keys: string[];
  sessionId: unknown;
} {
  const script = [
    `import { parseStdin } from "${PARSE_STDIN_MODULE}";`,
    "const parsed = parseStdin();",
    "console.log(JSON.stringify({",
    '  hasProto: Object.prototype.hasOwnProperty.call(parsed, "__proto__"),',
    '  hasConstructor: Object.prototype.hasOwnProperty.call(parsed, "constructor"),',
    '  hasPrototype: Object.prototype.hasOwnProperty.call(parsed, "prototype"),',
    "  keys: Object.keys(parsed),",
    "  sessionId: parsed.session_id,",
    "}));",
  ].join("\n");
  const stdout = execFileSync("node", ["--input-type=module", "-e", script], {
    encoding: "utf8",
    input: rawStdin,
    stdio: ["pipe", "pipe", "pipe"],
  });
  return JSON.parse(stdout.trim());
}

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

// ---------------------------------------------------------------------------
// parseStdin — prototype pollution guard (AUD-15, 2026-07-12 audit)
//
// parse-stdin.js is the single shared chokepoint every hook (22) routes
// stdin through. JSON.parse() itself does not pollute Object.prototype (a
// "__proto__" key in the source becomes a normal own data property, not the
// accessor), but the object it returns must never carry an OWN "__proto__" /
// "constructor" / "prototype" key onward — a future consumer that does
// Object.assign(target, parsed) or a naive `for (k in parsed) target[k] =
// parsed[k]` merge WOULD trigger the real prototype setter for those own
// property values. Currently latent (no consumer deep-merges stdin today)
// but this is the one place to close it for every hook at once.
// ---------------------------------------------------------------------------

describe("parseStdin — prototype pollution guard", () => {
  it("strips __proto__, constructor, and prototype own keys from the parsed result", () => {
    // Hand-written JSON string, NOT JSON.stringify(objectLiteral) — a
    // `{ __proto__: ... }` object LITERAL sets the actual prototype at parse
    // time (special syntax) rather than creating an own "__proto__" key, so
    // JSON.stringify would silently drop it before it ever reached
    // parseStdin(). A raw JSON string with a quoted "__proto__" key is the
    // only way to reproduce what a real attacker-controlled stdin payload
    // looks like.
    const raw =
      '{"__proto__":{"polluted":true},"session_id":"abc123","constructor":{"x":1},"prototype":{"y":2}}';
    const result = runParseStdin(raw);
    expect(result.hasProto).toBe(false);
    expect(result.hasConstructor).toBe(false);
    expect(result.hasPrototype).toBe(false);
    expect(result.keys).toEqual(["session_id"]);
  });

  it("leaves legitimate fields untouched", () => {
    const raw = JSON.stringify({
      session_id: "abc123",
      tool_name: "Read",
      tool_input: { file_path: "src/index.ts" },
    });
    const result = runParseStdin(raw);
    expect(result.sessionId).toBe("abc123");
    expect(result.keys.sort()).toEqual(
      ["session_id", "tool_name", "tool_input"].sort(),
    );
  });

  it("is a no-op when none of the dangerous keys are present", () => {
    const raw = JSON.stringify({ session_id: "abc123", tool_name: "Bash" });
    const result = runParseStdin(raw);
    expect(result.keys.sort()).toEqual(["session_id", "tool_name"].sort());
  });

  it("strips a dangerous key even when it is the only key present", () => {
    // Hand-written JSON — see comment above on why JSON.stringify() of an
    // object literal cannot produce this input.
    const raw = '{"__proto__":{"polluted":true}}';
    const result = runParseStdin(raw);
    expect(result.hasProto).toBe(false);
    expect(result.keys).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// parseStdin — non-object top-level JSON (ts-reviewer WARN, chekpoint Wave 2)
//
// A literal `null` is valid JSON (4 raw bytes). JSON.parse("null") returns
// `null`, and stripDangerousKeys(null) then calls
// Object.prototype.hasOwnProperty.call(null, key) — which throws
// "Cannot convert undefined or null to object" because null cannot be
// ToObject()-coerced (unlike primitives such as 42/"x"/false, which DO
// autobox safely through .call() and do not throw). parseStdin() is the
// shared chokepoint every hook routes through, so it must not crash on any
// of the 6 top-level JSON value shapes. The fix normalizes every non-object
// (and null) top-level value to {} so callers doing `input.tool_input?.x`
// (no optional chaining on `input` itself) never dereference null/undefined.
// ---------------------------------------------------------------------------

function runParseStdinCallerStyle(rawStdin: string): {
  threw: boolean;
  errorMessage: string | null;
  toolInputFilePath: unknown;
  sessionId: unknown;
  typeofResult: string;
} {
  const script = [
    `import { parseStdin } from "${PARSE_STDIN_MODULE}";`,
    "try {",
    "  const parsed = parseStdin();",
    "  console.log(JSON.stringify({",
    "    threw: false,",
    "    errorMessage: null,",
    "    toolInputFilePath: parsed.tool_input?.file_path ?? null,",
    "    sessionId: parsed.session_id ?? null,",
    "    typeofResult: typeof parsed,",
    "  }));",
    "} catch (e) {",
    "  console.log(JSON.stringify({",
    "    threw: true,",
    "    errorMessage: e instanceof Error ? e.message : String(e),",
    "    toolInputFilePath: null,",
    "    sessionId: null,",
    "    typeofResult: 'unknown',",
    "  }));",
    "}",
  ].join("\n");
  const stdout = execFileSync("node", ["--input-type=module", "-e", script], {
    encoding: "utf8",
    input: rawStdin,
    stdio: ["pipe", "pipe", "pipe"],
  });
  return JSON.parse(stdout.trim());
}

describe("parseStdin — non-object top-level JSON", () => {
  it("does not throw when stdin is the literal JSON value null (the actual crash)", () => {
    const result = runParseStdinCallerStyle("null");
    expect(result.threw).toBe(false);
    expect(result.typeofResult).toBe("object");
    expect(result.toolInputFilePath).toBeNull();
    expect(result.sessionId).toBeNull();
  });

  it("normalizes a bare JSON number to {} so callers stay safe", () => {
    const result = runParseStdinCallerStyle("42");
    expect(result.threw).toBe(false);
    expect(result.typeofResult).toBe("object");
    expect(result.toolInputFilePath).toBeNull();
  });

  it("normalizes a bare JSON string to {} so callers stay safe", () => {
    const result = runParseStdinCallerStyle('"hello"');
    expect(result.threw).toBe(false);
    expect(result.typeofResult).toBe("object");
    expect(result.toolInputFilePath).toBeNull();
  });

  it("normalizes a bare JSON boolean to {} so callers stay safe", () => {
    const result = runParseStdinCallerStyle("false");
    expect(result.threw).toBe(false);
    expect(result.typeofResult).toBe("object");
    expect(result.toolInputFilePath).toBeNull();
  });
});
