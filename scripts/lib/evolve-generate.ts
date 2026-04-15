// Kadmon Harness — Evolve generate pipeline (ADR-008, plan-008 Phase 2)
// Pure pipeline: reads ClusterReports, merges, emits GenerateProposal[].
// NEVER writes files or mutates DB — that is Phase 3 (applyEvolveGenerate).
//
// Reference: ADR-008 section 5, API shape lines 294-356
// Reference: plan-008-evolve-generate-pipeline.md Phase 2 (steps 2.1-2.5)

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  ClusterReport,
  Cluster,
  EvolutionCategory,
  EvolveGeneratePreview,
  GenerateProposal,
  ProposalType,
  Complexity,
  ProposalConfidence,
  SkillSpec,
  CommandSpec,
  AgentSpec,
  RuleSpec,
  ApplyApprovals,
  ApplyResult,
} from "./types.js";
import {
  readClusterReportsInWindow,
  mergeByInstinctId,
} from "./evolve-report-reader.js";
import { getActiveInstincts } from "./state-store.js";

// ─── Public interface ───

export interface EvolveGenerateOptions {
  projectHash: string;
  cwd: string;
  /** Defaults to ~/.kadmon/forge-reports */
  reportsDir?: string;
  /** Defaults to KADMON_EVOLVE_WINDOW_DAYS env or 7 */
  windowDays?: number;
  /** Test seam — defaults to new Date() */
  now?: Date;
}

// ─── Slug validation ───

/** Slug regex per ADR-008:63 */
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * Derives a slug from a cluster label.
 * Returns empty string if the result fails SLUG_REGEX — signals rejection.
 */
function deriveSlug(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // non-alphanum → dash
    .replace(/-+/g, "-")         // collapse consecutive dashes
    .replace(/^-+|-+$/g, "")     // trim leading/trailing dashes
    .slice(0, 64);

  if (!SLUG_REGEX.test(slug)) {
    return "";
  }
  return slug;
}

// ─── Category → ProposalType mapping ───

/**
 * Maps EvolutionCategory to ProposalType.
 * Returns null for categories that do not generate proposals (OPTIMIZE, CREATE_HOOK).
 */
function categoryToType(cat: EvolutionCategory): ProposalType | null {
  switch (cat) {
    case "PROMOTE":
      return "skill";
    case "CREATE_COMMAND":
      return "command";
    case "CREATE_AGENT":
      return "agent";
    case "CREATE_RULE":
      return "rule";
    case "CREATE_HOOK":
      return null; // deferred to Sprint B.1 (ADR-008 Q7)
    case "OPTIMIZE":
      return null; // alchemik Report-only domain, not a generatable artifact
  }
}

/** Directory names per ProposalType */
const typeToDir: Record<ProposalType, string> = {
  skill: "skills",
  command: "commands",
  agent: "agents",
  rule: "rules/common",
};

/**
 * Build the relative target path for a proposed artifact.
 *
 * ADR-013 — skills live at `.claude/skills/<slug>/SKILL.md` (subdirectory
 * + literal uppercase entrypoint, resolved by the native sub-agent
 * loader). Commands, agents, and rules remain flat `<slug>.md` files
 * (ADR-013 non-goals — these are resolved differently by Claude Code
 * and backward-compat is preserved).
 */
function buildTargetPath(type: ProposalType, slug: string): string {
  const joined =
    type === "skill"
      ? path.join(".claude", "skills", slug, "SKILL.md")
      : path.join(".claude", typeToDir[type], `${slug}.md`);
  return joined.replace(/\\/g, "/");
}

// ─── Complexity heuristic ───

/**
 * Heuristic for proposal complexity based on member count.
 * S = ≤ 2 members, M = 3-5, L = > 5.
 * Marked EXPERIMENTAL — heuristic to be refined in Sprint B.1.
 */
function deriveComplexity(memberCount: number): Complexity {
  if (memberCount <= 2) return "S";
  if (memberCount <= 5) return "M";
  return "L";
}

// ─── Confidence mapping ───

/**
 * Maps meanConfidence float to ProposalConfidence label.
 * HIGH ≥ 0.7, MED 0.5-0.7, LOW < 0.5.
 */
