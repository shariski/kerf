import type { SplitMetricsSnapshot } from "../metrics/types";
import type { TransitionPhase } from "../stats/types";

/**
 * Phase transition auto-suggestion per 02-architecture.md §4.6.
 *
 * The platform *suggests* a phase change; the user keeps control in
 * settings (§539). This function is a pure read-side advisory — no side
 * effects, no persistence, no surface-level concerns like "already
 * dismissed this week".
 *
 * Two directions:
 *
 *   - transitioning → refining: graduation after sustained high
 *     accuracy (≥ 95%) AND low inner-column error (< 8%) across the
 *     last SESSION_HISTORY_REQUIRED sessions. Confidence: high.
 *
 *   - refining → transitioning: re-entry after a long break (> 14 days)
 *     with an accuracy drop (< 88%) in the first 3 sessions back.
 *     Confidence: medium — the evidence window is narrow.
 *
 * Returns `null` when no suggestion is warranted or when the caller's
 * input is too sparse or misaligned to support one (fail closed).
 */

export const SESSION_HISTORY_REQUIRED = 10;
export const ACCURACY_GRADUATION_THRESHOLD = 0.95;
export const INNER_COL_ERROR_GRADUATION_THRESHOLD = 0.08;
export const BREAK_DAYS_THRESHOLD = 14;
export const BREAK_RETURN_SESSION_COUNT = 3;
export const BREAK_ACCURACY_DROP_THRESHOLD = 0.88;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type PhaseTransitionSignal = {
  suggestedPhase: TransitionPhase;
  reason: string;
  confidence: "low" | "medium" | "high";
};

export type PhaseSuggestionInput = {
  currentPhase: TransitionPhase;
  lastSessionAt?: Date;
  recentSessions: readonly { accuracy: number }[];
  recentSnapshots: readonly SplitMetricsSnapshot[];
  now?: Date;
};

const mean = (xs: readonly number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;

const daysBetween = (a: Date, b: Date): number =>
  Math.abs(b.getTime() - a.getTime()) / MS_PER_DAY;

function checkGraduation(
  input: PhaseSuggestionInput,
): PhaseTransitionSignal | null {
  const { recentSessions, recentSnapshots } = input;

  const last10Sessions = recentSessions.slice(-SESSION_HISTORY_REQUIRED);
  const last10Snapshots = recentSnapshots.slice(-SESSION_HISTORY_REQUIRED);
  if (last10Sessions.length < SESSION_HISTORY_REQUIRED) return null;

  const avgAccuracy = mean(last10Sessions.map((s) => s.accuracy));
  if (avgAccuracy < ACCURACY_GRADUATION_THRESHOLD) return null;

  // Noisy sub-50-keystroke sessions shouldn't tank the inner-col average.
  const usableSnapshots = last10Snapshots.filter((s) => !s.insufficientData);
  if (usableSnapshots.length === 0) return null;
  const avgInnerColError = mean(
    usableSnapshots.map((s) => s.innerColErrorRate),
  );
  if (avgInnerColError >= INNER_COL_ERROR_GRADUATION_THRESHOLD) return null;

  return {
    suggestedPhase: "refining",
    reason:
      "Your accuracy has been above 95% for 10 sessions, and inner column error rate is below 8%. Ready to shift focus from muscle memory to speed & flow?",
    confidence: "high",
  };
}

function checkBreakReturn(
  input: PhaseSuggestionInput,
): PhaseTransitionSignal | null {
  const { lastSessionAt, recentSessions, now = new Date() } = input;
  if (!lastSessionAt) return null;

  const daysSince = daysBetween(lastSessionAt, now);
  if (daysSince <= BREAK_DAYS_THRESHOLD) return null;

  const last3 = recentSessions.slice(-BREAK_RETURN_SESSION_COUNT);
  if (last3.length < BREAK_RETURN_SESSION_COUNT) return null;

  const avgAccuracy = mean(last3.map((s) => s.accuracy));
  if (avgAccuracy >= BREAK_ACCURACY_DROP_THRESHOLD) return null;

  return {
    suggestedPhase: "transitioning",
    reason:
      "You took a break, and your accuracy has dropped a bit. Want to go back to transition-mode focus for a few sessions?",
    confidence: "medium",
  };
}

export function suggestPhaseTransition(
  input: PhaseSuggestionInput,
): PhaseTransitionSignal | null {
  // Caller misalignment — snapshots should be 1:1 with sessions. Fail
  // closed rather than emit a nonsense signal from mismatched windows.
  if (input.recentSessions.length !== input.recentSnapshots.length) return null;

  if (input.currentPhase === "transitioning") return checkGraduation(input);
  return checkBreakReturn(input);
}
