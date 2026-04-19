import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// ---- Public types ----

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

// ---- URL validation ----
//
// MEDIA_URL_RE matches every URL yt-dlp can handle in the skavenger Route A set:
// YouTube (incl. m.* mobile + youtu.be shortlinks), Vimeo, SoundCloud, Twitch
// (clips + VODs), Twitter/X videos, TikTok, Archive.org, Dailymotion. Only the
// YouTube branches capture the 11-char video ID (group 1). For non-YouTube
// matches the regex accepts the URL but group 1 is undefined — the helper
// then passes the raw URL to yt-dlp (which handles 1000+ sites natively) and
// the `videoId` field in the result carries the canonical URL as an identifier
// (ADR-016 R2: matched-but-non-YouTube URLs must reach yt-dlp, not hard-reject).

export const MEDIA_URL_RE =
  /^https?:\/\/(?:www\.|m\.)?(?:(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})|vimeo\.com\/\d+|soundcloud\.com\/[^/\s]+\/[^/\s]+|clips\.twitch\.tv\/[^/\s]+|twitch\.tv\/videos\/\d+|(?:twitter|x)\.com\/[^/\s]+\/status\/\d+|tiktok\.com\/@[^/\s]+\/video\/\d+|archive\.org\/details\/[^/\s]+|dailymotion\.com\/video\/[^/\s]+)/i;

// Deprecated alias — remove at ADR-016 review (2026-07-19). Kept for one release
// window so any external caller still importing YOUTUBE_URL_RE continues working.
export { MEDIA_URL_RE as YOUTUBE_URL_RE };

export function isMediaUrl(url: string): boolean {
  return MEDIA_URL_RE.test(url);
}

function extractVideoId(url: string): string | null {
  const match = MEDIA_URL_RE.exec(url);
  return match ? (match[1] ?? null) : null;
}

function buildCanonicalUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// ---- VTT parser ----

/**
 * Parse a WebVTT subtitle file and return plain text with:
 * - WEBVTT header removed
 * - NOTE blocks removed
 * - Cue timing lines removed
 * - Inline tags stripped (<c>, </c>, <c.class>, timestamp tags, <v Speaker>)
 * - Empty lines dropped
 * - Consecutive duplicate lines deduped
 */
export function parseVtt(content: string): string {
  const lines = content.split(/\r?\n/);
  const result: string[] = [];
  let inNoteBlock = false;
  let lastLine = "";

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    // Drop WEBVTT header (first line or any line starting with WEBVTT)
    if (raw.trimStart().startsWith("WEBVTT")) {
      continue;
    }

    // Detect NOTE block start
    if (raw.startsWith("NOTE")) {
      inNoteBlock = true;
      continue;
    }

    // End of NOTE block at blank line
    if (inNoteBlock) {
      if (raw.trim() === "") {
        inNoteBlock = false;
      }
      continue;
    }

    // Drop cue timing lines: "HH:MM:SS.mmm --> ..."
    if (/^\d{2}:\d{2}:\d{2}\.\d{3}\s+-->/.test(raw)) {
      continue;
    }

    // Strip inline tags
    let line = raw
      // Timestamp position tags: <HH:MM:SS.mmm>
      .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, "")
      // Color/class cue tags: <c.colorXXXXX> or <c>
      .replace(/<c(?:\.[^>]*)?>/g, "")
      .replace(/<\/c>/g, "")
      // Speaker voice tags: <v Speaker Name> and </v>
      .replace(/<v\s+[^>]+>/g, "")
      .replace(/<\/v>/g, "")
      // Any remaining HTML-like tags (safety net)
      .replace(/<[^>]+>/g, "");

    line = line.trim();

    if (line === "") continue;

    // Dedupe consecutive identical lines (auto-sub artifact)
    if (line === lastLine) continue;

    result.push(line);
    lastLine = line;
  }

  return result.join("\n");
}

// ---- yt-dlp check ----

