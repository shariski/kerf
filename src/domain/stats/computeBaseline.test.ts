import { describe, expect, it } from "vitest";
import {
  MIN_ATTEMPTS_FOR_PERSONAL_BASELINE,
  PHASE_BASELINES,
} from "./baselines";
import { computeBaseline } from "./computeBaseline";
import type { CharacterStat, ComputedStats } from "./types";

const emptyStats: ComputedStats = { characters: [], bigrams: [] };

const charStat = (overrides: Partial<CharacterStat> = {}): CharacterStat => ({
  character: overrides.character ?? "a",
  attempts: overrides.attempts ?? 0,
  errors: overrides.errors ?? 0,
  sumTime: overrides.sumTime ?? 0,
  hesitationCount: overrides.hesitationCount ?? 0,
});

describe("computeBaseline — cold start (insufficient data)", () => {
  it("returns the transitioning default for an empty stats bundle", () => {
    expect(computeBaseline(emptyStats, "transitioning", "conventional")).toEqual(
      PHASE_BASELINES.transitioning,
    );
  });

  it("returns the refining default for an empty stats bundle", () => {
    expect(computeBaseline(emptyStats, "refining", "conventional")).toEqual(
      PHASE_BASELINES.refining,
    );
  });

  it("returns the phase default when below the personal-baseline threshold", () => {
    const stats: ComputedStats = {
      characters: [charStat({ attempts: 50, errors: 5, sumTime: 10000 })],
      bigrams: [],
    };
    expect(computeBaseline(stats, "transitioning", "conventional")).toEqual(
      PHASE_BASELINES.transitioning,
    );
  });

  it("returns different baselines for the same stats in different phases when below threshold", () => {
    const stats: ComputedStats = {
      characters: [charStat({ attempts: 10 })],
      bigrams: [],
    };
    const t = computeBaseline(stats, "transitioning", "conventional");
    const r = computeBaseline(stats, "refining", "conventional");
    expect(t).not.toEqual(r);
  });

  it("cold-start path preserves the caller-supplied journey (not PHASE_BASELINES default)", () => {
    const cold = computeBaseline(emptyStats, "transitioning", "columnar");
    expect(cold.journey).toBe("columnar");

    const coldUnsure = computeBaseline(emptyStats, "transitioning", "unsure");
    expect(coldUnsure.journey).toBe("unsure");
  });
});

describe("computeBaseline — empirical mean (sufficient data)", () => {
  const sufficient = MIN_ATTEMPTS_FOR_PERSONAL_BASELINE;

  it("computes meanErrorRate from totals when above threshold", () => {
    const stats: ComputedStats = {
      characters: [
        charStat({
          attempts: sufficient,
          errors: sufficient * 0.05,
          sumTime: sufficient * 200,
          hesitationCount: sufficient * 0.07,
        }),
      ],
      bigrams: [],
    };
    const baseline = computeBaseline(stats, "transitioning", "conventional");
    expect(baseline.meanErrorRate).toBeCloseTo(0.05, 5);
    expect(baseline.meanKeystrokeTime).toBeCloseTo(200, 5);
    expect(baseline.meanHesitationRate).toBeCloseTo(0.07, 5);
  });

  it("aggregates across multiple characters when computing the mean", () => {
    const stats: ComputedStats = {
      characters: [
        charStat({ character: "a", attempts: 60, errors: 6, sumTime: 12000 }),
        charStat({ character: "b", attempts: 60, errors: 0, sumTime: 24000 }),
      ],
      bigrams: [],
    };
    const baseline = computeBaseline(stats, "refining", "conventional");
    expect(baseline.meanErrorRate).toBeCloseTo(6 / 120, 5);
    expect(baseline.meanKeystrokeTime).toBeCloseTo(36000 / 120, 5);
  });

  it("is phase-independent once the empirical mean kicks in", () => {
    const stats: ComputedStats = {
      characters: [
        charStat({
          attempts: sufficient,
          errors: 4,
          sumTime: sufficient * 200,
          hesitationCount: 8,
        }),
      ],
      bigrams: [],
    };
    expect(computeBaseline(stats, "transitioning", "conventional")).toEqual(
      computeBaseline(stats, "refining", "conventional"),
    );
  });
});
