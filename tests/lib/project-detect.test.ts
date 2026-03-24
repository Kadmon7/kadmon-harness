import { describe, it, expect } from 'vitest';
import os from 'node:os';
import { detectProject } from '../../scripts/lib/project-detect.js';

describe('project-detect', () => {
  it('detects the current repo (kadmon-harness)', () => {
    const info = detectProject();
    expect(info).not.toBeNull();
    expect(info!.remoteUrl).toContain('kadmon-harness');
    expect(info!.projectHash).toHaveLength(16);
    expect(info!.projectHash).toMatch(/^[0-9a-f]{16}$/);
    expect(info!.branch).toBeTruthy();
    expect(info!.rootDir).toBeTruthy();
  });

  it('returns null for non-git directory', () => {
    const info = detectProject(os.tmpdir());
    expect(info).toBeNull();
  });

  it('projectHash is deterministic for same remote', () => {
    const a = detectProject();
    const b = detectProject();
    expect(a!.projectHash).toBe(b!.projectHash);
  });
});
