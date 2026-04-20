import type { SessionSummary, ProjectInfo } from "./types.js";
export declare function startSession(sessionId: string, projectInfo: ProjectInfo): SessionSummary;
export declare function endSession(sessionId: string, updates: Partial<SessionSummary>): SessionSummary | null;
export declare function getLastSession(projectHash: string): SessionSummary | null;
