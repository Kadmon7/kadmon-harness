import { describe, it, expect } from "vitest";
import path from "node:path";

// Direct ESM import — pure function, no stdin/fs dependency needed to test
// the redaction contract itself (AUD-30 item 1: scrubSecrets() must not run
// full regex passes over a pathologically long string — cap the input so the
// <50ms observe hook latency budget holds even on adversarial Bash commands).
const { scrubSecrets, MAX_SCRUB_INPUT_LENGTH, TRUNCATION_MARKER } = (await import(
  path.resolve(".claude/hooks/scripts/scrub-secrets.js")
)) as {
  scrubSecrets: (str: string) => string;
  MAX_SCRUB_INPUT_LENGTH: number;
  TRUNCATION_MARKER: string;
};

describe("scrubSecrets", () => {
  it("scrubs a short input exactly as before — untouched by the length cap", () => {
    const token = "sk-ant-api03-abcdefghij1234567890ABCDEFGHIJ";
    const input = `curl -H "Authorization: Bearer ${token}"`;

    const result = scrubSecrets(input);

    expect(result).not.toContain(token);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain(TRUNCATION_MARKER);
  });

  it("scrubs multiple known credential shapes identically to before the cap", () => {
    const input = "ghp_" + "a".repeat(36) + " AKIA" + "B".repeat(16);

    const result = scrubSecrets(input);

    expect(result).not.toMatch(/ghp_[A-Za-z0-9]{36,}/);
    expect(result).not.toMatch(/AKIA[0-9A-Z]{16}/);
    expect(result).toContain("[REDACTED]");
  });

  it("caps a pathologically long input and still scrubs a secret located in the head", () => {
    const token = "sk-ant-api03-abcdefghij1234567890ABCDEFGHIJ";
    const input = `Authorization: ${token} ` + "x".repeat(MAX_SCRUB_INPUT_LENGTH * 2);

    const result = scrubSecrets(input);

    expect(result).not.toContain(token);
    expect(result.endsWith(TRUNCATION_MARKER)).toBe(true);
    expect(result.length).toBeLessThan(input.length);
    expect(result.length).toBeLessThanOrEqual(
      MAX_SCRUB_INPUT_LENGTH + TRUNCATION_MARKER.length,
    );
  });

  it("never lets a secret placed past the cap survive in the output", () => {
    const token = "sk-ant-api03-zzzzzzzzzz9876543210ZZZZZZZZZZ";
    const padding = "x".repeat(MAX_SCRUB_INPUT_LENGTH + 1000);
    const input = padding + token; // secret starts well past the cap boundary

    const result = scrubSecrets(input);

    expect(result).not.toContain(token);
    expect(result.endsWith(TRUNCATION_MARKER)).toBe(true);
  });

  it("does not append the truncation marker for input exactly at the cap boundary", () => {
    const input = "x".repeat(MAX_SCRUB_INPUT_LENGTH);

    const result = scrubSecrets(input);

    expect(result).not.toContain(TRUNCATION_MARKER);
    expect(result.length).toBe(MAX_SCRUB_INPUT_LENGTH);
  });

  it("handles the empty string without truncation", () => {
    expect(scrubSecrets("")).toBe("");
  });
});
