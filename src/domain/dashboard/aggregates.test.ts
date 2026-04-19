import { describe, expect, it } from "vitest";
import type { CharacterStat } from "#/domain/stats/types";
import {
  averageSplitMetrics,
  buildSparklineValues,
  computeMasteredCount,
  computeStreakDays,
  computeTrendDelta,
  type SplitSnapshot,
} from "./aggregates";

// --- streak ----------------------------------------------------------------

const at = (y: number, m: number, d: number, h = 12): Date =>
  new Date(y, m - 1, d, h, 0, 0);

describe("computeStreakDays", () => {
  const today = at(2026, 4, 19);

  it("returns zero streaks on empty input", () => {
    expect(computeStreakDays([], today)).toEqual({ current: 0, longest: 0 });
  });

  it("counts a single-session day as streak 1", () => {
    const r = computeStreakDays([today], today);
    expect(r).toEqual({ current: 1, longest: 1 });
  });

  it("dedupes multiple sessions on the same day", () => {
    const r = computeStreakDays([today, at(2026, 4, 19, 9)], today);
    expect(r).toEqual({ current: 1, longest: 1 });
  });

  it("counts consecutive days ending today as current streak", () => {
    const dates = [at(2026, 4, 17), at(2026, 4, 18), at(2026, 4, 19)];
    expect(computeStreakDays(dates, today)).toEqual({ current: 3, longest: 3 });
  });

  it("breaks current streak when the user skipped today", () => {
    // Practiced last 3 days up to yesterday, nothing today.
    const dates = [at(2026, 4, 16), at(2026, 4, 17), at(2026, 4, 18)];
    const r = computeStreakDays(dates, today);
    expect(r.current).toBe(0);
    expect(r.longest).toBe(3);
  });

  it("finds the longest streak anywhere in history", () => {
    const dates = [
      // 4-day run
      at(2026, 3, 1),
      at(2026, 3, 2),
      at(2026, 3, 3),
      at(2026, 3, 4),
      // gap
      at(2026, 3, 10),
      // 2-day run including today
      at(2026, 4, 18),
      at(2026, 4, 19),
    ];
    const r = computeStreakDays(dates, today);
    expect(r).toEqual({ current: 2, longest: 4 });
  });
});

// --- mastered --------------------------------------------------------------

const cs = (over: Partial<CharacterStat> & { character: string }): CharacterStat => ({
  character: over.character,
  attempts: over.attempts ?? 100,
  errors: over.errors ?? 0,
  sumTime: over.sumTime ?? 0,
  hesitationCount: over.hesitationCount ?? 0,
});

describe("computeMasteredCount", () => {
  const options = { minAttempts: 20, maxErrorRate: 0.05 };

  it("returns 0/26 for empty input", () => {
    expect(computeMasteredCount([], options)).toEqual({ mastered: 0, total: 26 });
  });

  it("counts a character with enough attempts and low error rate", () => {
    const chars = [cs({ character: "a", attempts: 100, errors: 2 })]; // 2% err
    expect(computeMasteredCount(chars, options).mastered).toBe(1);
  });

  it("excludes a character below minAttempts even if perfect", () => {
    const chars = [cs({ character: "a", attempts: 5, errors: 0 })];
    expect(computeMasteredCount(chars, options).mastered).toBe(0);
  });

  it("excludes a character at or above maxErrorRate", () => {
    const chars = [
      cs({ character: "a", attempts: 100, errors: 5 }), // exactly 5% — excluded (strict <)
      cs({ character: "b", attempts: 100, errors: 4 }), // 4% — included
    ];
    expect(computeMasteredCount(chars, options).mastered).toBe(1);
  });

  it("ignores non-alphabetic characters (space, punctuation)", () => {
    const chars = [
      cs({ character: " ", attempts: 200, errors: 0 }),
      cs({ character: ".", attempts: 200, errors: 0 }),
      cs({ character: "a", attempts: 100, errors: 0 }),
    ];
    expect(computeMasteredCount(chars, options).mastered).toBe(1);
  });

  it("always reports total = 26", () => {
    expect(computeMasteredCount([], options).total).toBe(26);
  });
});

// --- trend delta -----------------------------------------------------------

