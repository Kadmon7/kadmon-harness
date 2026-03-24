# ADR-005: Ephemeral Observations as JSONL

## Status
Accepted

## Context
The observe-pre and observe-post hooks run on every tool call. They need to be extremely fast (< 50ms). Writing to SQLite on every call would add latency.

## Decision
Per-session observations are stored as JSONL files in `os.tmpdir()/kadmon/<session-id>/observations.jsonl`. They are NOT stored in SQLite during the session. At session end (Stop event), observations are summarized and the summary is written to SQLite.

## Consequences
- Observe hooks are fast (file append only, no DB)
- Observations are ephemeral — lost if session crashes without Stop event
- Session summary in SQLite captures the important patterns
- No SQLite write contention during active sessions
