import { describe, expect, it } from "vitest";
import type { SplitMetricsSnapshot } from "../metrics/types";
import type { TransitionPhase } from "../stats/types";
import {
  ACCURACY_GRADUATION_THRESHOLD,
  BREAK_ACCURACY_DROP_THRESHOLD,
  BREAK_DAYS_THRESHOLD,
  BREAK_RETURN_SESSION_COUNT,
  INNER_COL_ERROR_GRADUATION_THRESHOLD,
  SESSION_HISTORY_REQUIRED,
  suggestPhaseTransition,
} from "./phaseSuggestion";

// --- fixture helpers -------------------------------------------------------

const NOW = new Date("2026-04-18T12:00:00Z");

const daysAgo = (n: number): Date => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

const sessions = (count: number, accuracy: number): { accuracy: number }[] =>
  Array.from({ length: count }, () => ({ accuracy }));

const snapshot = (over: Partial<SplitMetricsSnapshot> = {}): SplitMetricsSnapshot => ({
  innerColAttempts: 100,
  innerColErrors: 5,
  innerColErrorRate: 0.05,
  thumbClusterCount: 0,
  thumbClusterSumMs: 0,
  thumbClusterAvgMs: 0,
  crossHandBigramCount: 0,
  crossHandBigramSumMs: 0,
  crossHandBigramAvgMs: 0,
  columnarStableCount: 0,
  columnarDriftCount: 0,
  columnarStabilityPct: 1,
  totalKeystrokes: 500,
  insufficientData: false,
  ...over,
});

const snapshots = (
  count: number,
  over: Partial<SplitMetricsSnapshot> = {},
): SplitMetricsSnapshot[] => Array.from({ length: count }, () => snapshot(over));

type Overrides = {
  currentPhase?: TransitionPhase;
  lastSessionAt?: Date;
  recentSessions?: { accuracy: number }[];
  recentSnapshots?: SplitMetricsSnapshot[];
  now?: Date;
};

const makeInput = (over: Overrides = {}) => ({
  currentPhase: over.currentPhase ?? ("transitioning" as TransitionPhase),
  lastSessionAt: over.lastSessionAt,
  recentSessions: over.recentSessions ?? [],
  recentSnapshots: over.recentSnapshots ?? [],
  now: over.now ?? NOW,
});

// --- transitioning → refining ----------------------------------------------

