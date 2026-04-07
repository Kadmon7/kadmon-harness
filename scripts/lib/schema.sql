-- Kadmon Harness — SQLite Schema
-- Phase: v1
-- Source: docs/design/prompt-2-output.md Section 2.3

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  project_hash TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  duration_ms INTEGER,
  branch TEXT,
  tasks TEXT DEFAULT '[]',
  files_modified TEXT DEFAULT '[]',
  tools_used TEXT DEFAULT '[]',
  message_count INTEGER DEFAULT 0,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  estimated_cost_usd REAL DEFAULT 0,
  instincts_created TEXT DEFAULT '[]',
  compaction_count INTEGER DEFAULT 0,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS instincts (
  id TEXT PRIMARY KEY,
  project_hash TEXT NOT NULL,
  pattern TEXT NOT NULL,
  action TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.30,
  occurrences INTEGER NOT NULL DEFAULT 1,
  contradictions INTEGER NOT NULL DEFAULT 0,
  source_sessions TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'promoted', 'contradicted', 'archived')),
  scope TEXT NOT NULL DEFAULT 'project'
    CHECK (scope IN ('project', 'global')),
  domain TEXT,
  promoted_to TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cost_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  estimated_cost_usd REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS hook_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  hook_name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('pre_tool', 'post_tool', 'post_tool_fail', 'pre_compact', 'session_start', 'stop')),
  tool_name TEXT,
  exit_code INTEGER NOT NULL DEFAULT 0,
  blocked INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  error TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_invocations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  agent_type TEXT NOT NULL,
  model TEXT,
  description TEXT,
  duration_ms INTEGER,
  success INTEGER,
  error TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_instincts_project ON instincts(project_hash);
CREATE INDEX IF NOT EXISTS idx_instincts_status ON instincts(status);
CREATE INDEX IF NOT EXISTS idx_instincts_confidence ON instincts(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_cost_events_session ON cost_events(session_id);
CREATE INDEX IF NOT EXISTS idx_cost_events_timestamp ON cost_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON sync_queue(synced_at) WHERE synced_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hook_events_session ON hook_events(session_id);
CREATE INDEX IF NOT EXISTS idx_hook_events_hook ON hook_events(hook_name);
CREATE INDEX IF NOT EXISTS idx_hook_events_timestamp ON hook_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_invocations_session ON agent_invocations(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_invocations_agent ON agent_invocations(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_invocations_timestamp ON agent_invocations(timestamp DESC);
