import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
export function nowISO() {
    return new Date().toISOString();
}
export function nowMs() {
    return Date.now();
}
export function tmpDir() {
    return path.join(os.tmpdir(), "kadmon");
}
export function sessionDir(sessionId) {
    return path.join(tmpDir(), sessionId);
}
export function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}
export function hashString(input) {
    return createHash("sha256").update(input).digest("hex").slice(0, 16);
}
export function generateId() {
    return randomUUID();
}
export function kadmonDataDir() {
    return path.join(os.homedir(), ".kadmon");
}
export function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds < 60)
        return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
}
export function log(level, msg, meta) {
    const entry = { ts: nowISO(), level, msg, ...meta };
    process.stderr.write(JSON.stringify(entry) + "\n");
}
