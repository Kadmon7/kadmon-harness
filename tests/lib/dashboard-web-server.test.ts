import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import {
  createServer,
  attachErrorHandler,
  isAllowedHost,
} from "../../scripts/dashboard-web.js";
import { openDb, closeDb } from "../../scripts/lib/state-store.js";

// fetch() (undici) treats Host as a forbidden header and silently ignores any
// override, so the host-allowlist tests drive node:http directly. `omitHost`
// uses Node's `setHost: false` to suppress the automatic Host header entirely.
function rawGet(
  port: number,
  requestPath: string,
  options: { host?: string; omitHost?: boolean } = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: requestPath,
        method: "GET",
        setHost: options.omitHost ? false : undefined,
        headers: options.host !== undefined ? { Host: options.host } : {},
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => (body += chunk.toString()));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

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

  it("returns a generic 500 body without leaking err.message details (WARN 2)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const throwingBuilders = {
      buildCatalog: () => {
        throw new Error("boom at C:\\Users\\fake\\secret.db");
      },
      buildTelemetry: () => {
        throw new Error("unused");
      },
    };
    const errServer = createServer("unused-root", throwingBuilders);
    await new Promise<void>((resolve) => {
      errServer.listen(0, "127.0.0.1", resolve);
    });
    const errAddress = errServer.address() as AddressInfo;
    const errBaseUrl = `http://127.0.0.1:${errAddress.port}`;

    try {
      const res = await fetch(`${errBaseUrl}/api/catalog`);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: "internal error" });
      const raw = JSON.stringify(body);
      expect(raw).not.toContain("C:\\");
      expect(raw).not.toContain("secret.db");
    } finally {
      await new Promise<void>((resolve) => errServer.close(() => resolve()));
      errorSpy.mockRestore();
    }
  });
});

describe("dashboard-web host-header allowlist (DNS-rebinding guard)", () => {
  let server: Server;
  let port: number;

  beforeEach(async () => {
    await openDb(":memory:");
    server = createServer();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDb();
  });

  it.each([
    "127.0.0.1",
    "localhost",
    "[::1]",
  ])("allows Host %s without a port", async (host) => {
    const res = await rawGet(port, "/", { host });
    expect(res.status).toBe(200);
  });

  it.each([
    "127.0.0.1:4321",
    "localhost:4321",
    "[::1]:4321",
  ])("allows Host %s with a port", async (host) => {
    const res = await rawGet(port, "/", { host });
    expect(res.status).toBe(200);
  });

  it.each([
    "evil.com",
    "evil.com:4321",
  ])("rejects hostile Host %s with 403 before routing", async (host) => {
    // /api/catalog (a real route) — the guard must fire before routing, so a
    // hostile Host never reaches a data builder.
    const res = await rawGet(port, "/api/catalog", { host });
    expect(res.status).toBe(403);
    expect(JSON.parse(res.body)).toEqual({ error: "forbidden" });
  });

  it("rejects a request with no Host header at all", async () => {
    // Node's http server itself rejects Host-less HTTP/1.1 requests with a
    // built-in 400 (requireHostHeader, RFC 7230 §5.4) before handleRequest
    // ever runs, so the observable status is 400 — still a rejection. The
    // isAllowedHost(undefined) === false unit case below keeps the guard
    // fail-closed as defense in depth if that server default ever changes.
    const res = await rawGet(port, "/", { omitHost: true });
    expect(res.status).toBe(400);
  });
});

describe("isAllowedHost — parsing edge cases", () => {
  it.each([
    ["127.0.0.1", true],
    ["127.0.0.1:65535", true],
    ["localhost", true],
    ["LOCALHOST", true], // Host header hostnames are case-insensitive
    ["localhost:4321", true],
    ["[::1]", true],
    ["[::1]:4321", true], // IPv6 + port — a naive split(":") mangles this
    ["evil.com", false],
    ["evil.com:4321", false],
    ["127.0.0.1.evil.com", false], // prefix-spoof
    ["localhost.evil.com", false],
    ["localhost.", false], // trailing dot — fail closed
    ["user@evil.com", false], // userinfo trick must not mask the real host
    ["localhost:notaport", false], // malformed — fail closed
    ["::1", false], // unbracketed IPv6 is not a valid Host header — fail closed
    ["", false],
    [undefined, false],
  ])("isAllowedHost(%j) === %s", (host, expected) => {
    expect(isAllowedHost(host as string | undefined)).toBe(expected);
  });
});

describe("dashboard-web server error handler (WARN 1)", () => {
  it("attaches a clean stderr message + exit(1) on EADDRINUSE instead of an unhandled throw", async () => {
    // server1 occupies an ephemeral port first.
    const server1 = createServer();
    await new Promise<void>((resolve) => {
      server1.listen(0, "127.0.0.1", resolve);
    });
    const port = (server1.address() as AddressInfo).port;

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const server2 = createServer();
    let exitCode: number | undefined;
    const exitSpy = vi.fn((code: number) => {
      exitCode = code;
    });

    // Registered BEFORE listen() — the contract under test.
    attachErrorHandler(server2, port, exitSpy);

    await new Promise<void>((resolve) => {
      server2.on("error", () => resolve());
      server2.listen(port, "127.0.0.1");
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(exitCode).toBe(1);
    const messages = errorSpy.mock.calls.map((call) => String(call[0]));
    expect(messages.some((m) => m.includes("already in use"))).toBe(true);
    expect(messages.some((m) => m.includes("KADMON_DASHBOARD_PORT"))).toBe(true);

    errorSpy.mockRestore();
    await new Promise<void>((resolve) => server1.close(() => resolve()));
    // server2 never bound successfully, nothing to close.
  });
});
