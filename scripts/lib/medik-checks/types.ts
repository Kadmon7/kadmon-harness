// Kadmon Harness — /medik check shared types (plan-028 Phase 4)

export type CheckStatus = "PASS" | "NOTE" | "WARN" | "FAIL";
export type CheckCategory =
  | "core"
  | "runtime"
  | "code-hygiene"
  | "knowledge-hygiene";

export interface CheckContext {
  projectHash: string;
  cwd: string;
}

export interface CheckResult {
  status: CheckStatus;
  category: CheckCategory;
  message: string;
  details?: unknown;
}
