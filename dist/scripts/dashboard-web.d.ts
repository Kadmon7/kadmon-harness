#!/usr/bin/env node
import http from "node:http";
/** Exported for tests — never binds or listens itself. */
export declare function createServer(rootDir?: string): http.Server;