function checkYtDlp(): boolean {
  try {
    execFileSync("yt-dlp", ["--version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

// ---- Language detection from VTT filename ----

/**
 * Detect language from a VTT filename like:
 *   abc12345678.en.vtt         -> "en"
 *   abc12345678.en-US.vtt      -> "en"
 *   abc12345678.es.vtt         -> "es"
 */
function detectLanguage(filename: string): string | null {
  const match = /\.([a-z]{2})(?:-[A-Z]{2})?\.vtt$/.exec(filename);
  return match ? match[1] : null;
}

// ---- Main exported function ----

export interface FetchYouTubeTranscriptOpts {
  url: string;
  language?: string;
  timeoutMs?: number;
}

export async function fetchYouTubeTranscript(
  opts: FetchYouTubeTranscriptOpts,
): Promise<YouTubeTranscriptResult> {
  // Step 1: Validate URL. If it doesn't match any Route A media host, reject.
  if (!isMediaUrl(opts.url)) {
    return { ok: false, source: "error", error: "not a recognized media url" };
  }

  // Step 2: Resolve target URL + videoId.
  //   YouTube URLs produce an 11-char video ID → reconstruct a canonical
  //   YouTube URL (strips &t=42s, &list=... etc.) and use that videoId.
  //   Non-YouTube media URLs (Vimeo/SoundCloud/Twitch/X/TikTok/Archive.org/
  //   Dailymotion) pass through to yt-dlp as-is; the URL itself serves as
  //   the videoId because there is no cross-site canonical ID format.
  const youtubeVideoId = extractVideoId(opts.url);
  const canonicalUrl =
    youtubeVideoId !== null ? buildCanonicalUrl(youtubeVideoId) : opts.url;
  const videoId = youtubeVideoId ?? opts.url;

  // Step 3: Check yt-dlp presence
  if (!checkYtDlp()) {
    return {
      ok: false,
      source: "error",
      error:
        "yt-dlp not found. Install: winget install yt-dlp (Windows) / brew install yt-dlp (macOS) / pip install yt-dlp",
    };
  }

  // Step 4: Create tempdir (never inside the repo)
  const tempdir = fs.mkdtempSync(path.join(os.tmpdir(), "skavenger-yt-"));

  try {
    // Step 5: Spawn yt-dlp
    try {
      execFileSync(
        "yt-dlp",
        [
          "--write-auto-sub",
          "--skip-download",
          "--sub-format",
          "vtt",
          "--sub-langs",
          opts.language ?? "en.*",
          "--output",
          path.join(tempdir, "%(id)s.%(ext)s"),
          "--socket-timeout",
          "30",
          "--no-warnings",
          canonicalUrl,
        ],
        {
          stdio: "pipe",
          timeout: opts.timeoutMs ?? 60_000,
        }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, source: "error", error: message };
    }

    // Step 6: Find VTT file
    const vttFile = fs
      .readdirSync(tempdir)
      .filter((f) => f.endsWith(".vtt"))[0];

    if (!vttFile) {
      return { ok: true, source: "fallback", language: null, text: null, videoId };
    }

    // Step 7: Detect language from filename
    const language = detectLanguage(vttFile);

    // Step 8: Read and parse
    const raw = fs.readFileSync(path.join(tempdir, vttFile), "utf-8");
    const text = parseVtt(raw);

    return { ok: true, source: "auto-subs", language, text, videoId };
  } finally {
    // Step 9: Cleanup
    try {
      fs.rmSync(tempdir, { recursive: true, force: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        JSON.stringify({ warning: "tempdir cleanup failed", dir: tempdir, error: message }) + "\n",
      );
    }
  }
}

// ---- CLI entry point (ESM guard) ----
// Allows: npx tsx scripts/lib/youtube-transcript.ts <url>
// Outputs JSON result to stdout; exits 0 on ok, 1 on error.
// When imported as a module this block is skipped.

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.argv[2];
  if (!url) {
    process.stderr.write("usage: youtube-transcript <url>\n");
    process.exit(1);
  }
  fetchYouTubeTranscript({ url }).then((result) => {
    process.stdout.write(JSON.stringify(result) + "\n");
    process.exit(result.ok ? 0 : 1);
  });
}
