import { describe, expect, it } from "vitest";
import type { CharacterStat } from "#/domain/stats/types";
import {
  activityLevel,
  averageSplitMetrics,
  bucketActivityByDay,
  buildSparklineValues,
  computeHeatLevels,
  computeMasteredCount,
  computeStreakDays,
  computeTrendDelta,
  computeWeaknessRanking,
  formatDurationLabel,
  formatRelativeDay,
  type SplitSnapshot,
} from "./aggregates";
import type { BigramStat, UserBaseline } from "#/domain/stats/types";

// --- streak ----------------------------------------------------------------

const at = (y: number, m: number, d: number, h = 12, min = 0): Date =>
  new Date(y, m - 1, d, h, min, 0);

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

// --- activity level + bucket ----------------------------------------------

describe("activityLevel", () => {
  it("maps session counts to 0-4 buckets", () => {
    expect(activityLevel(0)).toBe(0);
    expect(activityLevel(1)).toBe(1);
    expect(activityLevel(2)).toBe(2);
    expect(activityLevel(3)).toBe(2);
    expect(activityLevel(4)).toBe(3);
    expect(activityLevel(5)).toBe(3);
    expect(activityLevel(6)).toBe(4);
    expect(activityLevel(20)).toBe(4);
  });

  it("treats negative counts as zero (defensive)", () => {
    expect(activityLevel(-3)).toBe(0);
  });
});

describe("bucketActivityByDay", () => {
  const today = at(2026, 4, 19);

  it("always returns `days` entries, oldest first", () => {
    const out = bucketActivityByDay([], today, 30);
    expect(out).toHaveLength(30);
    expect(out[0]!.date < out[out.length - 1]!.date).toBe(true);
    expect(out[out.length - 1]!.date).toBe("2026-04-19");
  });

  it("counts sessions per day and assigns levels", () => {
    const sessions = [
      at(2026, 4, 19, 9),
      at(2026, 4, 19, 11),
      at(2026, 4, 19, 14), // 3 today → level 2
      at(2026, 4, 18, 10), // 1 yesterday → level 1
    ];
    const out = bucketActivityByDay(sessions, today, 30);
    const last = out[out.length - 1]!;
    const yesterday = out[out.length - 2]!;
    expect(last.sessionCount).toBe(3);
    expect(last.level).toBe(2);
    expect(yesterday.sessionCount).toBe(1);
    expect(yesterday.level).toBe(1);
  });

  it("ignores sessions outside the window", () => {
    // A session 40 days ago should not appear in a 30-day window.
    const farBack = at(2026, 3, 10);
    const out = bucketActivityByDay([farBack, today], today, 30);
    expect(out.filter((d) => d.sessionCount > 0)).toHaveLength(1);
  });
});

// --- formatRelativeDay ----------------------------------------------------

describe("formatRelativeDay", () => {
  const now = at(2026, 4, 19, 14); // 2pm

  it("shows 'today' once >= 12h old but same day", () => {
    expect(formatRelativeDay(at(2026, 4, 19, 1), now)).toBe("today");
  });

  it("shows 'Nh ago' for sub-12h same-day", () => {
    expect(formatRelativeDay(at(2026, 4, 19, 12), now)).toBe("2h ago");
  });

  it("shows 'just now' for same-hour", () => {
    expect(formatRelativeDay(at(2026, 4, 19, 13, 45), now)).toBe("just now");
  });

  it("shows 'yesterday' for previous day", () => {
    expect(formatRelativeDay(at(2026, 4, 18, 14), now)).toBe("yesterday");
  });

  it("shows 'Nd ago' for 2-7 days old", () => {
    expect(formatRelativeDay(at(2026, 4, 15), now)).toBe("4d ago");
  });

  it("falls back to date for older than a week", () => {
    expect(formatRelativeDay(at(2026, 4, 1), now)).toBe("2026-04-01");
  });
});

// --- formatDurationLabel --------------------------------------------------

describe("formatDurationLabel", () => {
  it("formats M:SS with zero-padding", () => {
    expect(formatDurationLabel(4000)).toBe("0:04");
    expect(formatDurationLabel(134_000)).toBe("2:14");
  });

  it("clamps negative and zero elapsed to 0:00", () => {
    expect(formatDurationLabel(-5000)).toBe("0:00");
    expect(formatDurationLabel(0)).toBe("0:00");
  });
});

