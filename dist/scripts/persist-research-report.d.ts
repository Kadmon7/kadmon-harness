import { z } from "zod";
import type { ResearchReport } from "./lib/types.js";
declare const PersistReportInputSchema: z.ZodObject<{
    sessionId: z.ZodString;
    projectHash: z.ZodString;
    topic: z.ZodString;
    slug: z.ZodString;
    subQuestions: z.ZodArray<z.ZodString, "many">;
    sourcesCount: z.ZodNumber;
    confidence: z.ZodOptional<z.ZodEnum<["High", "Medium", "Low"]>>;
    capsHit: z.ZodArray<z.ZodString, "many">;
    openQuestions: z.ZodArray<z.ZodString, "many">;
    summary: z.ZodOptional<z.ZodString>;
    bodyMarkdown: z.ZodString;
    untrustedSources: z.ZodBoolean;
    derivedFrom: z.ZodOptional<z.ZodString>;
    mode: z.ZodOptional<z.ZodEnum<["verify"]>>;
}, "strip", z.ZodTypeAny, {
    projectHash: string;
    sessionId: string;
    slug: string;
    topic: string;
    capsHit: string[];
    subQuestions: string[];
    sourcesCount: number;
    openQuestions: string[];
    untrustedSources: boolean;
    bodyMarkdown: string;
    summary?: string | undefined;
    confidence?: "High" | "Medium" | "Low" | undefined;
    derivedFrom?: string | undefined;
    mode?: "verify" | undefined;
}, {
    projectHash: string;
    sessionId: string;
    slug: string;
    topic: string;
    capsHit: string[];
    subQuestions: string[];
    sourcesCount: number;
    openQuestions: string[];
    untrustedSources: boolean;
    bodyMarkdown: string;
    summary?: string | undefined;
    confidence?: "High" | "Medium" | "Low" | undefined;
    derivedFrom?: string | undefined;
    mode?: "verify" | undefined;
}>;
export type PersistReportInput = z.infer<typeof PersistReportInputSchema>;
export interface PersistReportResult {
    skipped?: true;
    reportNumber?: number;
    path?: string;
    report?: ResearchReport;
}
export interface PersistReportOptions {
    /** Repository root — defaults to process.cwd(). Tests override to a tmpdir. */
    repoRoot?: string;
}
export declare function runPersistReport(input: PersistReportInput, options?: PersistReportOptions): Promise<PersistReportResult>;
export {};
