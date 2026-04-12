import { execFileSync } from 'node:child_process';
import { hashString } from './utils.js';
import type { ProjectInfo } from './types.js';

function gitExec(args: string[], cwd: string): string | null {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

export function detectProject(cwd?: string): ProjectInfo | null {
  const dir = cwd ?? process.cwd();

  const remoteUrl = gitExec(['remote', 'get-url', 'origin'], dir);
  if (!remoteUrl) return null;

  const branch = gitExec(['branch', '--show-current'], dir) ?? 'unknown';
  const rootDir = gitExec(['rev-parse', '--show-toplevel'], dir) ?? dir;

  return {
    projectHash: hashString(remoteUrl),
    remoteUrl,
    branch,
    rootDir,
  };
}
