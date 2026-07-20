#!/usr/bin/env node
import http from "node:http";
import { buildCatalog, buildTelemetry } from "./lib/dashboard-web-data.js";
/** Exported for tests. Fail-closed: missing or unparseable Host → false. */
export declare function isAllowedHost(hostHeader: string | undefined): boolean;
export interface DashboardDataBuilders {
    buildCatalog: typeof buildCatalog;
    buildTelemetry: typeof buildTelemetry;
}
/** Exported for tests — never binds or listens itself. */
export declare function createServer(rootDir?: string, builders?: DashboardDataBuilders): http.Server;
/**
 * Exported for tests. Registers a clean one-line stderr message + exit(1) on
 * server 'error' events (e.g. EADDRINUSE from running the dashboard twice on
 * the same port) instead of letting an unhandled 'error' event crash Node
 * with a raw stack. MUST be called before server.listen().
 */
export declare function attachErrorHandler(server: http.Server, port: number, exit?: (code: number) => void): void;
