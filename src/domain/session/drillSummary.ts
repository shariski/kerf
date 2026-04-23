import type { KeystrokeEvent } from "#/domain/stats/types";

/**
 * Drill-specific before/after comparison.
 *
 * Splits a drill session's events at the midpoint and compares the
 * error rate on the drill's target characters between the first and
 * second half. This is the "did the drill do anything?" signal that
 * docs/05-information-architecture.md §4.3 calls for in the post-drill
 * summary.
 *
 * Only events whose `targetChar` is in the drill's target set count
 * toward the rate — unrelated keystrokes (spaces, filler chars that
 * snuck in from the corpus picker) are ignored. This keeps the rate
 * honest: if a user did "B drill" but got distracted and only B
 * appeared 4 times in a 200-keystroke session, the rate reflects
 * those 4 attempts, not 200.
 */

/** Minimum per-half target-char attempts for the delta to be
 * meaningful. Below this threshold, the delta is likely noise. */
export const DRILL_MIN_PER_HALF_ATTEMPTS = 3;

export type DrillRateHalf = {
  attempts: number;
  errors: number;
  /** 0-100, rounded. 0 when attempts === 0. */
  errorRatePct: number;
};

export type DrillSummary = {
  before: DrillRateHalf;
  after: DrillRateHalf;
  /** after.errorRatePct - before.errorRatePct, rounded.
   * Negative = improvement; positive = regression. */
  deltaPct: number;
  /** Event-array index at which the split happened (for repro). */
  splitIndex: number;
  /** True if either half has <DRILL_MIN_PER_HALF_ATTEMPTS target-char
   * attempts — delta is unreliable and UI should show a "too short"
   * state instead of a number. */
  insufficientData: boolean;
};

export type DrillSummaryInput = {
  events: readonly KeystrokeEvent[];
  /** Characters that count as drill-target keystrokes. For a single-
   * char drill: `["b"]`. For a bigram like "er": `["e", "r"]`.
   * For a preset like inner column: `["b","g","h","n","t","y"]`.
   * All entries should already be lowercase. */
  targetChars: readonly string[];
};

export function summarizeDrill(input: DrillSummaryInput): DrillSummary {
  const { events, targetChars } = input;
  const targetSet = new Set(targetChars.map((c) => c.toLowerCase()));
  const splitIndex = Math.floor(events.length / 2);

  const firstHalf = events.slice(0, splitIndex);
  const secondHalf = events.slice(splitIndex);

  const before = halfRate(firstHalf, targetSet);
  const after = halfRate(secondHalf, targetSet);

  return {
    before,
    after,
    deltaPct: after.errorRatePct - before.errorRatePct,
    splitIndex,
    insufficientData:
      before.attempts < DRILL_MIN_PER_HALF_ATTEMPTS || after.attempts < DRILL_MIN_PER_HALF_ATTEMPTS,
  };
}

function halfRate(
  events: readonly KeystrokeEvent[],
  targetSet: ReadonlySet<string>,
): DrillRateHalf {
  let attempts = 0;
  let errors = 0;
  for (const ev of events) {
    if (!targetSet.has(ev.targetChar.toLowerCase())) continue;
    attempts++;
    if (ev.isError) errors++;
  }
  return {
    attempts,
    errors,
    errorRatePct: attempts === 0 ? 0 : Math.round((errors / attempts) * 100),
  };
}
