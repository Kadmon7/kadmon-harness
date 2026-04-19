// Kadmon Harness — Forge pipeline (ADR-005)
// Read observations → extract candidates → project changes in-memory →
// evaluate recommendations → cluster → return preview. `applyForgePreview`
// is the ONLY function that mutates the DB.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import type {
  Instinct,
  Cluster,
  ClusterMemberRef,
  ClusterReport,
  EvolutionCategory,
  PatternResult,
} from "./types.js";
import {
  CLUSTER_REPORT_SCHEMA_VERSION,
} from "./types.js";
import {
  getActiveInstincts,
  upsertInstinct,
  getCrossProjectPromotionCandidates,
} from "./state-store.js";
import { promoteToGlobal } from "./instinct-manager.js";
import {
  evaluatePatterns,
  loadPatternDefinitions,
} from "./pattern-engine.js";
import { generateId, nowISO } from "./utils.js";

// ─── Public types ───

export interface ForgePipelineOptions {
  projectHash: string;
  sessionId: string;
  dryRun?: boolean;
}

export interface ForgeReinforcement {
  before: Instinct;
  after: Instinct;
}

export interface ForgeScopePromotion {
  instinctId: string;
  fromScope: "project";
  toScope: "global";
  rationale: string;
}

export interface ForgePreview {
  would: {
    create: Instinct[];
    reinforce: ForgeReinforcement[];
    promote: Instinct[];
    prune: Instinct[];
    scopePromote: ForgeScopePromotion[];
  };
  clusterReport: ClusterReport;
  totals: {
    created: number;
    reinforced: number;
    promoted: number;
    pruned: number;
    scopePromoted: number;
  };
}

// ─── Thresholds (mirror instinct-manager semantics) ───

// Whitelist sessionId to block path traversal through the filesystem
// helpers (observations JSONL path, cluster report filename). UUID-ish
// shape: alphanumeric + dash + underscore only.
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function assertSafeSessionId(sessionId: string): void {
  if (!SAFE_ID_PATTERN.test(sessionId)) {
    throw new Error(
      `forge-pipeline: unsafe sessionId "${sessionId}" — must match /^[A-Za-z0-9_-]+$/`,
    );
  }
}

const INITIAL_CONFIDENCE = 0.3;
const REINFORCE_DELTA = 0.1;
const MAX_CONFIDENCE = 0.9;
const PROMOTE_CONFIDENCE = 0.7;
const PROMOTE_OCCURRENCES = 3;
const PRUNE_LOW_CONFIDENCE = 0.2;
const PRUNE_LOW_OCCURRENCES = 2;

// ─── Main pipeline ───

export async function runForgePipeline(
  opts: ForgePipelineOptions,
): Promise<ForgePreview> {
  const { projectHash, sessionId } = opts;
  assertSafeSessionId(sessionId);

  // Step 1: Read observations
  const { toolSeq, lines } = readObservationsForSession(sessionId);

  // Step 2: Extract pattern candidates
  const candidates = extractCandidates(toolSeq, lines);

  // Step 3: Reinforce / Create (in-memory projection, never touches DB)
  const existing = getActiveInstincts(projectHash);
  const { create, reinforce } = projectInMemory(
    candidates,
    existing,
    projectHash,
    sessionId,
  );

  // Step 4: Evaluate recommendations (promote/prune) on the projected state
  const projected = applyProjectionInMemory(existing, create, reinforce);
  const { promote, prune } = evaluateRecommendations(projected);

  // Step 4.5: Cross-project scope promotion (plan-018 Phase 4). Orthogonal
  // to step 4 — a single instinct may legitimately appear in both `promote`
  // (status → 'promoted') and `scopePromote` (scope → 'global'), since the
  // two columns are independent.
  const crossProjectCandidates = getCrossProjectPromotionCandidates();
  const scopePromote: ForgeScopePromotion[] = [];
  for (const candidate of crossProjectCandidates) {
    const rationale = `Matches in ${candidate.projectCount} projects, avg confidence ${candidate.avgConfidence.toFixed(2)}`;
    for (const instinctId of candidate.instinctIds) {
      scopePromote.push({
        instinctId,
        fromScope: "project",
        toScope: "global",
        rationale,
      });
    }
  }

  // Step 5: Cluster report
  const clusterReport = computeClusterReport(projected, projectHash, sessionId);

  return {
    would: { create, reinforce, promote, prune, scopePromote },
    clusterReport,
    totals: {
      created: create.length,
      reinforced: reinforce.length,
      promoted: promote.length,
      pruned: prune.length,
      scopePromoted: scopePromote.length,
    },
  };
}

