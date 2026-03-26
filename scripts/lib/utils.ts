import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function nowISO(): string {
  return new Date().toISOString();
}

export function nowMs(): number {
  return Date.now();
}

export function tmpDir(): string {
  return path.join(os.tmpdir(), "kadmon");
}

export function sessionDir(sessionId: string): string {
  return path.join(tmpDir(), sessionId);
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function hashString(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

export function generateId(): string {
  return randomUUID();
}

export function kadmonDataDir(): string {
  return path.join(os.homedir(), ".kadmon");
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export function log(
  level: "info" | "warn" | "error",
  msg: string,
  meta?: object,
): void {
  const entry = { ts: nowISO(), level, msg, ...meta };
  process.stderr.write(JSON.stringify(entry) + "\n");
}
