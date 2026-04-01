import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      // Safety net: ensure no test accidentally writes to the production DB.
      // Hook tests (spawned processes) must still pass KADMON_TEST_DB explicitly
      // via execFileSync env, but this catches in-process imports of state-store.
      KADMON_TEST_DB: ":memory:",
    },
    globalTeardown: ["tests/global-teardown.ts"],
  },
});
