import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  nowISO, nowMs, tmpDir, sessionDir, ensureDir,
  hashString, generateId, kadmonDataDir, log,
} from '../../scripts/lib/utils.js';

describe('utils', () => {
  const testDirs: string[] = [];

  afterEach(() => {
    for (const d of testDirs) {
      fs.rmSync(d, { recursive: true, force: true });
    }
    testDirs.length = 0;
  });

  it('nowISO returns valid ISO 8601 string', () => {
    const iso = nowISO();
    expect(new Date(iso).toISOString()).toBe(iso);
  });

  it('nowMs returns a number close to Date.now()', () => {
    const before = Date.now();
    const ms = nowMs();
    const after = Date.now();
    expect(ms).toBeGreaterThanOrEqual(before);
    expect(ms).toBeLessThanOrEqual(after);
  });

  it('tmpDir returns path under os.tmpdir()', () => {
    const dir = tmpDir();
    expect(dir).toBe(path.join(os.tmpdir(), 'kadmon'));
  });

  it('sessionDir returns path under tmpDir', () => {
    const dir = sessionDir('abc-123');
    expect(dir).toBe(path.join(os.tmpdir(), 'kadmon', 'abc-123'));
  });

  it('ensureDir creates nested directories', () => {
    const dir = path.join(os.tmpdir(), 'kadmon-test-' + Date.now(), 'a', 'b');
    testDirs.push(path.join(os.tmpdir(), 'kadmon-test-' + Date.now().toString().slice(0, -1)));
    testDirs.push(dir.split(path.sep).slice(0, -2).join(path.sep));
    ensureDir(dir);
    expect(fs.existsSync(dir)).toBe(true);
    fs.rmSync(dir.split(path.sep).slice(0, -2).join(path.sep), { recursive: true, force: true });
  });

  it('hashString returns 16 char hex', () => {
    const h = hashString('https://github.com/Kadmon7/kadmon-harness.git');
    expect(h).toHaveLength(16);
    expect(h).toMatch(/^[0-9a-f]{16}$/);
  });

  it('hashString is deterministic', () => {
    const a = hashString('test');
    const b = hashString('test');
    expect(a).toBe(b);
  });

  it('hashString differs for different inputs', () => {
    const a = hashString('foo');
    const b = hashString('bar');
    expect(a).not.toBe(b);
  });

  it('generateId returns a UUID v4', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('kadmonDataDir returns path under homedir', () => {
    const dir = kadmonDataDir();
    expect(dir).toBe(path.join(os.homedir(), '.kadmon'));
  });

  it('log writes JSON to stderr', () => {
    const original = process.stderr.write;
    let output = '';
    process.stderr.write = ((chunk: string) => { output += chunk; return true; }) as typeof process.stderr.write;
    try {
      log('info', 'test message', { extra: 42 });
      const parsed = JSON.parse(output.trim());
      expect(parsed.level).toBe('info');
      expect(parsed.msg).toBe('test message');
      expect(parsed.extra).toBe(42);
      expect(parsed.ts).toBeDefined();
    } finally {
      process.stderr.write = original;
    }
  });
});
