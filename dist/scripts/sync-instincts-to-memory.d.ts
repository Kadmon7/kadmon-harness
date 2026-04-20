#!/usr/bin/env node
export declare function syncInstinctsToMemory(cwd?: string): Promise<{
    synced: number;
    memoryDir: string;
}>;