describe("computeTrendDelta", () => {
  it("returns null when there are fewer than baselineN+1 values", () => {
    expect(computeTrendDelta([50, 55, 60, 62, 64, 63, 65], 7)).toBeNull();
  });

  it("computes positive delta when user has improved", () => {
    // First 3: avg 50. All 6: avg 55. Delta = +5.
    const delta = computeTrendDelta([50, 50, 50, 60, 60, 60], 3);
    expect(delta).toBeCloseTo(5);
  });

  it("computes negative delta when user has regressed", () => {
    // First 3: avg 60. All 6: avg 55. Delta = -5.
    const delta = computeTrendDelta([60, 60, 60, 50, 50, 50], 3);
    expect(delta).toBeCloseTo(-5);
  });

  it("returns 0 when current equals baseline", () => {
    expect(computeTrendDelta([50, 50, 50, 50], 2)).toBe(0);
  });
});

// --- sparkline -------------------------------------------------------------

describe("buildSparklineValues", () => {
  it("returns the input when it already fits", () => {
    expect(buildSparklineValues([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });

  it("down-samples to exactly maxPoints", () => {
    const input = Array.from({ length: 100 }, (_, i) => i);
    const out = buildSparklineValues(input, 10);
    expect(out).toHaveLength(10);
  });

  it("preserves first and last points of a long series", () => {
    const input = Array.from({ length: 100 }, (_, i) => i);
    const out = buildSparklineValues(input, 5);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(99);
  });
});

// --- split metrics averaging ----------------------------------------------

const snap = (over: Partial<SplitSnapshot> = {}): SplitSnapshot => ({
  innerColAttempts: over.innerColAttempts ?? 0,
  innerColErrors: over.innerColErrors ?? 0,
  innerColErrorRate: over.innerColErrorRate ?? null,
  thumbClusterCount: over.thumbClusterCount ?? 0,
  thumbClusterAvgMs: over.thumbClusterAvgMs ?? null,
  crossHandBigramCount: over.crossHandBigramCount ?? 0,
  crossHandBigramAvgMs: over.crossHandBigramAvgMs ?? null,
  columnarStableCount: over.columnarStableCount ?? 0,
  columnarDriftCount: over.columnarDriftCount ?? 0,
  columnarStabilityPct: over.columnarStabilityPct ?? null,
});

describe("averageSplitMetrics", () => {
  it("returns all-null fields on empty input", () => {
    expect(averageSplitMetrics([])).toEqual({
      innerColumnErrorRatePct: null,
      thumbClusterAvgMs: null,
      crossHandBigramAvgMs: null,
      columnarStabilityPct: null,
    });
  });

  it("weights inner-column error rate by attempts across snapshots", () => {
    // Session 1: 2 of 10 wrong → 20%.
    // Session 2: 0 of 90 wrong → 0%.
    // Unweighted average would be 10%; weighted by attempts: 2/100 = 2%.
    const out = averageSplitMetrics([
      snap({ innerColAttempts: 10, innerColErrors: 2 }),
      snap({ innerColAttempts: 90, innerColErrors: 0 }),
    ]);
    expect(out.innerColumnErrorRatePct).toBeCloseTo(2);
  });

  it("weights thumb-cluster avg by count", () => {
    // Short session at 400ms × 5, long session at 200ms × 95.
    // Weighted avg ≈ (400×5 + 200×95) / 100 = 210.
    const out = averageSplitMetrics([
      snap({ thumbClusterAvgMs: 400, thumbClusterCount: 5 }),
      snap({ thumbClusterAvgMs: 200, thumbClusterCount: 95 }),
    ]);
    expect(out.thumbClusterAvgMs).toBeCloseTo(210);
  });

  it("returns null when no snapshot has data for a given metric", () => {
    const out = averageSplitMetrics([
      snap({ innerColAttempts: 10, innerColErrors: 1 }),
      // thumb/crossHand/columnar never populated.
    ]);
    expect(out.thumbClusterAvgMs).toBeNull();
    expect(out.crossHandBigramAvgMs).toBeNull();
    expect(out.columnarStabilityPct).toBeNull();
  });

  it("aggregates columnar stability correctly", () => {
    // Session 1: 8 stable, 2 drift (80%).
    // Session 2: 50 stable, 50 drift (50%).
    // Weighted by total classifications: 58/110 ≈ 52.7%.
    const out = averageSplitMetrics([
      snap({ columnarStableCount: 8, columnarDriftCount: 2 }),
      snap({ columnarStableCount: 50, columnarDriftCount: 50 }),
    ]);
    expect(out.columnarStabilityPct).toBeCloseTo(52.7272, 2);
  });
});
