import {
  MIN_ATTEMPTS_FOR_PERSONAL_BASELINE,
  PHASE_BASELINES,
} from "./baselines";
import type { ComputedStats, TransitionPhase, UserBaseline } from "./types";

/**
 * Returns the user's empirical baseline (mean error rate, keystroke
 * time, and hesitation rate) when they have at least
 * MIN_ATTEMPTS_FOR_PERSONAL_BASELINE character attempts on record.
 * Otherwise returns the phase default from PHASE_BASELINES.
 *
 * Phase switching note (02-architecture.md §4.1): when a user switches
 * phase, historical stats are kept and this function is re-invoked. If
 * they have enough data, the empirical mean is returned regardless of
 * phase; otherwise the new phase's default applies.
 */
export function computeBaseline(
  stats: ComputedStats,
  phase: TransitionPhase,
): UserBaseline {
  const totals = stats.characters.reduce(
    (acc, c) => ({
      attempts: acc.attempts + c.attempts,
      errors: acc.errors + c.errors,
      sumTime: acc.sumTime + c.sumTime,
      hesitations: acc.hesitations + c.hesitationCount,
    }),
    { attempts: 0, errors: 0, sumTime: 0, hesitations: 0 },
  );

  if (totals.attempts < MIN_ATTEMPTS_FOR_PERSONAL_BASELINE) {
    return PHASE_BASELINES[phase];
  }

  return {
    meanErrorRate: totals.errors / totals.attempts,
    meanKeystrokeTime: totals.sumTime / totals.attempts,
    meanHesitationRate: totals.hesitations / totals.attempts,
  };
}
