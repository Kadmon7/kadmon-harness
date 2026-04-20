export interface LintViolation {
    file: string;
    message: string;
}
export interface LintResult {
    ok: boolean;
    filesChecked: number;
    violations: LintViolation[];
}
export interface LintOptions {
    agentsDir: string;
    skillsDir: string;
}
export declare function lintAgentFrontmatter(options: LintOptions): LintResult;
