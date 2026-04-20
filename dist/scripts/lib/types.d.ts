export interface Instinct {
    id: string;
    projectHash: string;
    pattern: string;
    action: string;
    confidence: number;
    occurrences: number;
    contradictions: number;
    sourceSessions: string[];
    status: "active" | "promoted" | "contradicted" | "archived";
    scope: "project" | "global";
    domain?: string;
    createdAt: string;
    updatedAt: string;
    /** ISO 8601 of most recent observation that matched this instinct. Seeds decay. Undefined for pre-v0.5 rows. */
    lastObservedAt?: string;
    promotedTo?: string;
}
/** Sentinel export so consumers can import a runtime schema version check. */
export declare const CLUSTER_REPORT_SCHEMA_VERSION = 1;
export type EvolutionCategory = "PROMOTE" | "CREATE_AGENT" | "CREATE_COMMAND" | "CREATE_RULE" | "CREATE_HOOK" | "OPTIMIZE";
export interface ClusterMemberRef {
    /** FK to instincts.id — never a copy of the row */
    instinctId: string;
    /** Confidence of this member inside the cluster (0..1). May differ from instinct.confidence */
    membership: number;
}
export interface Cluster {
    /** Stable ID within this report. Not persisted, not reused across reports. */
    id: string;
    /** Suggested evolution category for this cluster. A hint for step 6, not a mandate. */
    suggestedCategory: EvolutionCategory;
    /** Human-readable label, e.g. "read-before-edit patterns" */
    label: string;
    /** Optional domain tag (TypeScript, SQL, Python, hooks, git, ...) if derivable */
    domain?: string;
    /** Member instincts (by ID). At least one member required. */
    members: ClusterMemberRef[];
    /** Aggregate metrics, recomputed each run */
    metrics: {
        /** Mean confidence across member instincts */
        meanConfidence: number;
        /** Sum of occurrences across members — proxy for evidence strength */
        totalOccurrences: number;
        /** Count of contradicted instincts in this cluster — proxy for pattern instability */
        contradictionCount: number;
        /** Sessions that contributed at least one member observation */
        distinctSessions: number;
    };
    /** Free-form rationale for the clustering decision. Used by alchemik to explain proposals. */
    rationale: string;
}
export interface ClusterReport {
    /** Contract version. Bump on breaking changes. Alchemik MUST check this on read. */
    schemaVersion: 1;
    /** Project hash at the time the report was generated */
    projectHash: string;
    /** Session that produced the report */
    sessionId: string;
    /** ISO 8601 timestamp */
    generatedAt: string;
    /** All clusters found this run. May be empty. */
    clusters: Cluster[];
    /** Instincts considered but not placed into any cluster (singletons below support threshold) */
    unclustered: ClusterMemberRef[];
    /** Aggregate totals for quick inspection without re-walking the report */
    totals: {
        activeInstincts: number;
        clusteredInstincts: number;
        unclusteredInstincts: number;
        promotableInstincts: number;
    };
    /** Escape hatch for future fields without bumping schemaVersion. Producers may populate; consumers MAY ignore. */
    meta?: Record<string, unknown>;
}
export type ProposalType = "skill" | "command" | "agent" | "rule";
export type Complexity = "S" | "M" | "L";
export type ProposalConfidence = "HIGH" | "MED" | "LOW";
export interface SkillSpec {
    kind: "skill";
    pattern: string;
    action: string;
    sourceClusterIds: string[];
}
export interface CommandSpec {
    kind: "command";
    workflow: string;
    agentChain?: string[];
    sourceClusterIds: string[];
}
export interface AgentSpec {
    kind: "agent";
    role: string;
    triggers: string[];
    model: "opus" | "sonnet" | "haiku";
    sourceClusterIds: string[];
}
export interface RuleSpec {
    kind: "rule";
    scope: "common" | "typescript" | "python";
    category: string;
    sourceClusterIds: string[];
}
export interface GenerateProposal {
    index: number;
    type: ProposalType;
    slug: string;
    name: string;
    targetPath: string;
    sourceClusterIds: string[];
    sourceInstinctIds: string[];
    suggestedCategory: EvolutionCategory;
    complexity: Complexity;
    confidence: ProposalConfidence;
    rationale: string;
    spec: SkillSpec | CommandSpec | AgentSpec | RuleSpec;
}
export interface EvolveGeneratePreview {
    proposals: GenerateProposal[];
    sourceReportCount: number;
    sourceWindow: {
        from: string;
        to: string;
    };
    deferredHookCount: number;
    skipped?: "no-reports-in-window";
    staleInstinctIds?: string[];
    meta?: Record<string, unknown>;
}
export interface ApplyApprovals {
    approvedIndices: number[];
}
export interface ApplyResult {
    written: Array<{
        type: ProposalType;
        targetPath: string;
    }>;
    pluginInvocations: Array<{
        slug: string;
        spec: SkillSpec;
    }>;
    collisions: string[];
    errors: string[];
}
export interface SessionSummary {
    id: string;
    projectHash: string;
    startedAt: string;
    endedAt: string;
    durationMs: number;
    branch: string;
    tasks: string[];
    filesModified: string[];
    toolsUsed: string[];
    messageCount: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    estimatedCostUsd: number;
    instinctsCreated: string[];
    compactionCount: number;
    summary?: string;
}
export interface ObservabilityEvent {
    timestamp: string;
    sessionId: string;
    eventType: "tool_pre" | "tool_post" | "tool_fail" | "compaction" | "hook";
    toolName: string;
    filePath?: string;
    success?: boolean;
    durationMs?: number;
    metadata?: Record<string, unknown>;
}
export interface CostEvent {
    id?: string;
    sessionId: string;
    timestamp: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
}
export interface SyncQueueEntry {
    id?: number;
    tableName: string;
    recordId: string;
    operation: "insert" | "update" | "delete";
    payload: string;
    createdAt: string;
    syncedAt?: string | null;
    retryCount: number;
    lastError?: string | null;
}
export interface HookEvent {
    id: string;
    sessionId: string;
    hookName: string;
    eventType: "pre_tool" | "post_tool" | "post_tool_fail" | "pre_compact" | "session_start" | "stop";
    toolName?: string;
    exitCode: number;
    blocked: boolean;
    durationMs?: number;
    error?: string;
    timestamp: string;
}
export interface AgentInvocation {
    id: string;
    sessionId: string;
    agentType: string;
    model?: string;
    description?: string;
    durationMs?: number;
    success?: boolean;
    error?: string;
    timestamp: string;
}
export interface ResearchReport {
    id: string;
    sessionId: string;
    projectHash: string;
    reportNumber: number;
    slug: string;
    topic: string;
    path: string;
    summary?: string;
    confidence?: "High" | "Medium" | "Low";
    capsHit: string[];
    subQuestions: string[];
    sourcesCount: number;
    openQuestions: string[];
    untrustedSources: boolean;
    generatedAt: string;
}
export interface ProjectInfo {
    projectHash: string;
    remoteUrl: string;
    branch: string;
    rootDir: string;
}
export interface CostResult {
    model: string;
    inputTokens: number;
    outputTokens: number;
    inputCostUsd: number;
    outputCostUsd: number;
    totalCostUsd: number;
}
export type PatternDefinition = {
    type: "sequence";
    name: string;
    action: string;
    before: string;
    after: string;
    threshold: number;
    domain?: string;
} | {
    type: "command_sequence";
    name: string;
    action: string;
    triggerCommands: string[];
    followedByCommands: string[];
    threshold: number;
    domain?: string;
} | {
    type: "cluster";
    name: string;
    action: string;
    tool: string;
    minClusterSize: number;
    threshold: number;
    domain?: string;
} | {
    type: "file_sequence";
    name: string;
    action: string;
    editTools: string[];
    filePathGlob: string;
    followedByCommands: string[];
    withinToolCalls: number;
    threshold: number;
    domain?: string;
} | {
    type: "tool_arg_presence";
    name: string;
    action: string;
    toolName: string;
    metadataKey: string;
    expectedValues: string[];
    threshold: number;
    domain?: string;
};
export interface PatternResult {
    name: string;
    action: string;
    count: number;
    threshold: number;
    triggered: boolean;
    domain?: string;
}
