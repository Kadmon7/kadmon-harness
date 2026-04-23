import { describe, it, expect } from "vitest";
import { renderRemediationBanner } from "../../scripts/lib/install-remediation.js";
import type { SymlinkStatus } from "../../scripts/lib/install-health.js";

function issue(
  name: SymlinkStatus["name"],
  state: SymlinkStatus["state"],
  overrides: Partial<SymlinkStatus> = {},
): SymlinkStatus {
  return {
    name,
    path: `/fake/root/${name}`,
    state,
    target: null,
    fileSize: null,
    ...overrides,
  };
}

describe("renderRemediationBanner", () => {
  it("returns empty string when issues is empty", () => {
    const banner = renderRemediationBanner([], {
      inPluginCache: false,
      platform: "linux",
    });
    expect(banner).toBe("");
  });

  it("includes WARNING header when issues are present", () => {
    const banner = renderRemediationBanner(
      [issue("agents", "text_file", { fileSize: 14 })],
      { inPluginCache: false, platform: "win32" },
    );
    expect(banner).toContain("WARNING");
    expect(banner).toContain("install");
  });

  it("lists each broken symlink by name and state", () => {
    const banner = renderRemediationBanner(
      [
        issue("agents", "text_file", { fileSize: 14 }),
        issue("skills", "text_file", { fileSize: 14 }),
        issue("commands", "missing"),
      ],
      { inPluginCache: false, platform: "win32" },
    );
    expect(banner).toContain("agents");
    expect(banner).toContain("skills");
    expect(banner).toContain("commands");
    expect(banner).toContain("text_file");
    expect(banner).toContain("missing");
  });

  it("renders PowerShell remediation when inPluginCache=true", () => {
    const banner = renderRemediationBanner(
      [issue("agents", "text_file", { fileSize: 14 })],
      { inPluginCache: true, platform: "win32" },
    );
    expect(banner).toContain("New-Item -ItemType SymbolicLink");
    expect(banner).not.toContain("git checkout");
  });

  it("renders git checkout remediation when inPluginCache=false", () => {
    const banner = renderRemediationBanner(
      [issue("agents", "text_file", { fileSize: 14 })],
      { inPluginCache: false, platform: "win32" },
    );
    expect(banner).toContain("git checkout");
    expect(banner).toContain("MSYS=winsymlinks:nativestrict");
    expect(banner).not.toContain("New-Item -ItemType SymbolicLink");
  });

  it("references the diagnostic log location", () => {
    const banner = renderRemediationBanner(
      [issue("agents", "text_file", { fileSize: 14 })],
      { inPluginCache: false, platform: "linux" },
    );
    expect(banner).toContain("install-diagnostic.log");
  });

  it("references the troubleshooting doc", () => {
    const banner = renderRemediationBanner(
      [issue("agents", "text_file", { fileSize: 14 })],
      { inPluginCache: false, platform: "linux" },
    );
    expect(banner).toContain("TROUBLESHOOTING");
  });

  it("filters out symlink_ok and junction_ok entries (no false positives)", () => {
    const banner = renderRemediationBanner(
      [
        issue("agents", "symlink_ok"),
        issue("skills", "junction_ok"),
        issue("commands", "symlink_ok"),
      ],
      { inPluginCache: false, platform: "linux" },
    );
    expect(banner).toBe("");
  });

  it("only lists actionable anomalies in the issues section (healthy ones omitted from the list)", () => {
    const banner = renderRemediationBanner(
      [
        issue("agents", "symlink_ok"),
        issue("skills", "text_file", { fileSize: 16 }),
        issue("commands", "junction_ok"),
      ],
      { inPluginCache: false, platform: "linux" },
    );
    const issuesSection = banner
      .split("\n")
      .filter((line) => line.trimStart().startsWith("- "))
      .join("\n");
    expect(issuesSection).toContain("skills");
    expect(issuesSection).not.toContain("agents");
    expect(issuesSection).not.toContain("commands");
  });
});
