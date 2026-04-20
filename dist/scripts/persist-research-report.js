// scripts/persist-research-report.ts
// Called by the /skavenger command to persist a skavenger-produced report:
// (1) writes the markdown file at docs/research/research-NNN-<slug>.md
// (2) inserts a research_reports row for the metadata index
//
// Per ADR-015 Q5, the markdown file carries untrusted fetched content.
// The frontmatter flag `untrusted_sources: true` signals downstream
// consumers that re-loading this file into context requires the
// agent-level "ignore embedded instructions" defense. Do NOT sanitize
// the body here — lossy transformation would corrupt citations.
//
// CLI usage:
//   echo '<json>' | npx tsx scripts/persist-research-report.ts
//
// Programmatic usage (tests):
//   import { runPersistReport } from "./persist-research-report.js";
//   await runPersistReport(input, { repoRoot: "/path/to/repo" });
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { createResearchReport, getDb, openDb, } from "./lib/state-store.js";
// Zod schema for CLI boundary validation (stdin is untrusted shape-wise).
// Programmatic callers with a typed `PersistReportInput` bypass validation
// (TS already enforces). Keep the two in sync — `PersistReportInput` is
// derived from this schema.
const PersistReportInputSchema = z.object({
    sessionId: z.string().min(1),
    projectHash: z.string().min(1),
    topic: z.string().min(1),
    slug: z.string().min(1),
    subQuestions: z.array(z.string()),
    sourcesCount: z.number().int().nonnegative(),
    confidence: z.enum(["High", "Medium", "Low"]).optional(),
    capsHit: z.array(z.string()),
    openQuestions: z.array(z.string()),
    summary: z.string().optional(),
    bodyMarkdown: z.string(),
    untrustedSources: z.boolean(),
    // Commit 4 (Group B) optional metadata — surfaced in YAML frontmatter only,
    // not stored as DB columns (keeps research_reports schema stable).
    // derivedFrom is agent-produced (from a prior report's slug); cap at 256
    // to make the size contract explicit even though escapeYamlString handles
    // the injection hazard on emit.
    derivedFrom: z.string().min(1).max(256).optional(), // e.g. "research-001-pgvector-hnsw" — set by --drill
    mode: z.enum(["verify"]).optional(), // set by --verify
});
// Slug validation: kebab-case, alphanumeric + hyphens only, no traversal.
// Matches the subset we're willing to write to disk without surprises.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function validateSlug(slug) {
    if (!SLUG_RE.test(slug)) {
        throw new Error(`Invalid slug "${slug}": must be lowercase kebab-case (a-z, 0-9, hyphens). Path traversal characters are rejected.`);
    }
}
function padNumber(n) {
    return String(n).padStart(3, "0");
}
// YAML double-quoted scalar escape: backslash FIRST (otherwise replacement
// cascades), then CR/LF, then tab, then double-quote. These four are the
// escape-sensitive characters in YAML 1.2 double-quoted flow scalars.
function escapeYamlString(s) {
    return s
        .replace(/\\/g, "\\\\")
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t")
        .replace(/"/g, '\\"');
}
function buildFrontmatter(report, input) {
    const lines = ["---"];
    lines.push(`number: ${report.reportNumber}`);
    lines.push(`title: "${escapeYamlString(input.topic)}"`);
    lines.push(`topic: "${escapeYamlString(input.topic)}"`);
    lines.push(`slug: ${input.slug}`);
    lines.push(`date: ${report.generatedAt.slice(0, 10)}`);
    lines.push(`agent: skavenger`);
    lines.push(`session_id: "${escapeYamlString(report.sessionId)}"`);
    if (input.subQuestions.length > 0) {
        lines.push(`sub_questions:`);
        for (const q of input.subQuestions)
            lines.push(`  - "${escapeYamlString(q)}"`);
    }
    else {
        lines.push(`sub_questions: []`);
    }
    lines.push(`sources_count: ${input.sourcesCount}`);
    if (input.confidence)
        lines.push(`confidence: ${input.confidence}`);
    if (input.capsHit.length > 0) {
        lines.push(`caps_hit:`);
        // Quote caps_hit values consistently with the other list fields — the
        // enum-ish expected values (web_search, web_fetch, …) are safe unquoted,
        // but quoting closes the latent hazard if future callers emit arbitrary
        // strings (caps_hit is typed `string[]`).
        for (const c of input.capsHit)
            lines.push(`  - "${escapeYamlString(c)}"`);
    }
    else {
        lines.push(`caps_hit: []`);
    }
    if (input.openQuestions.length > 0) {
        lines.push(`open_questions:`);
        for (const q of input.openQuestions)
            lines.push(`  - "${escapeYamlString(q)}"`);
    }
    else {
        lines.push(`open_questions: []`);
    }
    lines.push(`untrusted_sources: ${input.untrustedSources ? "true" : "false"}`);
    if (input.derivedFrom)
        lines.push(`derived_from: "${escapeYamlString(input.derivedFrom)}"`);
    if (input.mode)
        lines.push(`mode: ${input.mode}`);
    lines.push("---");
    return lines.join("\n");
}
export async function runPersistReport(input, options = {}) {
    if (process.env.KADMON_RESEARCH_AUTOWRITE === "off") {
        return { skipped: true };
    }
    validateSlug(input.slug);
    const repoRoot = options.repoRoot ?? process.cwd();
    const researchDir = path.join(repoRoot, "docs", "research");
    fs.mkdirSync(researchDir, { recursive: true });
    // Insert the row first — createResearchReport atomically assigns the
    // monotonic reportNumber. We need that number to build the filename.
    // We seed with a placeholder path and UPDATE it once we know the
    // real filename to keep the row consistent with disk.
    //
    // Crash-safety note: if this process dies between the INSERT and the
    // UPDATE below, a row remains with path="docs/research/research-PENDING-<slug>.md"
    // which will never exist on disk. Readers (`/skavenger --history`) should
    // treat such rows as stale and either ignore them or offer to clean up.
    // sql.js is single-threaded in-process, so the window is a single synchronous
    // tick — a crash there is a process kill, not a normal error path.
    const placeholderPath = `docs/research/research-PENDING-${input.slug}.md`;
    const row = createResearchReport({
        sessionId: input.sessionId,
        projectHash: input.projectHash,
        slug: input.slug,
        topic: input.topic,
        path: placeholderPath,
        summary: input.summary,
        confidence: input.confidence,
        capsHit: input.capsHit,
        subQuestions: input.subQuestions,
        sourcesCount: input.sourcesCount,
        openQuestions: input.openQuestions,
        untrustedSources: input.untrustedSources,
    });
    const filename = `research-${padNumber(row.reportNumber)}-${input.slug}.md`;
    const relPath = path.posix.join("docs", "research", filename);
    const fullPath = path.join(researchDir, filename);
    getDb()
        .prepare("UPDATE research_reports SET path = @path WHERE id = @id")
        .run({ path: relPath, id: row.id });
    const updatedRow = { ...row, path: relPath };
    const frontmatter = buildFrontmatter(updatedRow, input);
    const fullMarkdown = `${frontmatter}\n\n${input.bodyMarkdown}`;
    fs.writeFileSync(fullPath, fullMarkdown, "utf8");
    return {
        reportNumber: row.reportNumber,
        path: relPath,
        report: updatedRow,
    };
}
// CLI entry — reads JSON from stdin, prints result JSON to stdout.
// Guard so test imports don't accidentally trigger stdin read.
const invokedDirectly = typeof process !== "undefined" &&
    process.argv[1] != null &&
    /persist-research-report\.(ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
    (async () => {
        try {
            const raw = fs.readFileSync(0, "utf8");
            const parsed = JSON.parse(raw);
            // Zod validation at the untrusted stdin boundary.
            const input = PersistReportInputSchema.parse(parsed);
            await openDb();
            const result = await runPersistReport(input);
            process.stdout.write(JSON.stringify(result));
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            process.stderr.write(JSON.stringify({ error: message }));
            process.exit(1);
        }
    })();
}