function deriveConfidence(meanConfidence: number): ProposalConfidence {
  if (meanConfidence >= 0.7) return "HIGH";
  if (meanConfidence >= 0.5) return "MED";
  return "LOW";
}

// ─── Confidence sort order ───

const CONFIDENCE_ORDER: Record<ProposalConfidence, number> = {
  HIGH: 0,
  MED: 1,
  LOW: 2,
};

const COMPLEXITY_ORDER: Record<Complexity, number> = {
  S: 0,
  M: 1,
  L: 2,
};

// ─── Spec builder ───

function buildSpec(
  type: ProposalType,
  cluster: Cluster,
): SkillSpec | CommandSpec | AgentSpec | RuleSpec {
  const sourceClusterIds = [cluster.id];

  switch (type) {
    case "skill": {
      const spec: SkillSpec = {
        kind: "skill",
        pattern: cluster.label,
        action: cluster.rationale,
        sourceClusterIds,
      };
      return spec;
    }
    case "command": {
      const spec: CommandSpec = {
        kind: "command",
        workflow: cluster.rationale,
        sourceClusterIds,
      };
      return spec;
    }
    case "agent": {
      const spec: AgentSpec = {
        kind: "agent",
        role: cluster.rationale,
        triggers: [cluster.label],
        model: "sonnet",
        sourceClusterIds,
      };
      return spec;
    }
    case "rule": {
      const spec: RuleSpec = {
        kind: "rule",
        scope: "common",
        category: cluster.domain ?? "common",
        sourceClusterIds,
      };
      return spec;
    }
  }
}

// ─── Default reports directory ───

function defaultReportsDir(): string {
  return path.join(os.homedir(), ".kadmon", "forge-reports");
}

// ─── Cap constant ───

const MAX_PROPOSALS = 10;

// ─── Main pure pipeline ───

/**
 * Reads ClusterReports from `reportsDir`, filters by `projectHash` and time
 * window, merges clusters, and emits GenerateProposal[].
 *
 * PURE — never writes files or mutates the database.
 */
