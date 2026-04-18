import type { TransitionPhase, UserBaseline } from "./types";

/**
 * Cold-start baselines per 02-architecture.md §4.1 edge cases:
 *   - transitioning: 8% error rate, 280ms keystroke (calibrated higher
 *     than comfortable-user baseline)
 *   - refining: 3% error rate, 180ms keystroke
 *
 * meanHesitationRate is not specified in the doc. Approximating: with
 * the hesitation threshold = 2 × meanKeystrokeTime, ~10% of a
 * transitioning user's keystrokes and ~5% of a refining user's
 * keystrokes empirically cross that bar. Revisit once real-user data
 * exists.
 */
export const PHASE_BASELINES: Record<TransitionPhase, UserBaseline> = {
  transitioning: {
    meanErrorRate: 0.08,
    meanKeystrokeTime: 280,
    meanHesitationRate: 0.1,
  },
  refining: {
    meanErrorRate: 0.03,
    meanKeystrokeTime: 180,
    meanHesitationRate: 0.05,
  },
};

/** Hesitation = keystroke whose time exceeds this multiple of the
 * relevant baseline keystroke time. */
export const HESITATION_MULTIPLIER = 2;

/** Below this many character attempts, computeBaseline returns the
 * phase default rather than the user's empirical mean. Avoids letting
 * a handful of warm-up keystrokes set the bar for an entire session. */
export const MIN_ATTEMPTS_FOR_PERSONAL_BASELINE = 100;

/** Linear decay window in days, per 02-architecture.md §4.1. */
export const DECAY_WINDOW_DAYS = 30;
