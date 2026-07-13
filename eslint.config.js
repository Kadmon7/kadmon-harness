import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["scripts/**/*.ts", "tests/**/*.ts"],
    // AUD-39: intentionally NO `parserOptions.projectService` — EVERY active
    // rule against these files is non-type-aware: the two configured in this
    // block (`no-unused-vars`, `no-explicit-any`) plus every rule
    // `tseslint.configs.recommended` contributes (ban-ts-comment,
    // no-array-constructor, no-empty-object-type, …) are all purely syntactic
    // (the preset is plain `recommended`, not `recommendedTypeChecked`), so
    // spinning up the full TS type-checker on every run bought zero coverage
    // while costing ~2s per invocation. That
    // cost is felt hardest by the per-edit `quality-gate` hook, which lints
    // one file on every Edit/Write. `tseslint.configs.recommended` still
    // supplies the TS parser for AST parsing — only type-info is skipped.
    // If a type-aware rule (e.g. `no-floating-promises`) is ever added here,
    // re-introduce `projectService: true` + `tsconfigRootDir` at that time
    // and accept the latency for the files it governs.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    ignores: [
      "dist/",
      "node_modules/",
      ".claude/",
      "graphify-out/",
      "*.js",
      "!eslint.config.js",
    ],
  },
);
