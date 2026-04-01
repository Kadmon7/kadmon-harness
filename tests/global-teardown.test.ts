import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import globalTeardown from "./global-teardown.js";

describe("global-teardown", () => {
  // Use an isolated directory so we don't conflict with parallel tests
  const testBase = path.join(os.tmpdir(), `kadmon-teardown-test-${Date.now()}`);
  const testDirs: string[] = [];

  function createTestDir(name: string): string {
    const dir = path.join(testBase, name);
    fs.mkdirSync(dir, { recursive: true });
    testDirs.push(dir);
    return dir;
  }

  beforeEach(() => {
    fs.mkdirSync(testBase, { recursive: true });
  });

  afterEach(() => {
    for (const dir of testDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    testDirs.length = 0;
    try {
      fs.rmSync(testBase, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("removes test-isolation-* directories", () => {
    const dir = createTestDir(`test-isolation-${Date.now()}`);
    expect(fs.existsSync(dir)).toBe(true);

    globalTeardown(testBase);

    expect(fs.existsSync(dir)).toBe(false);
  });

  it("removes test-* directories (other test prefixes)", () => {
    const dir = createTestDir("test-read");
    expect(fs.existsSync(dir)).toBe(true);

    globalTeardown(testBase);

    expect(fs.existsSync(dir)).toBe(false);
  });

  it("does NOT remove UUID session directories", () => {
    const dir = createTestDir("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    expect(fs.existsSync(dir)).toBe(true);

    globalTeardown(testBase);

    expect(fs.existsSync(dir)).toBe(true);
  });

  it("does NOT remove non-test prefixed directories", () => {
    const dir = createTestDir("some-other-dir");
    expect(fs.existsSync(dir)).toBe(true);

    globalTeardown(testBase);

    expect(fs.existsSync(dir)).toBe(true);
  });

  it("handles missing directory gracefully", () => {
    const nonExistent = path.join(os.tmpdir(), `kadmon-no-exist-${Date.now()}`);
    expect(() => globalTeardown(nonExistent)).not.toThrow();
  });
});
