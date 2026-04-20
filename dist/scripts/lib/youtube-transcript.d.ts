export interface YouTubeTranscriptOk {
    ok: true;
    source: "auto-subs" | "manual" | "fallback";
    language: string | null;
    text: string | null;
    videoId: string;
}
export interface YouTubeTranscriptErr {
    ok: false;
    source: "error";
    error: string;
}
export type YouTubeTranscriptResult = YouTubeTranscriptOk | YouTubeTranscriptErr;
export declare const MEDIA_URL_RE: RegExp;
export { MEDIA_URL_RE as YOUTUBE_URL_RE };
export declare function isMediaUrl(url: string): boolean;
/**
 * Parse a WebVTT subtitle file and return plain text with:
 * - WEBVTT header removed
 * - NOTE blocks removed
 * - Cue timing lines removed
 * - Inline tags stripped (<c>, </c>, <c.class>, timestamp tags, <v Speaker>)
 * - Empty lines dropped
 * - Consecutive duplicate lines deduped
 */
export declare function parseVtt(content: string): string;
export interface FetchYouTubeTranscriptOpts {
    url: string;
    language?: string;
    timeoutMs?: number;
}
export declare function fetchYouTubeTranscript(opts: FetchYouTubeTranscriptOpts): Promise<YouTubeTranscriptResult>;
