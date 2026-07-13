import { defineConfig } from "vitest/config";

// AUD-34: these files spawn real Node subprocesses via execFileSync AND
// perform full sql.js DB file rewrites (db.export() + writeFileSync) on
// every test. When several of them land in different parallel Vitest
// worker processes at once, they contend for CPU/disk on Windows and
// produce intermittent timeouts/assertion failures (AUD-21 triage) that
// always pass in isolation. Verified by reproducing the flake twice on
// the unmodified config (6 failed files / 19 failed tests on one run)
// before this list was carved out into its own single-worker project.
// Identified via `grep execFileSync` ∩ `grep initSqlJs` across tests/.
const HEAVY_HOOK_TESTS = [
  "tests/hooks/pre-compact-save.test.ts",
  "tests/hooks/session-end-all.test.ts",
  "tests/hooks/session-start.test.ts",
  "tests/hooks/evaluate-patterns-shared.test.ts",
  "tests/eval/phase1b-workflows-e2e.test.ts",
];

const BASE_EXCLUDE = ["**/node_modules/**", "**/.git/**", "dist/**"];

export default defineConfig({
  test: {
    // tsc compiles tests/ into dist/tests/ as part of the build pipeline.
    // Vitest 4 changed its default exclude list and no longer skips dist/
    // automatically, so the compiled copies get picked up as duplicate tests.
    // Explicit exclude restores the vitest 2 behavior.
    exclude: BASE_EXCLUDE,
    // Hook tests spawn Node subprocesses (tsc, build, session hooks). Under
    // vitest 4's more aggressive default parallelism, subprocess-heavy tests
    // contend for CPU and exceed the 5s default. 60s accommodates the slowest
    // paths: ensure-dist full rebuild + install-sh's 11 `npx tsx install-apply.ts`
    // invocations running concurrently (plan-010 Phase 4 + plan-019).
    testTimeout: 60000,
    env: {
      // Safety net: ensure no test accidentally writes to the production DB.
      // Hook tests (spawned processes) must still pass KADMON_TEST_DB explicitly
      // via execFileSync env, but this catches in-process imports of state-store.
      KADMON_TEST_DB: ":memory:",
    },
    globalTeardown: ["tests/global-teardown.ts"],
    // AUD-34: split into two projects so the heavy hook tests above run in
    // a single serialized worker (never concurrently with each other) while
    // everything else keeps full parallelism. `extends: true` inherits all
    // root-level settings (env, testTimeout, globalTeardown) into both
    // projects — only `include`/`exclude`/`fileParallelism` differ.
    // NOTE: once `projects` is set, Vitest only runs the projects listed
    // here — there is no implicit "root" project — so both lanes must be
    // declared explicitly.
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          exclude: [...BASE_EXCLUDE, ...HEAVY_HOOK_TESTS],
        },
      },
      {
        extends: true,
        test: {
          name: "hooks-serial",
          include: HEAVY_HOOK_TESTS,
          // Forces this project's own maxWorkers to 1 — its files run one
          // at a time instead of racing each other for CPU/disk. Does not
          // reduce parallelism of the "unit" project above.
          fileParallelism: false,
        },
      },
    ],
  },
});
