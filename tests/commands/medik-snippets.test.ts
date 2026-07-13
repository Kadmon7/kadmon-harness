// TDD [feniks]
// AUD-30 item 3 (2026-07-13): .claude/commands/medik.md embeds `tsx -e "..."`
// / `node -e "..."` one-liners that run /medik's health checks directly from
// the command doc. Nothing previously verified those embedded snippets stay
// syntactically valid as the doc evolves — a stray edit inside the markdown
// could silently ship broken JS with no signal until someone runs /medik.
//
// Full extraction + dry-run (actually executing each snippet against a real
// $RUNTIME_ROOT/$CONSUMER_CWD) is too brittle for this test tier — the
// snippets read argv positions that only make sense wired up by the Bash
// runtime in medik.md itself. Instead this test extracts every embedded
// `-e "..."` snippet and syntax-checks it with `node --check` (parse-only,
// no execution, no argv dependency) so drift is caught mechanically.
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const MEDIK_MD = path.resolve(".claude/commands/medik.md");

/**
 * Extracts the JS body of every `npx tsx -e "..."` / `node -e "..."`
 * invocation in the markdown source. Safe to use a simple `[^"]*` capture
 * here because none of medik.md's embedded snippets contain an escaped or
 * nested double quote (verified: the snippets are written with only single
 * quotes internally) — a more general shell-quote parser would be overkill
 * for a fixed, hand-authored doc.
 */
function extractInlineSnippets(markdown: string): string[] {
  const re = /(?:npx tsx|node) -e "([^"]*)"/g;
  const snippets: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    snippets.push(match[1]);
  }
  return snippets;
}

describe("medik.md embedded snippets", () => {
  const tempFiles: string[] = [];

  afterEach(() => {
    for (const f of tempFiles.splice(0)) {
      fs.rmSync(f, { force: true });
    }
  });

  it("documents that embedded -e snippets are smoke-tested for syntax drift", () => {
    const markdown = fs.readFileSync(MEDIK_MD, "utf8");
    expect(markdown).toMatch(/smoke-test/i);
  });

  it("finds the expected embedded tsx/node -e snippet markers (extraction sanity check)", () => {
    const markdown = fs.readFileSync(MEDIK_MD, "utf8");
    const snippets = extractInlineSnippets(markdown);
    // 6 embedded -e snippets as of AUD-30: ALV report, profile banner,
    // language detect, test-runner detect, install-health (#9), agent
    // frontmatter guard (#8). A future edit may add/remove one — the floor
    // here just guards against the extraction regex silently finding zero.
    expect(snippets.length).toBeGreaterThanOrEqual(5);
  });

  it("every embedded tsx/node -e snippet is syntactically valid JavaScript", () => {
    const markdown = fs.readFileSync(MEDIK_MD, "utf8");
    const snippets = extractInlineSnippets(markdown);
    expect(snippets.length).toBeGreaterThan(0);

    for (const [i, snippet] of snippets.entries()) {
      const file = path.join(os.tmpdir(), `medik-snippet-${Date.now()}-${i}.js`);
      fs.writeFileSync(file, snippet, "utf8");
      tempFiles.push(file);
      expect(() =>
        execFileSync("node", ["--check", file], { stdio: "pipe" }),
      ).not.toThrow();
    }
  });

  it("flags a deliberately broken snippet as a syntax error (extraction+check contract sanity)", () => {
    const broken = "const x = ;";
    const file = path.join(os.tmpdir(), `medik-snippet-broken-${Date.now()}.js`);
    fs.writeFileSync(file, broken, "utf8");
    tempFiles.push(file);

    expect(() => execFileSync("node", ["--check", file], { stdio: "pipe" })).toThrow();
  });
});