export async function runEvolveGenerate(
  opts: EvolveGenerateOptions,
): Promise<EvolveGeneratePreview> {
  const reportsDir = opts.reportsDir ?? defaultReportsDir();
  const now = opts.now ?? new Date();

  // Step 1: Read reports in window filtered by projectHash
  const reports = readClusterReportsInWindow({
    baseDir: reportsDir,
    projectHash: opts.projectHash,
    windowDays: opts.windowDays,
    now,
  });

  // Compute source window for preview output
  const sourceWindow = computeSourceWindow(reports, now);

  if (reports.length === 0) {
    return {
      proposals: [],
      sourceReportCount: 0,
      sourceWindow,
      deferredHookCount: 0,
      skipped: "no-reports-in-window",
    };
  }

  // Step 2: Merge clusters by instinctId
  const merged = mergeByInstinctId(reports);

  // Step 3: Load live instincts for stale-id filtering
  const liveInstincts = getActiveInstincts(opts.projectHash);
  const liveIds = new Set(liveInstincts.map((i) => i.id));

  // Step 4: Walk clusters and derive proposals
  const proposals: GenerateProposal[] = [];
  const staleInstinctIds: string[] = [];
  const rejectedSlugs: string[] = [];
  let deferredHookCount = 0;
  let runningIndex = 0;

  for (const cluster of merged.clusters) {
    const type = categoryToType(cluster.suggestedCategory);

    // CREATE_HOOK: deferred to Sprint B.1 (Q7)
    if (cluster.suggestedCategory === "CREATE_HOOK") {
      deferredHookCount += 1;
      continue;
    }

    // OPTIMIZE: not a generatable artifact in Sprint B
    if (type === null) {
      continue;
    }

    // Filter member instinctIds against live set
    const liveMembers = cluster.members.filter((m) => liveIds.has(m.instinctId));
    const staleMembers = cluster.members.filter((m) => !liveIds.has(m.instinctId));

    for (const stale of staleMembers) {
      if (!staleInstinctIds.includes(stale.instinctId)) {
        staleInstinctIds.push(stale.instinctId);
      }
    }

    // If zero live members remain, drop the cluster entirely
    if (liveMembers.length === 0) {
      continue;
    }

    // Derive and validate slug
    const slug = deriveSlug(cluster.label);
    if (!slug) {
      rejectedSlugs.push(cluster.label);
      continue;
    }

    // Build target path (relative — absolute resolution is Phase 3's responsibility)
    const targetPath = buildTargetPath(type, slug);

    // Derive complexity and confidence from live members
    const complexity = deriveComplexity(liveMembers.length);
    const confidence = deriveConfidence(cluster.metrics.meanConfidence);

    // Build spec
    const spec = buildSpec(type, cluster);

    runningIndex += 1;

    const proposal: GenerateProposal = {
      index: runningIndex,
      type,
      slug,
      name: cluster.label,
      targetPath,
      sourceClusterIds: [cluster.id],
      sourceInstinctIds: liveMembers.map((m) => m.instinctId),
      suggestedCategory: cluster.suggestedCategory,
      complexity,
      confidence,
      rationale: cluster.rationale,
      spec,
    };

    proposals.push(proposal);
  }

  // Step 5: Cap at MAX_PROPOSALS
  let finalProposals = proposals;
  const meta: Record<string, unknown> = {};

  if (rejectedSlugs.length > 0) {
    meta["rejectedSlugs"] = rejectedSlugs;
  }

  if (proposals.length > MAX_PROPOSALS) {
    // Sort: HIGH > MED > LOW confidence, then S > M > L complexity
    const sorted = [...proposals].sort((a, b) => {
      const confDiff =
        CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence];
      if (confDiff !== 0) return confDiff;
      return COMPLEXITY_ORDER[a.complexity] - COMPLEXITY_ORDER[b.complexity];
    });
    finalProposals = sorted.slice(0, MAX_PROPOSALS);
    // Re-index after sort/cap
    finalProposals = finalProposals.map((p, i) => ({ ...p, index: i + 1 }));
    meta["cappedAt"] = MAX_PROPOSALS;
  }

  const preview: EvolveGeneratePreview = {
    proposals: finalProposals,
    sourceReportCount: reports.length,
    sourceWindow,
    deferredHookCount,
  };

  if (staleInstinctIds.length > 0) {
    preview.staleInstinctIds = staleInstinctIds;
  }

  if (Object.keys(meta).length > 0) {
    preview.meta = meta;
  }

  return preview;
}

// ─── Source window helper ───

function computeSourceWindow(
  reports: ClusterReport[],
  now: Date,
): { from: string; to: string } {
  if (reports.length === 0) {
    const iso = now.toISOString();
    return { from: iso, to: iso };
  }

  const timestamps = reports.map((r) => new Date(r.generatedAt).getTime());
  const earliest = new Date(Math.min(...timestamps));
  const latest = new Date(Math.max(...timestamps));

  return {
    from: earliest.toISOString(),
    to: latest.toISOString(),
  };
}

// ─── Template loader ───

/**
 * Loads a markdown template from evolve-generate-templates/.
 * Uses import.meta.url + fileURLToPath for cross-platform resolution.
 */
function loadTemplate(templateName: string): string {
  const templateDir = fileURLToPath(
    new URL("./evolve-generate-templates", import.meta.url),
  );
  const templatePath = path.join(templateDir, templateName);
  return fs.readFileSync(templatePath, "utf8");
}

/**
 * Renders a template by substituting {{TOKEN}} placeholders.
 */
function renderTemplate(
  template: string,
  tokens: Record<string, string>,
): string {
  return Object.entries(tokens).reduce(
    (content, [key, value]) => content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value),
    template,
  );
}

/**
 * Renders a GenerateProposal to markdown using the appropriate template.
 * Used by applyEvolveGenerate (Phase 3) — exported for testing.
 */
