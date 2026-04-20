import type { PatternDefinition, PatternResult } from "./types.js";
export declare function detectSequence(toolSeq: string[], before: string, after: string): number;
export declare function detectCommandSequence(lines: string[], triggerCommands: string[], followedByCommands: string[]): number;
export declare function detectFileSequencePattern(lines: string[], def: {
    editTools: string[];
    filePathGlob: string;
    followedByCommands: string[];
    withinToolCalls: number;
}): number;
export declare function detectToolArgPresencePattern(lines: string[], def: {
    toolName: string;
    metadataKey: string;
    expectedValues: string[];
}): number;
export declare function detectCluster(toolSeq: string[], tool: string, minSize: number): number;
export declare function evaluatePatterns(definitions: PatternDefinition[], toolSeq: string[], lines: string[]): PatternResult[];
export declare function loadPatternDefinitions(filePath: string): PatternDefinition[];
