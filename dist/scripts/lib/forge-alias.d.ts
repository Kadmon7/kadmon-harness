export interface AliasResolution {
    target: string;
    warn: string;
}
export declare function resolveAliasCommand(input: string): AliasResolution;
