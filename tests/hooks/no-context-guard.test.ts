// Tests: no-context-guard hook
// Phase: v1 scaffold — implementation in Prompt 5
import { describe, it, expect } from 'vitest';

describe('no-context-guard', () => {
  it.todo('should block Write when no Read was performed on the file');
  it.todo('should allow Write when file was previously Read');
  it.todo('should allow Write for test files (*.test.ts, *.spec.ts)');
  it.todo('should allow Write for markdown files');
  it.todo('should allow Write when KADMON_NO_CONTEXT_GUARD=off');
  it.todo('should allow Write when another file in same directory was Read');
});
