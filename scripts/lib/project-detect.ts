import { execSync } from 'node:child_process';
import { hashString } from './utils.js';
import type { ProjectInfo } from './types.js';

function gitExec(cmd: string, cwd: string): string | null {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

export function detectProject(cwd?: string): ProjectInfo | null {
  const dir = cwd ?? process.cwd();

  const remoteUrl = gitExec('git remote get-url origin', dir);
  if (!remoteUrl) return null;

  const branch = gitExec('git branch --show-current', dir) ?? 'unknown';
  const rootDir = gitExec('git rev-parse --show-toplevel', dir) ?? dir;

  return {
    projectHash: hashString(remoteUrl),
    remoteUrl,
    branch,
    rootDir,
  };
}