// --- computeHeatLevels ----------------------------------------------------

describe("computeHeatLevels", () => {
  const opts = { minAttempts: 10 };

  it("returns empty array on empty input", () => {
    expect(computeHeatLevels([], opts)).toEqual([]);
  });

  it("excludes non-alphabetic characters", () => {
    const out = computeHeatLevels(
      [
        { character: " ", attempts: 100, errors: 5 },
        { character: ".", attempts: 100, errors: 5 },
        { character: "a", attempts: 100, errors: 5 },
      ],
      opts,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.character).toBe("a");
  });

  it("lowercases input characters", () => {
    const out = computeHeatLevels(
      [{ character: "A", attempts: 100, errors: 0 }],
      opts,
    );
    expect(out[0]!.character).toBe("a");
  });

  it("assigns level 0 when below minAttempts even with high error rate", () => {
    const out = computeHeatLevels(
      [{ character: "b", attempts: 5, errors: 3 }],
      opts,
    );
    expect(out[0]!.level).toBe(0);
  });

  it("assigns level 0 when error rate is exactly 0", () => {
    const out = computeHeatLevels(
      [{ character: "a", attempts: 100, errors: 0 }],
      opts,
    );
    expect(out[0]!.level).toBe(0);
  });

  it.each([
    [0.01, 1], // 1% → level 1
    [0.029, 1], // just under 3%
    [0.03, 2], // exactly 3% → level 2
    [0.05, 2], // 5% → level 2
    [0.069, 2], // just under 7%
    [0.07, 3], // 7% → level 3
    [0.1, 3], // 10% → level 3
    [0.149, 3], // just under 15%
    [0.15, 4], // 15% → level 4
    [0.3, 4], // 30% → level 4
  ])("error rate %s maps to level %i", (rate, expectedLevel) => {
    const attempts = 1000;
    const errors = Math.round(rate * attempts);
    const out = computeHeatLevels(
      [{ character: "x", attempts, errors }],
      opts,
    );
    expect(out[0]!.level).toBe(expectedLevel);
  });

  it("surfaces errorRate and attempts on each entry", () => {
    const out = computeHeatLevels(
      [{ character: "b", attempts: 100, errors: 12 }],
      opts,
    );
    expect(out[0]!.attempts).toBe(100);
    expect(out[0]!.errors).toBe(12);
    expect(out[0]!.errorRate).toBeCloseTo(0.12);
  });
});

// --- computeWeaknessRanking ------------------------------------------------

const baseline: UserBaseline = {
  meanErrorRate: 0.05,
  meanKeystrokeTime: 200,
  meanHesitationRate: 0.1,
  journey: "conventional",
};

const cStat = (over: Partial<CharacterStat> & { character: string }): CharacterStat => ({
  character: over.character,
  attempts: over.attempts ?? 100,
  errors: over.errors ?? 5,
  sumTime: over.sumTime ?? 200 * 100,
  hesitationCount: over.hesitationCount ?? 10,
});

const bStat = (over: Partial<BigramStat> & { bigram: string }): BigramStat => ({
  bigram: over.bigram,
  attempts: over.attempts ?? 100,
  errors: over.errors ?? 5,
  sumTime: over.sumTime ?? 200 * 100,
});

