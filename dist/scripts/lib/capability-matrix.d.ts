export interface AgentEntry {
    name: string;
    filePath: string;
    tools: string[];
    skills: string[];
    model: string;
}
export interface SkillEntry {
    name: string;
    filePath: string;
    declaredOwner?: string;
    requiresTools: string[];
    heuristicTools: string[];
    isCommandLevel: boolean;
}
export interface CommandEntry {
    name: string;
    filePath: string;
    skills: string[];
    agents: string[];
}
export type ParseError = {
    error: string;
};
export declare function parseAgentFrontmatter(content: string, filePath: string): AgentEntry | ParseError;
export declare function parseSkillFrontmatter(content: string, filePath: string): SkillEntry | ParseError;
export declare function scanHeuristicTools(skillBody: string): string[];
export declare function parseCommandLevelSkillsTable(agentsMdContent: string): Set<string>;
export interface CapabilityMatrix {
    agents: AgentEntry[];
    skills: SkillEntry[];
    commands: CommandEntry[];
    commandLevelSkills: Set<string>;
    parseErrors: string[];
}
export declare function buildCapabilityMatrix(ctx: {
    cwd: string;
}): CapabilityMatrix;
export type ViolationKind = "capability-mismatch" | "ownership-drift" | "path-drift" | "command-skill-drift" | "orphan-skill" | "heuristic-tool-mismatch";
export interface Violation {
    kind: ViolationKind;
    severity: "FAIL" | "WARN" | "NOTE";
    subject: string;
    message: string;
    evidence: string;
}
export declare function findViolations(matrix: CapabilityMatrix): Violation[];
