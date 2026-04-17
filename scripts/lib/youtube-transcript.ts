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

const YOUTUBE_URL_RE =
  /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/;

function extractVideoId(url: string): string | null {
  const match = YOUTUBE_URL_RE.exec(url);
  return match ? match[3] : null;
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
  // Step 1: Validate URL and extract videoId
  const videoId = extractVideoId(opts.url);
  if (videoId === null) {
    return { ok: false, source: "error", error: "not a youtube url" };
  }

  // Step 2: Reconstruct canonical URL (strips &t=42s, &list=... etc.)
  const canonicalUrl = buildCanonicalUrl(videoId);

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
