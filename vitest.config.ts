import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // tsc compiles tests/ into dist/tests/ as part of the build pipeline.
    // Vitest 4 changed its default exclude list and no longer skips dist/
    // automatically, so the compiled copies get picked up as duplicate tests.
    // Explicit exclude restores the vitest 2 behavior.
    exclude: ["**/node_modules/**", "**/.git/**", "dist/**"],
    // Hook tests spawn Node subprocesses (tsc, build, session hooks). Under
    // vitest 4's more aggressive default parallelism, subprocess-heavy tests
    // contend for CPU and exceed the 5s default. 20s gives enough headroom
    // for the slowest path (full rebuild of dist/ in ensure-dist.test.ts).
    testTimeout: 20000,
    env: {
      // Safety net: ensure no test accidentally writes to the production DB.
      // Hook tests (spawned processes) must still pass KADMON_TEST_DB explicitly
      // via execFileSync env, but this catches in-process imports of state-store.
      KADMON_TEST_DB: ":memory:",
    },
    globalTeardown: ["tests/global-teardown.ts"],
  },
});