// ─── Apply (the ONLY DB mutator) ───

export function applyForgePreview(
  preview: ForgePreview,
  _opts: ForgePipelineOptions,
): void {
  for (const inst of preview.would.create) {
    upsertInstinct(inst);
  }
  for (const { after } of preview.would.reinforce) {
    upsertInstinct(after);
  }
  for (const inst of preview.would.promote) {
    upsertInstinct({
      ...inst,
      status: "promoted",
      updatedAt: nowISO(),
    });
  }
  for (const inst of preview.would.prune) {
    upsertInstinct({
      ...inst,
      status: "archived",
      updatedAt: nowISO(),
    });
  }
  // Cross-project scope promotions (plan-018 Phase 4). De-duplicate ids so
  // a single instinct present in multiple scopePromote entries is only
  // flipped once. Return value is the authoritative count of scope flips —
  // explicitly discarded here because `applyForgePreview` has no caller-
  // visible return channel; the preview.totals.scopePromoted column was
  // the user-facing estimate and downstream /forge rendering reports both.
  const scopeIds = Array.from(
    new Set(preview.would.scopePromote.map((s) => s.instinctId)),
  );
  if (scopeIds.length > 0) void promoteToGlobal(scopeIds);
}

// ─── Step 1: read observations ───

interface ObservationData {
  toolSeq: string[];
  lines: string[];
}

function readObservationsForSession(sessionId: string): ObservationData {
  const obsPath = path.join(
    os.tmpdir(),
    "kadmon",
    sessionId,
    "observations.jsonl",
  );
  if (!fs.existsSync(obsPath)) return { toolSeq: [], lines: [] };

  const raw = fs.readFileSync(obsPath, "utf8");
  const lines = raw.split("\n").filter(Boolean);
  const toolSeq: string[] = [];
  for (const line of lines) {
    try {
      const e = JSON.parse(line) as { eventType?: string; toolName?: string };
      if (e.eventType === "tool_pre" && typeof e.toolName === "string") {
        toolSeq.push(e.toolName);
      }
    } catch {
      // skip malformed lines
    }
  }
  return { toolSeq, lines };
}

// ─── Step 2: extract candidates via pattern-engine ───

function extractCandidates(toolSeq: string[], lines: string[]): PatternResult[] {
  if (toolSeq.length === 0 && lines.length === 0) return [];

  const defsPath = fileURLToPath(
    new URL("../../.claude/hooks/pattern-definitions.json", import.meta.url),
  );
  if (!fs.existsSync(defsPath)) return [];

  const definitions = loadPatternDefinitions(defsPath);
  const results = evaluatePatterns(definitions, toolSeq, lines);
  return results.filter((r) => r.triggered);
}

// ─── Step 3: in-memory projection (no DB writes) ───

interface ProjectionResult {
  create: Instinct[];
  reinforce: ForgeReinforcement[];
}

function projectInMemory(
  candidates: PatternResult[],
  existing: Instinct[],
  projectHash: string,
  sessionId: string,
): ProjectionResult {
  const byPattern = new Map<string, Instinct>(
    existing.map((i) => [i.pattern, i]),
  );

  const create: Instinct[] = [];
  const reinforce: ForgeReinforcement[] = [];
  const now = nowISO();

  for (const c of candidates) {
    const match = byPattern.get(c.name);
    if (match) {
      const sessions = match.sourceSessions.includes(sessionId)
        ? match.sourceSessions
        : [...match.sourceSessions, sessionId];

      const after: Instinct = {
        ...match,
        confidence: Math.min(
          MAX_CONFIDENCE,
          Math.round((match.confidence + REINFORCE_DELTA) * 100) / 100,
        ),
        occurrences: match.occurrences + 1,
        sourceSessions: sessions,
        updatedAt: now,
        lastObservedAt: now,
      };
      reinforce.push({ before: match, after });
    } else {
      const fresh: Instinct = {
        id: generateId(),
        projectHash,
        pattern: c.name,
        action: c.action,
        confidence: INITIAL_CONFIDENCE,
        occurrences: 1,
        contradictions: 0,
        sourceSessions: [sessionId],
        status: "active",
        scope: "project",
        domain: c.domain,
        createdAt: now,
        updatedAt: now,
        lastObservedAt: now,
      };
      create.push(fresh);
    }
  }

  return { create, reinforce };
}