export function renderProposalToMarkdown(
  proposal: GenerateProposal,
  now: Date = new Date(),
): string {
  const templateName = `${proposal.type}.template.md`;
  const template = loadTemplate(templateName);

  const tokens: Record<string, string> = {
    SLUG: proposal.slug,
    NAME: proposal.name,
    DESCRIPTION: proposal.rationale,
    RATIONALE: proposal.rationale,
    GENERATED_AT: now.toISOString(),
    SOURCE_CLUSTERS: proposal.sourceClusterIds.join(", "),
    SOURCE_INSTINCTS: proposal.sourceInstinctIds.join(", "),
    PATTERN: "",
    ACTION: "",
    WORKFLOW: "",
    ROLE: "",
    TRIGGERS: "",
    CATEGORY: "",
    SCOPE: "",
    MODEL: "sonnet",
  };

  const spec = proposal.spec;

  if (spec.kind === "skill") {
    tokens["PATTERN"] = spec.pattern;
    tokens["ACTION"] = spec.action;
  } else if (spec.kind === "command") {
    tokens["WORKFLOW"] = spec.workflow;
    tokens["PATTERN"] = spec.workflow;
  } else if (spec.kind === "agent") {
    tokens["ROLE"] = spec.role;
    tokens["TRIGGERS"] = spec.triggers.join(", ");
    tokens["MODEL"] = spec.model;
  } else if (spec.kind === "rule") {
    tokens["CATEGORY"] = spec.category;
    tokens["SCOPE"] = spec.scope;
  }

  return renderTemplate(template, tokens);
}

// ─── Single filesystem mutator (Phase 3 — applyEvolveGenerate) ───

/**
 * Single filesystem mutator. Writes approved markdown artifacts to
 * {cwd}/.claude/{type}/{slug}.md.
 *
 * Transactional: if ANY target path already exists (collision), ZERO files
 * are written and the full collision list is returned (ADR-008:62).
 */
export function applyEvolveGenerate(
  preview: EvolveGeneratePreview,
  approvals: ApplyApprovals,
  opts: EvolveGenerateOptions,
): ApplyResult {
  const approved = preview.proposals.filter((p) =>
    approvals.approvedIndices.includes(p.index),
  );

  const written: Array<{ type: ProposalType; targetPath: string }> = [];
  const pluginInvocations: Array<{ slug: string; spec: SkillSpec }> = [];
  const collisions: string[] = [];
  const errors: string[] = [];

  if (approved.length === 0) {
    return { written, pluginInvocations, collisions, errors };
  }

  // Pre-flight: build absolute paths and check for collisions
  const tasks: Array<{
    proposal: GenerateProposal;
    absolutePath: string;
  }> = [];

  for (const proposal of approved) {
    const absolutePath = path.resolve(opts.cwd, proposal.targetPath);

    // Safety: resolved path must be under {cwd}/.claude
    const dotClaudeDir = path.resolve(opts.cwd, ".claude");
    if (!absolutePath.startsWith(dotClaudeDir + path.sep) && absolutePath !== dotClaudeDir) {
      errors.push(
        `Path traversal rejected: "${proposal.targetPath}" resolves outside .claude/`,
      );
      continue;
    }

    if (fs.existsSync(absolutePath)) {
      collisions.push(absolutePath);
    }

    tasks.push({ proposal, absolutePath });
  }

  // Transactional abort: if any collision, write nothing
  if (collisions.length > 0) {
    return { written, pluginInvocations, collisions, errors };
  }

  // Write all approved proposals
  const now = new Date();
  for (const { proposal, absolutePath } of tasks) {
    try {
      // Create directory if missing
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

      if (proposal.type === "skill") {
        // PROMOTE: hand off to skill-creator plugin (command-level handles this)
        const spec = proposal.spec as SkillSpec;
        pluginInvocations.push({ slug: proposal.slug, spec });
        // Still write a placeholder markdown so the artifact exists
        const content = renderProposalToMarkdown(proposal, now);
        fs.writeFileSync(absolutePath, content, "utf8");
      } else {
        const content = renderProposalToMarkdown(proposal, now);
        fs.writeFileSync(absolutePath, content, "utf8");
      }

      written.push({ type: proposal.type, targetPath: absolutePath });
    } catch (err: unknown) {
      errors.push(
        `Failed to write ${absolutePath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { written, pluginInvocations, collisions, errors };
}
