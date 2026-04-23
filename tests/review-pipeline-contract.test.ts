import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const KODY = readFileSync(join(ROOT, ".claude/agents/kody.md"), "utf8");
const CHEKPOINT = readFileSync(
  join(ROOT, ".claude/commands/chekpoint.md"),
  "utf8",
);
const AGENTS_RULE = readFileSync(
  join(ROOT, ".claude/rules/common/agents.md"),
  "utf8",
);

describe("chekpoint review pipeline contract — kody cannot silently drop upstream BLOCKs", () => {
  it("kody.md declares Upstream BLOCK Preservation with all four clauses", () => {
    expect(KODY).toMatch(/## Upstream BLOCK Preservation/);
    expect(KODY).toMatch(/MAY consolidate/i);
    expect(KODY).toMatch(/MAY escalate/i);
    expect(KODY).toMatch(/MUST NOT downgrade/i);
    expect(KODY).toMatch(/MUST NOT suppress/i);
  });

  it("kody.md pins the confidence filter to own findings, not upstream", () => {
    expect(KODY).toMatch(
      /80% confidence filter.*applies to kody's own review findings, never to findings received from upstream specialists/i,
    );
  });

  it("chekpoint.md Phase 2b references the preservation rule", () => {
    expect(CHEKPOINT).toMatch(/Upstream BLOCK Preservation/);
    expect(CHEKPOINT).toMatch(/MUST NOT downgrade or suppress/i);
  });

  it("chekpoint.md Phase 3 specifies the dual gate", () => {
    expect(CHEKPOINT).toMatch(/Gate Decision \(dual check\)/);
    expect(CHEKPOINT).toMatch(/rawBlocks/);
    expect(CHEKPOINT).toMatch(/kodyBlocks/);
    expect(CHEKPOINT).toMatch(
      /kody consolidated N BLOCKs → M BLOCKs; verify deduplication was correct/,
    );
  });

  it("rules/common/agents.md documents the rule at catalog level", () => {
    expect(AGENTS_RULE).toMatch(/never downgrade an upstream BLOCK/i);
    expect(AGENTS_RULE).toMatch(/dual check/i);
  });
});
