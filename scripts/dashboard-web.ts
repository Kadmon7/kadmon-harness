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

// ─── Routing ───

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  rootDir: string,
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
      sendJson(res, 200, buildCatalog(rootDir));
      return;
    }

    if (url === "/api/telemetry") {
      const project = detectProject(rootDir);
      const projectHash = project?.projectHash ?? "unknown";
      sendJson(res, 200, buildTelemetry(projectHash));
      return;
    }

    sendNotFound(res);
  } catch (err: unknown) {
    // Log the full detail (including stack) server-side only; the response
    // never carries more than the message (spektr security requirement).
    const message = err instanceof Error ? err.message : "internal error";
    console.error(
      JSON.stringify({ error: `dashboard-web: ${message}`, stack: err instanceof Error ? err.stack : undefined }),
    );
    sendJson(res, 500, { error: message });
  }
}

/** Exported for tests — never binds or listens itself. */
export function createServer(rootDir: string = REPO_ROOT): http.Server {
  return http.createServer((req, res) => {
    void handleRequest(req, res, rootDir);
  });
}

async function main(): Promise<void> {
  const port = resolvePort();
  await openDb();

  const server = createServer();
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
