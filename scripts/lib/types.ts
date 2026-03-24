// Kadmon Harness — Core Types
// Phase: v1 scaffold — interfaces from Prompt 2 design
// Source: docs/design/prompt-2-output.md Section 2.1

// ─── Instinct Store ───

export interface Instinct {
  id: string;                    // UUID
  project_hash: string;          // SHA-256 of git remote URL
  pattern: string;               // What was observed
  action: string;                // What to do about it
  confidence: number;            // 0.0-1.0 (starts at 0.3, +0.1 per occurrence, max 0.9)
  occurrences: number;           // Times pattern was seen
  contradictions: number;        // Times pattern was contradicted
  source_sessions: string[];     // Session IDs that contributed
  status: 'active' | 'promoted' | 'contradicted' | 'archived';
  scope: 'project' | 'global';  // Project-scoped or cross-project
  created_at: string;            // ISO 8601
  updated_at: string;            // ISO 8601
  promoted_to?: string;          // Skill/command name if promoted
}

// Lifecycle:
// 1. Created: confidence=0.3, occurrences=1, status='active'
// 2. Reinforced: confidence += 0.1, occurrences++
// 3. Contradicted: contradictions++; if contradictions > occurrences → status='contradicted'
// 4. Promotable: confidence >= 0.7 AND occurrences >= 3 AND status='active'
// 5. Promoted: status='promoted', promoted_to='skill-name'
// 6. Archived: manually or when contradictions dominate

// ─── Session Summary ───

export interface SessionSummary {
  id: string;                    // Claude session_id
  project_hash: string;          // SHA-256 of git remote URL
  started_at: string;            // ISO 8601
  ended_at: string;              // ISO 8601
  duration_ms: number;
  branch: string;
  tasks: string[];               // Summary of tasks performed
  files_modified: string[];      // Files changed during session
  tools_used: string[];          // Unique tool names used
  message_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  estimated_cost_usd: number;
  instincts_created: string[];   // Instinct IDs created/updated
  compaction_count: number;      // Times context was compacted
}

// ─── Observability Event (ephemeral, per-session JSONL) ───

export interface ObservabilityEvent {
  timestamp: string;             // ISO 8601
  session_id: string;
  event_type: 'tool_pre' | 'tool_post' | 'tool_fail' | 'compaction' | 'hook';
  tool_name: string;
  file_path?: string;            // If tool operates on a file
  success?: boolean;             // For tool_post events
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

// ─── Cost Event ───

export interface CostEvent {
  id: string;                    // UUID
  session_id: string;
  timestamp: string;             // ISO 8601
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
}

// ─── Sync Queue (SQLite only) ───

export interface SyncQueueEntry {
  id: number;
  table_name: string;
  record_id: string;
  operation: 'insert' | 'update' | 'delete';
  payload: string;               // JSON string
  created_at: string;
  synced_at: string | null;
  retry_count: number;
  last_error: string | null;
}