describe("suggestPhaseTransition — transitioning → refining", () => {
  it("suggests refining when 10 sessions meet both thresholds", () => {
    const out = suggestPhaseTransition(
      makeInput({
        recentSessions: sessions(SESSION_HISTORY_REQUIRED, 0.96),
        recentSnapshots: snapshots(SESSION_HISTORY_REQUIRED, {
          innerColErrorRate: 0.05,
        }),
      }),
    );
    expect(out).not.toBeNull();
    expect(out?.suggestedPhase).toBe("refining");
    expect(out?.confidence).toBe("high");
    expect(out?.reason).toMatch(/engine thinks|might be ready|refining/i);
  });

  it("returns null when fewer than 10 sessions exist", () => {
    const out = suggestPhaseTransition(
      makeInput({
        recentSessions: sessions(SESSION_HISTORY_REQUIRED - 1, 0.99),
        recentSnapshots: snapshots(SESSION_HISTORY_REQUIRED - 1, {
          innerColErrorRate: 0.02,
        }),
      }),
    );
    expect(out).toBeNull();
  });

  it("returns null when average accuracy is below the threshold", () => {
    const out = suggestPhaseTransition(
      makeInput({
        recentSessions: sessions(SESSION_HISTORY_REQUIRED, 0.93),
        recentSnapshots: snapshots(SESSION_HISTORY_REQUIRED, {
          innerColErrorRate: 0.05,
        }),
      }),
    );
    expect(out).toBeNull();
  });

  it("returns null when inner column error rate is above the threshold", () => {
    const out = suggestPhaseTransition(
      makeInput({
        recentSessions: sessions(SESSION_HISTORY_REQUIRED, 0.98),
        recentSnapshots: snapshots(SESSION_HISTORY_REQUIRED, {
          innerColErrorRate: 0.12,
        }),
      }),
    );
    expect(out).toBeNull();
  });

  it("treats the thresholds as inclusive on accuracy, exclusive on inner-col", () => {
    // Exactly 95% accuracy (>= threshold) and just below 8% inner-col → pass.
    const out = suggestPhaseTransition(
      makeInput({
        recentSessions: sessions(SESSION_HISTORY_REQUIRED, ACCURACY_GRADUATION_THRESHOLD),
        recentSnapshots: snapshots(SESSION_HISTORY_REQUIRED, {
          innerColErrorRate: INNER_COL_ERROR_GRADUATION_THRESHOLD - 0.0001,
        }),
      }),
    );
    expect(out?.suggestedPhase).toBe("refining");

    // Inner-col just above 8% → no graduate. Uses a margin rather than
    // the exact threshold to avoid floating-point drift when averaging
    // identical samples ((0.08 * 10) / 10 doesn't round-trip cleanly).
    const out2 = suggestPhaseTransition(
      makeInput({
        recentSessions: sessions(SESSION_HISTORY_REQUIRED, ACCURACY_GRADUATION_THRESHOLD),
        recentSnapshots: snapshots(SESSION_HISTORY_REQUIRED, {
          innerColErrorRate: INNER_COL_ERROR_GRADUATION_THRESHOLD + 0.001,
        }),
      }),
    );
    expect(out2).toBeNull();
  });

  it("filters insufficientData snapshots before averaging inner-col error", () => {
    // 10 sessions, but 3 of the snapshots have insufficientData with huge
    // fake error rates — they must not tank the average.
    const goodSnapshots = snapshots(7, { innerColErrorRate: 0.05 });
    const noisyBadSnapshots = snapshots(3, {
      innerColErrorRate: 0.9,
      insufficientData: true,
    });
    const out = suggestPhaseTransition(
      makeInput({
        recentSessions: sessions(SESSION_HISTORY_REQUIRED, 0.96),
        recentSnapshots: [...goodSnapshots, ...noisyBadSnapshots],
      }),
    );
    expect(out?.suggestedPhase).toBe("refining");
  });

  it("uses only the last 10 sessions when more than 10 are provided", () => {
    // 5 poor sessions at the start, 10 excellent at the end — should graduate.
    const out = suggestPhaseTransition(
      makeInput({
        recentSessions: [...sessions(5, 0.6), ...sessions(10, 0.97)],
        recentSnapshots: [
          ...snapshots(5, { innerColErrorRate: 0.3 }),
          ...snapshots(10, { innerColErrorRate: 0.04 }),
        ],
      }),
    );
    expect(out?.suggestedPhase).toBe("refining");
  });
});

// --- refining → transitioning (break return) -------------------------------

