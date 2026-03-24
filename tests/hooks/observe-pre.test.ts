import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOOK = path.resolve('.claude/hooks/scripts/observe-pre.js');
const SESSION_ID = `test-obs-${Date.now()}`;
const OBS_DIR = path.join(os.tmpdir(), 'kadmon', SESSION_ID);
const OBS_FILE = path.join(OBS_DIR, 'observations.jsonl');

function runHook(input: object): number {
  try {
    execFileSync('node', [HOOK], {
      encoding: 'utf8',
      input: JSON.stringify(input),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return 0;
  } catch (err: unknown) {
    return (err as { status: number }).status ?? 1;
  }
}

describe('observe-pre', () => {
  afterEach(() => {
    fs.rmSync(OBS_DIR, { recursive: true, force: true });
  });

  it('creates observations JSONL file', () => {
    runHook({ session_id: SESSION_ID, tool_name: 'Read', tool_input: { file_path: 'src/index.ts' } });
    expect(fs.existsSync(OBS_FILE)).toBe(true);
    const lines = fs.readFileSync(OBS_FILE, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    const event = JSON.parse(lines[0]);
    expect(event.toolName).toBe('Read');
    expect(event.filePath).toBe('src/index.ts');
    expect(event.eventType).toBe('tool_pre');
  });

  it('appends multiple observations', () => {
    runHook({ session_id: SESSION_ID, tool_name: 'Read', tool_input: { file_path: 'a.ts' } });
    runHook({ session_id: SESSION_ID, tool_name: 'Edit', tool_input: { file_path: 'b.ts' } });
    const lines = fs.readFileSync(OBS_FILE, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
  });

  it('exits 0 always', () => {
    expect(runHook({ session_id: SESSION_ID, tool_name: 'Bash', tool_input: { command: 'ls' } })).toBe(0);
  });

  it('exits 0 with no session_id', () => {
    expect(runHook({ tool_name: 'Read' })).toBe(0);
  });
});