describe("computeWeaknessRanking", () => {
  it("returns empty when no stats rows", () => {
    const out = computeWeaknessRanking({
      chars: [],
      bigrams: [],
      baseline,
      phase: "transitioning",
      topN: 10,
    });
    expect(out).toEqual([]);
  });

  it("filters out low-confidence units (< 5 attempts)", () => {
    const out = computeWeaknessRanking({
      chars: [
        cStat({ character: "a", attempts: 4, errors: 4 }), // huge error rate but too few attempts
      ],
      bigrams: [],
      baseline,
      phase: "transitioning",
      topN: 10,
    });
    expect(out).toEqual([]);
  });

  it("ranks characters and bigrams together in one list", () => {
    const out = computeWeaknessRanking({
      chars: [
        cStat({ character: "q", attempts: 50, errors: 20 }), // very error-prone char
      ],
      bigrams: [
        bStat({ bigram: "er", attempts: 50, errors: 15 }),
      ],
      baseline,
      phase: "transitioning",
      topN: 10,
    });
    expect(out).toHaveLength(2);
    const units = new Set(out.map((e) => e.unit));
    expect(units).toEqual(new Set(["q", "er"]));
    const char = out.find((e) => e.unit === "q")!;
    const bigram = out.find((e) => e.unit === "er")!;
    expect(char.isCharacter).toBe(true);
    expect(bigram.isCharacter).toBe(false);
  });

  it("sorts by score descending and caps at topN", () => {
    const chars = Array.from({ length: 15 }, (_, i) =>
      cStat({
        character: String.fromCharCode("a".charCodeAt(0) + i),
        attempts: 100,
        errors: i + 1, // a: 1 error, b: 2, …, o: 15 errors
      }),
    );
    const out = computeWeaknessRanking({
      chars,
      bigrams: [],
      baseline,
      phase: "transitioning",
      topN: 5,
    });
    expect(out).toHaveLength(5);
    // Descending by score — lettering by error count decreasing.
    // Highest-error entries are at the top (o, n, m, l, k).
    const scores = out.map((e) => e.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]! <= scores[i - 1]!).toBe(true);
    }
  });

  it("assigns relativeWeightPct = 100 to the top entry", () => {
    const out = computeWeaknessRanking({
      chars: [
        cStat({ character: "a", attempts: 50, errors: 20 }),
        cStat({ character: "b", attempts: 50, errors: 5 }),
      ],
      bigrams: [],
      baseline,
      phase: "transitioning",
      topN: 5,
    });
    expect(out[0]!.relativeWeightPct).toBe(100);
    // The second entry's bar is proportional (not 100, not 0).
    expect(out[1]!.relativeWeightPct).toBeGreaterThan(0);
    expect(out[1]!.relativeWeightPct).toBeLessThan(100);
  });

  it("applies the transitioning-phase inner-column bonus to letters like B, T", () => {
    // Same error/slowness profile: B (inner column) vs S (not inner).
    // Transitioning phase gives B the inner-column bonus — it should
    // outrank S.
    const out = computeWeaknessRanking({
      chars: [
        cStat({ character: "b", attempts: 100, errors: 10 }),
        cStat({ character: "s", attempts: 100, errors: 10 }),
      ],
      bigrams: [],
      baseline,
      phase: "transitioning",
      topN: 5,
    });
    const b = out.find((e) => e.unit === "b")!;
    const s = out.find((e) => e.unit === "s")!;
    expect(b.score).toBeGreaterThan(s.score);
  });

  it("refining phase applies no inner-column bonus (shifts weight to slowness/hesitation)", () => {
    // Same profile — inner-column bonus only applies in transitioning.
    const out = computeWeaknessRanking({
      chars: [
        cStat({ character: "b", attempts: 100, errors: 10 }),
        cStat({ character: "s", attempts: 100, errors: 10 }),
      ],
      bigrams: [],
      baseline,
      phase: "refining",
      topN: 5,
    });
    const b = out.find((e) => e.unit === "b")!;
    const s = out.find((e) => e.unit === "s")!;
    expect(Math.abs(b.score - s.score)).toBeLessThan(0.05);
  });

  it("surfaces errorRatePct and avgTimeMs in rounded integers", () => {
    const out = computeWeaknessRanking({
      chars: [cStat({ character: "q", attempts: 50, errors: 9, sumTime: 50 * 247 })],
      bigrams: [],
      baseline,
      phase: "transitioning",
      topN: 5,
    });
    expect(out[0]!.errorRatePct).toBe(18); // 9/50
    expect(out[0]!.avgTimeMs).toBe(247);
  });

  // Regression: a stray empty prev_char in the persist pipeline can
  // leak 1-char strings into bigram_stats. The ranking must ignore
  // them so the UI doesn't render a lone letter next to its real
  // character-stats sibling.
  it("skips malformed bigrams (length !== 2)", () => {
    const out = computeWeaknessRanking({
      chars: [],
      bigrams: [
        bStat({ bigram: "n", attempts: 100, errors: 20 }), // stray 1-char
        bStat({ bigram: "abc", attempts: 100, errors: 20 }), // stray 3-char
        bStat({ bigram: "er", attempts: 50, errors: 10 }), // valid
      ],
      baseline,
      phase: "transitioning",
      topN: 5,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.unit).toBe("er");
  });
});