describe("suggestPhaseTransition — refining → transitioning (break return)", () => {
  const refiningInput = (over: Overrides = {}) => makeInput({ currentPhase: "refining", ...over });

  it("suggests transitioning when the user returns after a long break with accuracy drop", () => {
    const out = suggestPhaseTransition(
      refiningInput({
        lastSessionAt: daysAgo(BREAK_DAYS_THRESHOLD + 1),
        recentSessions: sessions(BREAK_RETURN_SESSION_COUNT, 0.85),
        recentSnapshots: snapshots(BREAK_RETURN_SESSION_COUNT),
      }),
    );
    expect(out).not.toBeNull();
    expect(out?.suggestedPhase).toBe("transitioning");
    expect(out?.confidence).toBe("medium");
    expect(out?.reason.toLowerCase()).toMatch(/engine thinks|might benefit|transitioning/);
  });

  it("returns null when the break is shorter than the threshold", () => {
    const out = suggestPhaseTransition(
      refiningInput({
        lastSessionAt: daysAgo(BREAK_DAYS_THRESHOLD - 1),
        recentSessions: sessions(BREAK_RETURN_SESSION_COUNT, 0.85),
        recentSnapshots: snapshots(BREAK_RETURN_SESSION_COUNT),
      }),
    );
    expect(out).toBeNull();
  });

  it("returns null when accuracy is holding up after the break", () => {
    const out = suggestPhaseTransition(
      refiningInput({
        lastSessionAt: daysAgo(BREAK_DAYS_THRESHOLD + 5),
        recentSessions: sessions(BREAK_RETURN_SESSION_COUNT, 0.92),
        recentSnapshots: snapshots(BREAK_RETURN_SESSION_COUNT),
      }),
    );
    expect(out).toBeNull();
  });

  it("returns null when fewer than 3 sessions have happened since the return", () => {
    const out = suggestPhaseTransition(
      refiningInput({
        lastSessionAt: daysAgo(BREAK_DAYS_THRESHOLD + 1),
        recentSessions: sessions(BREAK_RETURN_SESSION_COUNT - 1, 0.8),
        recentSnapshots: snapshots(BREAK_RETURN_SESSION_COUNT - 1),
      }),
    );
    expect(out).toBeNull();
  });

  it("returns null when lastSessionAt is missing", () => {
    const out = suggestPhaseTransition(
      refiningInput({
        lastSessionAt: undefined,
        recentSessions: sessions(BREAK_RETURN_SESSION_COUNT, 0.8),
        recentSnapshots: snapshots(BREAK_RETURN_SESSION_COUNT),
      }),
    );
    expect(out).toBeNull();
  });

  it("treats the break threshold as strictly greater than 14 days", () => {
    // Exactly BREAK_DAYS_THRESHOLD — spec says "> 14", so 14 must NOT trigger.
    const out = suggestPhaseTransition(
      refiningInput({
        lastSessionAt: daysAgo(BREAK_DAYS_THRESHOLD),
        recentSessions: sessions(BREAK_RETURN_SESSION_COUNT, 0.8),
        recentSnapshots: snapshots(BREAK_RETURN_SESSION_COUNT),
      }),
    );
    expect(out).toBeNull();
  });

  it("treats the accuracy drop threshold as strictly less than 88%", () => {
    // Exactly BREAK_ACCURACY_DROP_THRESHOLD — spec says "< 0.88" → no trigger.
    const out = suggestPhaseTransition(
      refiningInput({
        lastSessionAt: daysAgo(BREAK_DAYS_THRESHOLD + 1),
        recentSessions: sessions(BREAK_RETURN_SESSION_COUNT, BREAK_ACCURACY_DROP_THRESHOLD),
        recentSnapshots: snapshots(BREAK_RETURN_SESSION_COUNT),
      }),
    );
    expect(out).toBeNull();
  });

  it("uses only the last 3 sessions for the break-return accuracy check", () => {
    // One bad session at the start, then 3 solid sessions — should NOT suggest.
    const out = suggestPhaseTransition(
      refiningInput({
        lastSessionAt: daysAgo(BREAK_DAYS_THRESHOLD + 1),
        recentSessions: [...sessions(1, 0.5), ...sessions(3, 0.95)],
        recentSnapshots: snapshots(4),
      }),
    );
    expect(out).toBeNull();
  });
});

// --- defensive -------------------------------------------------------------

describe("suggestPhaseTransition — defensive", () => {
  it("returns null when session and snapshot arrays have different lengths", () => {
    // Misaligned caller input — fail closed rather than produce a
    // nonsense suggestion.
    const out = suggestPhaseTransition(
      makeInput({
        recentSessions: sessions(SESSION_HISTORY_REQUIRED, 0.97),
        recentSnapshots: snapshots(SESSION_HISTORY_REQUIRED - 2, {
          innerColErrorRate: 0.03,
        }),
      }),
    );
    expect(out).toBeNull();
  });

  it("returns null for transitioning phase with completely empty history", () => {
    expect(suggestPhaseTransition(makeInput({}))).toBeNull();
  });

  it("returns null for refining phase with completely empty history", () => {
    expect(suggestPhaseTransition(makeInput({ currentPhase: "refining" }))).toBeNull();
  });
});
