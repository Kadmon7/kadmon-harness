import type { SyncQueueEntry } from "../types.js";
export declare function queueSync(table: string, recordId: string, operation: "insert" | "update" | "delete", payload: object): void;
export declare function getPendingSync(limit?: number): SyncQueueEntry[];
export declare function markSynced(id: number): void;
