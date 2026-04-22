import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isOrphanStale } from "../../scripts/lib/orphan-staleness.js";

const TMP_ROOT = path.join(os.tmpdir(), `kadmon-orphan-test-${Date.now()}`);

function obsPathFor(sessionId: string): string {
  return path.join(TMP_ROOT, "kadmon", sessionId, "observations.jsonl");
}

function seedObs(sessionId: string, mtimeMs: number): void {
  const p = obsPathFor(sessionId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, "");
  const mtime = new Date(mtimeMs);
  fs.utimesSync(p, mtime, mtime);
}

describe("isOrphanStale (ADR-022 Bug 2)", () => {
  beforeEach(() => {
    fs.mkdirSync(TMP_ROOT, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  });

  it("returns false when observations.jsonl mtime is fresh (< 5 min)", () => {
    const sid = "sess-fresh";
    seedObs(sid, Date.now() - 60_000); // 1 minute ago
    const result = isOrphanStale(sid, {
      startedAt: new Date(Date.now() - 120_000).toISOString(),
      tmpRoot: TMP_ROOT,
    });
    expect(result).toBe(false);
  });

  it("returns true when observations.jsonl mtime is stale (> 5 min)", () => {
    const sid = "sess-stale";
    seedObs(sid, Date.now() - 10 * 60_000); // 10 minutes ago
    const result = isOrphanStale(sid, {
      startedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
      tmpRoot: TMP_ROOT,
    });
    expect(result).toBe(true);
  });

  it("falls back to startedAt when observations.jsonl is absent — recovers old session", () => {
    const sid = "sess-no-obs-old";
    const result = isOrphanStale(sid, {
      startedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      tmpRoot: TMP_ROOT,
    });
    expect(result).toBe(true);
  });

  it("falls back to startedAt when observations.jsonl is absent — keeps fresh session", () => {
    const sid = "sess-no-obs-fresh";
    const result = isOrphanStale(sid, {
      startedAt: new Date(Date.now() - 60_000).toISOString(),
      tmpRoot: TMP_ROOT,
    });
    expect(result).toBe(false);
  });

  it("honors KADMON_ORPHAN_STALE_MS env override", () => {
    const sid = "sess-env";
    seedObs(sid, Date.now() - 90_000); // 90s ago
    const original = process.env.KADMON_ORPHAN_STALE_MS;
    try {
      process.env.KADMON_ORPHAN_STALE_MS = "60000"; // 60s threshold
      const result = isOrphanStale(sid, {
        startedAt: new Date(Date.now() - 120_000).toISOString(),
        tmpRoot: TMP_ROOT,
      });
      expect(result).toBe(true);
    } finally {
      if (original === undefined) {
        delete process.env.KADMON_ORPHAN_STALE_MS;
      } else {
        process.env.KADMON_ORPHAN_STALE_MS = original;
      }
    }
  });

  it("returns true when startedAt is invalid (defensive fallback)", () => {
    const sid = "sess-bad-start";
    const result = isOrphanStale(sid, {
      startedAt: "not-a-date",
      tmpRoot: TMP_ROOT,
    });
    expect(result).toBe(true);
  });

  it("rejects path-traversal sessionIds (spektr 2026-04-22 MEDIUM)", () => {
    const result = isOrphanStale("../../../etc/passwd", {
      startedAt: new Date(Date.now() - 60_000).toISOString(),
      tmpRoot: TMP_ROOT,
    });
    expect(result).toBe(true);
  });

  it("caps KADMON_ORPHAN_STALE_MS at 24h to prevent runaway values", () => {
    const sid = "sess-runaway";
    seedObs(sid, Date.now() - 25 * 60 * 60 * 1000); // 25h ago
    const original = process.env.KADMON_ORPHAN_STALE_MS;
    try {
      // Huge value — should be clamped to 24h, so 25h-old session is still stale
      process.env.KADMON_ORPHAN_STALE_MS = "99999999999";
      const result = isOrphanStale(sid, {
        startedAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
        tmpRoot: TMP_ROOT,
      });
      expect(result).toBe(true);
    } finally {
      if (original === undefined) {
        delete process.env.KADMON_ORPHAN_STALE_MS;
      } else {
        process.env.KADMON_ORPHAN_STALE_MS = original;
      }
    }
  });
});
