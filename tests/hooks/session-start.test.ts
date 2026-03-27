import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOOK = path.resolve('.claude/hooks/scripts/session-start.js');
const SESSION_ID = `test-session-start-${Date.now()}`;
const OBS_DIR = path.join(os.tmpdir(), 'kadmon', SESSION_ID);

function runHook(input: object, env?: Record<string, string>): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync('node', [HOOK], {
      encoding: 'utf8',
      input: JSON.stringify(input),
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000,
      env: env ? { ...process.env, ...env } : undefined,
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout: string; stderr: string; status: number };
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', exitCode: e.status ?? 1 };
  }
}

describe('session-start', () => {
  afterEach(() => {
    fs.rmSync(OBS_DIR, { recursive: true, force: true });
  });

  it('detects project hash from git remote', () => {
    const r = runHook({ session_id: SESSION_ID, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('9444ca5b82301f2f');
  });

  it('outputs session started banner with branch', () => {
    const r = runHook({ session_id: SESSION_ID, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('Kadmon Session Started');
    expect(r.stdout).toContain('Branch:');
  });

  it('reports instinct count', () => {
    const r = runHook({ session_id: SESSION_ID, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/Instincts: \d+/);
  });

  it('creates session observations directory', () => {
    runHook({ session_id: SESSION_ID, cwd: process.cwd() });
    expect(fs.existsSync(OBS_DIR)).toBe(true);
  });

  it('respects KADMON_TEST_DB env var and does not write to real DB', () => {
    const realDbPath = path.join(os.homedir(), '.kadmon', 'kadmon.db');
    const sizeBefore = fs.existsSync(realDbPath) ? fs.readFileSync(realDbPath).byteLength : 0;

    // Use a temp file instead of :memory: (works better with dynamic imports on Windows)
    const testDbPath = path.join(os.tmpdir(), `kadmon-test-${Date.now()}.db`);
    const r = runHook(
      { session_id: `test-isolation-${Date.now()}`, cwd: process.cwd() },
      { KADMON_TEST_DB: testDbPath },
    );

    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('Kadmon Session Started');

    // Real DB should not have changed size (session written to temp DB instead)
    if (fs.existsSync(realDbPath)) {
      const sizeAfter = fs.readFileSync(realDbPath).byteLength;
      expect(sizeAfter).toBe(sizeBefore);
    }

    // Cleanup temp DB
    try { fs.unlinkSync(testDbPath); } catch { /* ignore */ }
  });
});
