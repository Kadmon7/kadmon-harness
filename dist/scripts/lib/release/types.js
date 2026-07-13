// Shared type contract for the /release command subsystem (ADR-037, plan-037).
// Type-only module — no runtime code, no test (mirrors scripts/lib/medik-checks/types.ts).
// The 4AM autonomous-routine motivation in ADR-037 is RETIRED (see the ADR Amendment
// 2026-07-13): /release is a normal human-invoked command; the idempotency + refusal
// gates below stand as engineering robustness, not unattended-execution affordances.
export {};
