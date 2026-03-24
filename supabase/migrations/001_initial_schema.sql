-- Kadmon Harness — Supabase Initial Schema
-- Phase: v2 (deferred — SQLite only in v1)
-- Source: docs/design/prompt-2-output.md Section 2.2

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  project_hash TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_ms INTEGER,
  branch TEXT,
  tasks JSONB DEFAULT '[]',
  files_modified JSONB DEFAULT '[]',
  tools_used JSONB DEFAULT '[]',
  message_count INTEGER DEFAULT 0,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  estimated_cost_usd NUMERIC(10,4) DEFAULT 0,
  instincts_created JSONB DEFAULT '[]',
  compaction_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE instincts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_hash TEXT NOT NULL,
  pattern TEXT NOT NULL,
  action TEXT NOT NULL,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.30,
  occurrences INTEGER NOT NULL DEFAULT 1,
  contradictions INTEGER NOT NULL DEFAULT 0,
  source_sessions JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'promoted', 'contradicted', 'archived')),
  scope TEXT NOT NULL DEFAULT 'project'
    CHECK (scope IN ('project', 'global')),
  promoted_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cost_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES sessions(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  estimated_cost_usd NUMERIC(10,6) NOT NULL
);

CREATE INDEX idx_sessions_project ON sessions(project_hash);
CREATE INDEX idx_sessions_started ON sessions(started_at DESC);
CREATE INDEX idx_instincts_project ON instincts(project_hash);
CREATE INDEX idx_instincts_status ON instincts(status);
CREATE INDEX idx_instincts_confidence ON instincts(confidence DESC);
CREATE INDEX idx_cost_events_session ON cost_events(session_id);
CREATE INDEX idx_cost_events_timestamp ON cost_events(timestamp DESC);
