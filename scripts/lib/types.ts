// Kadmon Harness — Core Types
// All interfaces use camelCase. SQLite columns use snake_case.
// Conversion happens only in state-store.ts.

// ─── Instinct Store ───

export interface Instinct {
  id: string;
  projectHash: string;
  pattern: string;
  action: string;
  confidence: number; // 0.0-1.0 (starts 0.3, +0.1 per occurrence, max 0.9)
  occurrences: number;
  contradictions: number;
  sourceSessions: string[];
  status: "active" | "promoted" | "contradicted" | "archived";
  scope: "project" | "global";
  domain?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  promotedTo?: string;
}

// Lifecycle:
// 1. Created: confidence=0.3, occurrences=1, status='active'
// 2. Reinforced: confidence += 0.1, occurrences++
// 3. Contradicted: contradictions++; if contradictions > occurrences → status='contradicted'
// 4. Promotable: confidence >= 0.7 AND occurrences >= 3 AND status='active'
// 5. Promoted: status='promoted', promotedTo='skill-name'
// 6. Archived: manually or when contradictions dominate

// ─── Session Summary ───

export interface SessionSummary {
  id: string;
  projectHash: string;
  startedAt: string; // ISO 8601
  endedAt: string; // ISO 8601
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

// ─── Observability Event (ephemeral, per-session JSONL) ───

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

// ─── Cost Event ───

export interface CostEvent {
  id?: string;
  sessionId: string;
  timestamp: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

// ─── Sync Queue (SQLite only) ───

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

// ─── Hook Event (persistent, per-session) ───

export interface HookEvent {
  id: string;
  sessionId: string;
  hookName: string;
  eventType:
    | "pre_tool"
    | "post_tool"
    | "post_tool_fail"
    | "pre_compact"
    | "session_start"
    | "stop";
  toolName?: string;
  exitCode: number;
  blocked: boolean;
  durationMs?: number;
  error?: string;
  timestamp: string;
}

// ─── Agent Invocation (persistent, per-session) ───

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

// ─── Project Info ───

export interface ProjectInfo {
  projectHash: string;
  remoteUrl: string;
  branch: string;
  rootDir: string;
}

// ─── Cost Result ───

export interface CostResult {
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
}

// ─── Pattern Engine ───

export type PatternDefinition =
  | {
      type: "sequence";
      name: string;
      action: string;
      before: string;
      after: string;
      threshold: number;
      domain?: string;
    }
  | {
      type: "command_sequence";
      name: string;
      action: string;
      triggerCommands: string[];
      followedByCommands: string[];
      threshold: number;
      domain?: string;
    }
  | {
      type: "cluster";
      name: string;
      action: string;
      tool: string;
      minClusterSize: number;
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
