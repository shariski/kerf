import type { FingerTable } from "#/domain/finger/types";
import type { KeystrokeEvent } from "#/domain/stats/types";
import { classifyMechanism, type MechanismKey } from "./mechanisms";

export type MechanismPerformance = {
  mechanism: MechanismKey;
  attempts: number;
  errors: number;
  errorRate: number;
};

/**
 * Per-mechanism error rates for a session's events. Each transition
 * (prevChar -> targetChar) is classified by finger mechanics; errors are
 * counted per class. Used for the post-session evaluation stage.
 */
export function computeMechanismPerformance(
  events: KeystrokeEvent[],
  fingerTable: FingerTable,
): MechanismPerformance[] {
  const attempts = new Map<MechanismKey, number>();
  const errors = new Map<MechanismKey, number>();

  for (const e of events) {
    if (!e.prevChar) continue;
    const mechanism = classifyMechanism(e.prevChar, e.targetChar, fingerTable);
    if (!mechanism) continue;
    attempts.set(mechanism, (attempts.get(mechanism) ?? 0) + 1);
    if (e.isError) errors.set(mechanism, (errors.get(mechanism) ?? 0) + 1);
  }

  return [...attempts.entries()]
    .map(([mechanism, n]) => ({
      mechanism,
      attempts: n,
      errors: errors.get(mechanism) ?? 0,
      errorRate: n > 0 ? Math.round(((errors.get(mechanism) ?? 0) / n) * 1000) / 1000 : 0,
    }))
    .sort((a, b) => b.errors - a.errors);
}
