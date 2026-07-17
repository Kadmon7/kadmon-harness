export interface CatalogResponse {
    agents: {
        name: string;
        model: string;
        description: string;
    }[];
    skills: {
        name: string;
        description: string;
    }[];
    commands: {
        name: string;
        description: string;
    }[];
    hookCount: number;
    testFileCount: number;
    generatedAt: string;
}
export interface TelemetryResponse {
    projectHash: string;
    instincts: {
        counts: {
            active: number;
            global: number;
            project: number;
        };
        items: {
            id: string;
            pattern: string;
            confidence: number;
            occurrences: number;
            scope: string;
            lastReinforced: string | null;
        }[];
    };
    sessions: {
        recent: {
            id: string;
            startedAt: string;
            messageCount: number;
            filesModified: number;
            costUsd: number | null;
            summary: string | null;
        }[];
        orphanCount: number;
    };
    cost: {
        byModel: {
            model: string;
            totalUsd: number;
            inputTokens: number;
            outputTokens: number;
        }[];
    };
    hookHealth: {
        hookName: string;
        avgDurationMs: number | null;
        events: number;
        blocked: number;
        budgetMs: number;
        exempt: boolean;
    }[];
    agents: {
        agentType: string;
        invocations: number;
        successRate: number | null;
        avgDurationMs: number | null;
    }[];
    generatedAt: string;
}
export declare function buildCatalog(rootDir: string): CatalogResponse;
export declare function buildTelemetry(projectHash: string): TelemetryResponse;
