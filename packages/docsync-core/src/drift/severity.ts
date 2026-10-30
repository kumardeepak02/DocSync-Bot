import { DriftFinding, DocSyncConfig, Severity } from "../types";

const SEVERITY_ORDER: Record<Severity, number> = { low: 1, medium: 2, high: 3 };

/** Returns true if any finding is at or above the configured blocking severity threshold. */
export function shouldBlock(findings: DriftFinding[], config: DocSyncConfig): boolean {
  const threshold = SEVERITY_ORDER[config.blockingSeverity];
  return findings.some((f) => SEVERITY_ORDER[f.severity] >= threshold);
}

export { SEVERITY_ORDER };
