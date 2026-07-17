import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createServer } from "../../scripts/dashboard-web.js";
import { openDb, closeDb } from "../../scripts/lib/state-store.js";

describe("dashboard-web server", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    await openDb(":memory:");
    server = createServer();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDb();
  });

  it("binds to 127.0.0.1", () => {
    const address = server.address() as AddressInfo;
    expect(address.address).toBe("127.0.0.1");
  });

  it("serves the HTML page on GET /", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("KADMON");
  });

  it("returns valid CatalogResponse JSON on GET /api/catalog", async () => {
    const res = await fetch(`${baseUrl}/api/catalog`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(Array.isArray(body.agents)).toBe(true);
    expect(Array.isArray(body.skills)).toBe(true);
    expect(Array.isArray(body.commands)).toBe(true);
    expect(typeof body.hookCount).toBe("number");
    expect(typeof body.testFileCount).toBe("number");
    expect(typeof body.generatedAt).toBe("string");
    // Real repo root scan — should find actual agents/skills/commands
    expect(body.agents.length).toBeGreaterThan(0);
    expect(body.skills.length).toBeGreaterThan(0);
  });

  it("returns valid TelemetryResponse JSON on GET /api/telemetry", async () => {
    const res = await fetch(`${baseUrl}/api/telemetry`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(typeof body.projectHash).toBe("string");
    expect(body.instincts.counts).toBeDefined();
    expect(Array.isArray(body.instincts.items)).toBe(true);
    expect(Array.isArray(body.sessions.recent)).toBe(true);
    expect(typeof body.sessions.orphanCount).toBe("number");
    expect(Array.isArray(body.cost.byModel)).toBe(true);
    expect(Array.isArray(body.hookHealth)).toBe(true);
    expect(Array.isArray(body.agents)).toBe(true);
    expect(typeof body.generatedAt).toBe("string");
  });

  it("returns 404 JSON for unknown routes", async () => {
    const res = await fetch(`${baseUrl}/not-a-real-route`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "not found" });
  });

  it("returns 404 JSON for non-GET methods", async () => {
    const res = await fetch(`${baseUrl}/api/catalog`, { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("never leaks a Node stack frame in a response", async () => {
    // No route in this suite is expected to throw under normal conditions;
    // this asserts the *shape* contract holds for any successful response
    // body as a smoke check against the security requirement. A dedicated
    // throw-path fixture is out of scope for a pure-http smoke test with no
    // fault injection point. Anchored to Node's actual stack-frame format
    // ("    at fn (file:line:col)") rather than a bare "at ...:N:N" — the
    // unanchored form false-positives on legitimate JSON content (e.g. an
    // ISO generatedAt timestamp like "T17:10:23" reads as ":\d+:\d+").
    const res = await fetch(`${baseUrl}/api/catalog`);
    const text = await res.text();
    expect(text).not.toMatch(/^\s*at\s+\S+\s*\(.*:\d+:\d+\)/m);
  });
});
