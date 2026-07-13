// Kadmon Harness — shared frontmatter `status:` parser (plan-038 Step 2.1)
// Extracted from stale-plans.ts so /medik checks #10 and #15 share one
// regex + lowercasing contract instead of drifting apart (ADR-038 Alt 3).

const STATUS_RE = /^status:\s*(\w+)/m;

export function parseFrontmatterStatus(content: string): string | null {
  const match = STATUS_RE.exec(content);
  if (!match) return null;
  return match[1].toLowerCase();
}