function applyProjectionInMemory(
  existing: Instinct[],
  create: Instinct[],
  reinforce: ForgeReinforcement[],
): Instinct[] {
  const replaced = new Map<string, Instinct>(
    reinforce.map((r) => [r.before.id, r.after]),
  );
  const projected = existing.map((i) => replaced.get(i.id) ?? i);
  return [...projected, ...create];
}

// ─── Step 4: evaluate promotion / prune recommendations ───

interface RecommendationResult {
  promote: Instinct[];
  prune: Instinct[];
}

function evaluateRecommendations(instincts: Instinct[]): RecommendationResult {
  const promote: Instinct[] = [];
  const prune: Instinct[] = [];

  for (const inst of instincts) {
    if (inst.status !== "active") continue;

    if (
      inst.confidence >= PROMOTE_CONFIDENCE &&
      inst.occurrences >= PROMOTE_OCCURRENCES
    ) {
      promote.push(inst);
      continue;
    }

    const lowConfidence =
      inst.confidence < PRUNE_LOW_CONFIDENCE &&
      inst.occurrences < PRUNE_LOW_OCCURRENCES;
    const dominantContradictions = inst.contradictions > inst.occurrences;

    if (lowConfidence || dominantContradictions) {
      prune.push(inst);
    }
  }

  return { promote, prune };
}

// ─── Step 5: compute cluster report (pure function) ───

export function computeClusterReport(
  instincts: Instinct[],
  projectHash: string,
  sessionId: string,
): ClusterReport {
  const active = instincts.filter((i) => i.status === "active");
  const byDomain = new Map<string, Instinct[]>();
  const noDomain: Instinct[] = [];

  for (const inst of active) {
    if (inst.domain) {
      const bucket = byDomain.get(inst.domain) ?? [];
      bucket.push(inst);
      byDomain.set(inst.domain, bucket);
    } else {
      noDomain.push(inst);
    }
  }

  const clusters: Cluster[] = [];
  const unclustered: ClusterMemberRef[] = [];

  for (const [domain, members] of byDomain) {
    if (members.length >= 2) {
      clusters.push(buildCluster(domain, members));
    } else {
      for (const m of members) {
        unclustered.push({ instinctId: m.id, membership: 1 });
      }
    }
  }

  for (const m of noDomain) {
    unclustered.push({ instinctId: m.id, membership: 1 });
  }

  clusters.sort((a, b) => a.id.localeCompare(b.id));
  unclustered.sort((a, b) => a.instinctId.localeCompare(b.instinctId));

  const promotableCount = active.filter(
    (i) =>
      i.confidence >= PROMOTE_CONFIDENCE && i.occurrences >= PROMOTE_OCCURRENCES,
  ).length;

  return {
    schemaVersion: CLUSTER_REPORT_SCHEMA_VERSION,
    projectHash,
    sessionId,
    generatedAt: nowISO(),
    clusters,
    unclustered,
    totals: {
      activeInstincts: active.length,
      clusteredInstincts: clusters.reduce((s, c) => s + c.members.length, 0),
      unclusteredInstincts: unclustered.length,
      promotableInstincts: promotableCount,
    },
  };
}

const RULE_DOMAINS = new Set(["typescript", "python", "sql"]);

function buildCluster(domain: string, members: Instinct[]): Cluster {
  const sortedIds = members.map((m) => m.id).sort();
  const id = crypto
    .createHash("sha256")
    .update(sortedIds.join(","))
    .digest("hex")
    .slice(0, 8);

  const meanConfidence =
    members.reduce((s, m) => s + m.confidence, 0) / members.length;
  const totalOccurrences = members.reduce((s, m) => s + m.occurrences, 0);
  const contradictionCount = members.reduce(
    (s, m) => s + m.contradictions,
    0,
  );
  const distinctSessions = new Set(
    members.flatMap((m) => m.sourceSessions),
  ).size;

  let suggestedCategory: EvolutionCategory = "OPTIMIZE";
  if (RULE_DOMAINS.has(domain)) {
    suggestedCategory = "CREATE_RULE";
  } else if (meanConfidence >= PROMOTE_CONFIDENCE) {
    suggestedCategory = "PROMOTE";
  }

  const label = `${domain}: ${members.length} related patterns`;

  return {
    id,
    suggestedCategory,
    label,
    domain,
    members: members.map((m) => ({
      instinctId: m.id,
      membership: Math.round(m.confidence * 100) / 100,
    })),
    metrics: {
      meanConfidence: Math.round(meanConfidence * 100) / 100,
      totalOccurrences,
      contradictionCount,
      distinctSessions,
    },
    rationale: `Grouped by shared domain "${domain}" with ${members.length} active instincts.`,
  };
}
