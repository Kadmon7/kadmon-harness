// Kadmon Harness — Core Types
// All interfaces use camelCase. SQLite columns use snake_case.
// Conversion happens only in state-store.ts.
// Lifecycle:
// 1. Created: confidence=0.3, occurrences=1, status='active'
// 2. Reinforced: confidence += 0.1, occurrences++
// 3. Contradicted: contradictions++; if contradictions > occurrences → status='contradicted'
// 4. Promotable: confidence >= 0.7 AND occurrences >= 3 AND status='active'
// 5. Promoted: status='promoted', promotedTo='skill-name'
// 6. Archived: manually or when contradictions dominate
// ─── Forge → Evolve Handoff Contract (ADR-005) ───
// Produced by /forge pipeline step 7 (apply).
// Consumed by /evolve step 6 "Generate" (v1.1 Sprint B, not yet implemented).
// Stored as JSON file at ~/.kadmon/forge-reports/forge-clusters-<sessionId>.json
// NOT persisted to SQL — clusters are derived data (see patterns.md rule).
/** Sentinel export so consumers can import a runtime schema version check. */
export const CLUSTER_REPORT_SCHEMA_VERSION = 1;
