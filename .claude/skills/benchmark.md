---
name: benchmark
description: Measure performance baselines, detect regressions before/after a change, and compare stack alternatives — across page (Core Web Vitals), API (latency percentiles), and build (cold/HMR/test/lint times) modes. Use this skill whenever the user wants to capture a baseline, compare before/after a PR, says "is this faster", "did I make it slower", "benchmark this", "performance regression", "Core Web Vitals", "p95 latency", "build time", "page weight", or before a launch where performance targets matter. Do NOT use for one-off `console.time` debugging — that's just timing, not a baseline.
---

# Benchmark — Performance Baselines & Regression Detection

Capture a measurable baseline, then compare future runs against it. The point isn't a single number — it's the **delta** that tells you whether a change helped, hurt, or did nothing.

## When to Use

- Before and after a PR, to measure the actual performance impact (not the assumed one)
- Setting up performance baselines for a project for the first time
- When users report "it feels slow" — convert the impression into a number
- Before a launch — verify performance targets are met
- Comparing your stack against alternatives ("is `pnpm` actually faster than `npm` here?")

## Four Modes

### Mode 1 — Page Performance

Measure real browser metrics:

```
1. Navigate to each target URL
2. Record Core Web Vitals:
   - LCP (Largest Contentful Paint)        target < 2.5s
   - CLS (Cumulative Layout Shift)         target < 0.1
   - INP (Interaction to Next Paint)       target < 200ms
   - FCP (First Contentful Paint)          target < 1.8s
   - TTFB (Time to First Byte)             target < 800ms
3. Record resource sizes:
   - Total page weight                     target < 1MB
   - JS bundle (gzipped)                   target < 200KB
   - CSS size
   - Image weight
   - Third-party script weight
4. Count network requests
5. Check for render-blocking resources
```

Tools: Lighthouse CLI, Chrome DevTools Protocol, Playwright + lighthouse plugin.

### Mode 2 — API Performance

Benchmark API endpoints:

```
1. Hit each endpoint 100 times (or more)
2. Record p50, p95, p99 latency
3. Track response size and status codes
4. Test under load: 10 concurrent requests
5. Compare against the SLA target
```

Tools: `autocannon`, `k6`, `wrk`, plain `curl + hyperfine` for quick checks.

### Mode 3 — Build Performance

Measure the development feedback loop:

```
1. Cold build time           (rm -rf node_modules + install + build)
2. Hot reload time (HMR)
3. Test suite duration
4. TypeScript check time
5. Lint time
6. Docker build time          (if applicable)
```

Tools: `time`, `hyperfine` for repeatable runs, `vitest --reporter=verbose` for per-test timing.

### Mode 4 — Before/After Comparison

Run before and after a change to measure the impact:

```bash
# Save baseline before changes
benchmark baseline    # writes current metrics to a baseline file

# ... make changes ...

# Compare against baseline
benchmark compare
```

Output:

```
| Metric  | Before | After  | Delta   | Verdict  |
|---------|--------|--------|---------|----------|
| LCP     | 1.2s   | 1.4s   | +200ms  | WARN     |
| Bundle  | 180KB  | 175KB  | -5KB    | BETTER   |
| Build   | 12s    | 14s    | +2s     | WARN     |
| p95 API | 84ms   | 79ms   | -5ms    | BETTER   |
```

## Storage

Store baselines as JSON in a project-local directory (e.g., `docs/benchmarks/<date>.json`) so the team shares them. Git-track the baselines — the history is the regression record.

## Best Practices

- **Run multiple iterations** — single runs are noisy. Median of 5+ runs is the floor; mean ± stddev is better
- **Pin the environment** — same machine, same load, same time-of-day cohort. Otherwise the noise dominates the signal
- **Compare like with like** — don't compare a cold start to a warm start, or a debug build to a production build
- **Define targets up front** — "faster" is meaningless without a target. "p95 < 100ms" is a target
- **Track trends, not single points** — one regression is noise; three in a row is a pattern
- **Bundle the result with the PR** — make the comparison part of the change, not a separate investigation

## Anti-Patterns

- **Benchmarking once and trusting the number** — single runs lie; variance is real
- **Optimizing the wrong metric** — improving p50 while p99 explodes hurts users more than it helps
- **Ignoring the warm-up effect** — JIT, caches, and CDNs make first runs unrepresentative
- **Reporting deltas without baselines** — "10% faster" against what?
- **Benchmarking on the dev machine while it's also doing other work** — close everything else first

## CI Integration

Wire benchmarks into the PR workflow:

```yaml
# .github/workflows/benchmark.yml
- run: benchmark baseline --from main
- run: benchmark compare --against baseline
- name: Fail if any metric regressed > 10%
  run: benchmark gate --threshold 10
```

This catches the common case where an "obvious improvement" actually slowed something down.

## Integration

- **arkonte agent** (sonnet) — primary owner. arkonte is the harness's performance specialist; this skill is the measurement playbook arkonte uses when the question is "did this change actually make it faster, and by how much".
- **context-budget skill** — sibling for context-window measurement. `context-budget` measures token cost; `benchmark` measures wall-clock and resource cost. Together they cover both axes of "what does this cost".
- **token-budget-advisor skill** — complementary on the response side. Use `benchmark` for code performance, `token-budget-advisor` for response-size choices.
- **/skanner command** — entry point. arkonte loads this skill during the perf-profiling phase of `/skanner`, when the assessment needs concrete numbers rather than impressions.

## no_context Application

Every benchmark claim must rest on a recorded run, not a memory or an estimate. Before saying "this PR makes the bundle smaller", produce the before/after numbers from real runs — `gzip -c dist/main.js | wc -c` for both, captured with the actual build pipeline. "It feels faster" is not evidence; "p95 dropped from 84ms to 79ms across 100 runs on the staging environment" is. The `no_context` principle here is unusually strict because performance claims propagate — if you say "5% faster" without measurements, downstream decisions get made on phantom data.
