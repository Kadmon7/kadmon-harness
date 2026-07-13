// Kadmon Harness — SQLite State Store: sync queue operations
// v2: Supabase sync layer — infrastructure for planned v2 migration, not invoked in v1 production code.
// Split from state-store.ts (AUD-37). Imports getDb from ./core.
import { nowISO } from "../utils.js";
import { getDb } from "./core.js";
export function queueSync(table, recordId, operation, payload) {
    getDb()
        .prepare(`
    INSERT INTO sync_queue (table_name, record_id, operation, payload)
    VALUES (@table_name, @record_id, @operation, @payload)
  `)
        .run({
        table_name: table,
        record_id: recordId,
        operation,
        payload: JSON.stringify(payload),
    });
}
export function getPendingSync(limit = 50) {
    return getDb()
        .prepare("SELECT * FROM sync_queue WHERE synced_at IS NULL ORDER BY id ASC LIMIT ?")
        .all(limit)
        .map((row) => ({
        id: Number(row.id),
        tableName: String(row.table_name),
        recordId: String(row.record_id),
        operation: String(row.operation),
        payload: String(row.payload),
        createdAt: String(row.created_at),
        syncedAt: row.synced_at ? String(row.synced_at) : null,
        retryCount: Number(row.retry_count),
        lastError: row.last_error ? String(row.last_error) : null,
    }));
}
export function markSynced(id) {
    getDb()
        .prepare("UPDATE sync_queue SET synced_at = @synced_at WHERE id = @id")
        .run({
        id,
        synced_at: nowISO(),
    });
}
