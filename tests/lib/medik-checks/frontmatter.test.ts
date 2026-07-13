// TDD [feniks] — shared frontmatter status parser (plan-038 Step 2.1)
import { describe, it, expect } from "vitest";
import { parseFrontmatterStatus } from "../../../scripts/lib/medik-checks/frontmatter.js";

describe("parseFrontmatterStatus", () => {
  it("extracts and lowercases the status value", () => {
    const content = `---\nstatus: In_Progress\ndate: 2026-07-13\n---\n# Test\n`;

    const result = parseFrontmatterStatus(content);

    expect(result).toBe("in_progress");
  });

  it("returns null when no status: line is present", () => {
    const content = `---\ndate: 2026-07-13\n---\n# Test\n`;

    const result = parseFrontmatterStatus(content);

    expect(result).toBeNull();
  });

  it("does not match a superseded_by: line (anchor is ^status: only)", () => {
    const content = `---\nsuperseded_by: ADR-011\n---\n# Test\n`;

    const result = parseFrontmatterStatus(content);

    expect(result).toBeNull();
  });

  it("matches a real status: line even when a superseded_by: line is also present", () => {
    const content = `---\nstatus: superseded\nsuperseded_by: ADR-011\n---\n# Test\n`;

    const result = parseFrontmatterStatus(content);

    expect(result).toBe("superseded");
  });

  it("returns null for empty string input", () => {
    const result = parseFrontmatterStatus("");

    expect(result).toBeNull();
  });
});
