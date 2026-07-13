interface WrappedDb {
    exec(sql: string): void;
    pragma(pragmaStr: string): void;
    prepare(sql: string): {
        all(...args: unknown[]): Record<string, unknown>[];
        get(...args: unknown[]): Record<string, unknown> | null;
        run(params?: Record<string, unknown>): void;
    };
    transaction<T>(fn: (...args: unknown[]) => T): (...args: unknown[]) => T;
    close(): void;
}
export declare function openDb(customPath?: string): Promise<WrappedDb>;
export declare function getDb(): WrappedDb;
export declare function closeDb(): void;
export declare function parseJson<T>(val: unknown, fallback: T): T;
export {};
