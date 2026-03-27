#!/usr/bin/env node
// Hook: cost-tracker | Trigger: Stop (*)
// Purpose: Calculate and persist session token costs
// Note: Claude Code Stop hook does NOT send token data (GitHub Issue #24459).
// Workaround: estimate tokens from transcript_path JSONL (~4 chars per token).
import fs from "node:fs";
import { parseStdin } from "./parse-stdin.js";

function estimateTokensFromTranscript(transcriptPath) {
  try {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;
    const content = fs.readFileSync(transcriptPath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);

    let inputChars = 0;
    let outputChars = 0;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const role = entry.role ?? entry.type ?? "";
        const text =
          typeof entry.content === "string"
            ? entry.content
            : JSON.stringify(entry.content ?? "");

        if (role === "user" || role === "system") {
          inputChars += text.length;
        } else if (role === "assistant") {
          outputChars += text.length;
        }
      } catch {
        /* skip malformed lines */
      }
    }

    // Adaptive estimation: code-heavy content ~3 chars/token, prose ~4 chars/token
    const allText = content;
    const codeChars = (allText.match(/[{}\[\]();=]/g) ?? []).length;
    const codeRatio = allText.length > 0 ? codeChars / allText.length : 0;
    const charsPerToken = codeRatio > 0.05 ? 3.0 : 4.0;
    return {
      inputTokens: Math.ceil(inputChars / charsPerToken),
      outputTokens: Math.ceil(outputChars / charsPerToken),
    };
  } catch {
    return null;
  }
}

async function main() {
  try {
    const input = parseStdin();
    const sid = input.session_id ?? "";
    if (!sid) process.exit(0);

    // Primary: check if Claude Code sent token data (future-proof)
    let inputTokens =
      input.usage?.input_tokens ?? input.total_input_tokens ?? 0;
    let outputTokens =
      input.usage?.output_tokens ?? input.total_output_tokens ?? 0;
    let model = input.model ?? input.display_name ?? "opus";
    let estimated = false;

    // Fallback: estimate from transcript if no token data
    if (!inputTokens && !outputTokens && input.transcript_path) {
      const estimate = estimateTokensFromTranscript(input.transcript_path);
      if (estimate) {
        inputTokens = estimate.inputTokens;
        outputTokens = estimate.outputTokens;
        estimated = true;
      }
    }

    if (!inputTokens && !outputTokens) process.exit(0);

    try {
      const { openDb, insertCostEvent, upsertSession, getSession } =
        await import(
          new URL("../../../dist/scripts/lib/state-store.js", import.meta.url)
            .href
        );
      const { calculateCost, formatCost } = await import(
        new URL("../../../dist/scripts/lib/cost-calculator.js", import.meta.url)
          .href
      );
      await openDb(process.env.KADMON_TEST_DB || undefined);

      const cost = calculateCost(model, inputTokens, outputTokens);
      insertCostEvent({
        sessionId: sid,
        timestamp: new Date().toISOString(),
        model,
        inputTokens,
        outputTokens,
        estimatedCostUsd: cost.totalCostUsd,
      });

      const session = getSession(sid);
      if (session) {
        upsertSession({
          ...session,
          id: sid,
          totalInputTokens: (session.totalInputTokens ?? 0) + inputTokens,
          totalOutputTokens: (session.totalOutputTokens ?? 0) + outputTokens,
          estimatedCostUsd: (session.estimatedCostUsd ?? 0) + cost.totalCostUsd,
        });
      }

      const suffix = estimated ? " (estimated from transcript)" : "";
      console.log(
        `\u{1F4B0} Session cost: ${formatCost(cost.totalCostUsd)} (${model}: ${inputTokens} in, ${outputTokens} out)${suffix}`,
      );
    } catch (dbErr) {
      console.error(
        JSON.stringify({ warn: `cost-tracker db: ${dbErr.message}` }),
      );
    }
  } catch (err) {
    console.error(JSON.stringify({ error: `cost-tracker: ${err.message}` }));
  }
  process.exit(0);
}
main();
