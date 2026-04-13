import { describe, it, expect } from "vitest";
import { resolveAliasCommand } from "../../scripts/lib/forge-alias.js";

describe("forge-alias resolver", () => {
  it("T15a: bare /instinct → /forge --dry-run with deprecation warning", () => {
    const result = resolveAliasCommand("/instinct");
    expect(result.target).toBe("/forge --dry-run");
    expect(result.warn).toMatch(/deprecated/i);
    expect(result.warn).toContain("/forge");
    expect(result.warn).toContain("2026-04-20");
  });

  it("T15b: /instinct status → /forge --dry-run", () => {
    const result = resolveAliasCommand("/instinct status");
    expect(result.target).toBe("/forge --dry-run");
  });

  it("T15c: /instinct eval → /forge --dry-run", () => {
    const result = resolveAliasCommand("/instinct eval");
    expect(result.target).toBe("/forge --dry-run");
  });

  it("T15d: /instinct learn → /forge", () => {
    const result = resolveAliasCommand("/instinct learn");
    expect(result.target).toBe("/forge");
  });

  it("T15e: /instinct promote → /forge", () => {
    const result = resolveAliasCommand("/instinct promote");
    expect(result.target).toBe("/forge");
  });

  it("T15f: /instinct prune → /forge", () => {
    const result = resolveAliasCommand("/instinct prune");
    expect(result.target).toBe("/forge");
  });

  it("T15g: /instinct export → /forge export", () => {
    const result = resolveAliasCommand("/instinct export");
    expect(result.target).toBe("/forge export");
  });

  it("all resolver outputs include removal date 2026-04-20 in the warning", () => {
    const inputs = [
      "/instinct",
      "/instinct status",
      "/instinct eval",
      "/instinct learn",
      "/instinct promote",
      "/instinct prune",
      "/instinct export",
    ];
    for (const input of inputs) {
      const result = resolveAliasCommand(input);
      expect(result.warn).toContain("2026-04-20");
      expect(result.warn).toMatch(/\/forge/);
    }
  });

  it("unknown /instinct subcommand falls back to /forge with warning", () => {
    const result = resolveAliasCommand("/instinct unknown-sub");
    expect(result.target).toBe("/forge");
    expect(result.warn).toMatch(/deprecated/i);
  });

  it("handles extra whitespace gracefully", () => {
    const result = resolveAliasCommand("  /instinct   learn  ");
    expect(result.target).toBe("/forge");
  });

  it("is case-insensitive for the subcommand", () => {
    const result = resolveAliasCommand("/instinct STATUS");
    expect(result.target).toBe("/forge --dry-run");
  });
});
