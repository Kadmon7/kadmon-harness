#!/usr/bin/env node
// Kadmon Harness — Web Dashboard: node:http server (plan-039)
// Usage: npx tsx scripts/dashboard-web.ts
//
// Read-only, localhost-only. Serves the static UI at GET / plus two JSON
// endpoints backed by the pure builders in scripts/lib/dashboard-web-data.ts.
// No framework, no new dependencies.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import {
  buildCatalog,
  buildTelemetry,
} from "./lib/dashboard-web-data.js";
import { detectProject } from "./lib/project-detect.js";
import { openDb, closeDb } from "./lib/state-store.js";

// ─── Fixed, non-user-controlled paths ───
// scripts/dashboard-web.ts lives directly under <repoRoot>/scripts/, so one
// ".." resolves to the repo root; the index.html path never incorporates any
// request data.
const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const INDEX_HTML_PATH = path.join(
  import.meta.dirname,
  "dashboard-web",
  "index.html",
);

// ─── Port validation (Zod, fail fast on invalid input) ───

const portSchema = z.coerce.number().int().min(1024).max(65535);

function resolvePort(): number {
  const raw = process.env.KADMON_DASHBOARD_PORT ?? "4321";
  const result = portSchema.safeParse(raw);
  if (!result.success) {
    console.error(
      `Invalid KADMON_DASHBOARD_PORT="${raw}" — must be an integer 1024-65535.`,
    );
    process.exit(1);
  }
  return result.data;
}

// ─── Response helpers ───

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendNotFound(res: http.ServerResponse): void {
  sendJson(res, 404, { error: "not found" });
}

// ─── Data builder injection seam (additive) ───
// Lets tests force the catch-path (WARN 2) without a real fault-injection
// point in buildCatalog/buildTelemetry themselves. Production call sites are
// unaffected — createServer() defaults to the real builders.
export interface DashboardDataBuilders {
  buildCatalog: typeof buildCatalog;
  buildTelemetry: typeof buildTelemetry;
}

const DEFAULT_BUILDERS: DashboardDataBuilders = { buildCatalog, buildTelemetry };

// ─── Routing ───

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  rootDir: string,
  builders: DashboardDataBuilders,
): Promise<void> {
  try {
    if (req.method !== "GET") {
      sendNotFound(res);
      return;
    }

    const url = req.url ?? "/";

    if (url === "/") {
      const html = fs.readFileSync(INDEX_HTML_PATH, "utf-8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (url === "/api/catalog") {
      sendJson(res, 200, builders.buildCatalog(rootDir));
      return;
    }

    if (url === "/api/telemetry") {
      const project = detectProject(rootDir);
      const projectHash = project?.projectHash ?? "unknown";
      sendJson(res, 200, builders.buildTelemetry(projectHash));
      return;
    }

    sendNotFound(res);
  } catch (err: unknown) {
    // Log the full detail (including stack) server-side only; the response
    // NEVER carries more than a constant generic message (spektr security
    // requirement — err.message can embed absolute paths, e.g. a SQLite file
    // path under the user's home directory).
    const message = err instanceof Error ? err.message : "internal error";
    console.error(
      JSON.stringify({ error: `dashboard-web: ${message}`, stack: err instanceof Error ? err.stack : undefined }),
    );
    sendJson(res, 500, { error: "internal error" });
  }
}

/** Exported for tests — never binds or listens itself. */
export function createServer(
  rootDir: string = REPO_ROOT,
  builders: DashboardDataBuilders = DEFAULT_BUILDERS,
): http.Server {
  return http.createServer((req, res) => {
    void handleRequest(req, res, rootDir, builders);
  });
}

function formatServerErrorMessage(
  err: NodeJS.ErrnoException,
  port: number,
): string {
  if (err.code === "EADDRINUSE") {
    return `Port ${port} is already in use. Set KADMON_DASHBOARD_PORT to choose a different port, or stop whatever else is using it.`;
  }
  return `dashboard-web: server error: ${err.message}`;
}

/**
 * Exported for tests. Registers a clean one-line stderr message + exit(1) on
 * server 'error' events (e.g. EADDRINUSE from running the dashboard twice on
 * the same port) instead of letting an unhandled 'error' event crash Node
 * with a raw stack. MUST be called before server.listen().
 */
export function attachErrorHandler(
  server: http.Server,
  port: number,
  exit: (code: number) => void = process.exit,
): void {
  server.on("error", (err: NodeJS.ErrnoException) => {
    console.error(formatServerErrorMessage(err, port));
    exit(1);
  });
}

async function main(): Promise<void> {
  const port = resolvePort();
  await openDb();

  const server = createServer();
  attachErrorHandler(server, port);
  server.listen(port, "127.0.0.1", () => {
    console.log(`Kadmon dashboard: http://127.0.0.1:${port}`);
  });

  const shutdown = (): void => {
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// CLI guard (null-guard on argv[1] avoids a crash when imported by a test
// runner rather than executed directly — mirrors youtube-transcript's guard).
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((err: unknown) => {
    console.error("dashboard-web error:", err);
    process.exit(1);
  });
}
