#!/usr/bin/env node
// Hook: cost-tracker | Trigger: Stop (*)
// Purpose: Calculate and persist session token costs
import fs from 'node:fs';

async function main() {
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8'));
    const sid = input.session_id ?? '';
    if (!sid) process.exit(0);

    const inputTokens = input.usage?.input_tokens ?? input.total_input_tokens ?? 0;
    const outputTokens = input.usage?.output_tokens ?? input.total_output_tokens ?? 0;
    const model = input.model ?? input.display_name ?? 'sonnet';

    if (!inputTokens && !outputTokens) process.exit(0);

    try {
      const { openDb, insertCostEvent, upsertSession, getSession } = await import('../../../dist/scripts/lib/state-store.js');
      const { calculateCost, formatCost } = await import('../../../dist/scripts/lib/cost-calculator.js');
      await openDb();

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

      console.log(`Session cost: ${formatCost(cost.totalCostUsd)} (${model}: ${inputTokens} in, ${outputTokens} out)`);
    } catch (dbErr) {
      console.error(JSON.stringify({ warn: `cost-tracker db: ${dbErr.message}` }));
    }
  } catch (err) { console.error(JSON.stringify({ error: `cost-tracker: ${err.message}` })); }
  process.exit(0);
}
main();
