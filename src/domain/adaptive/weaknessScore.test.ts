import { describe, expect, it } from "vitest";
import { PHASE_BASELINES } from "../stats/baselines";
import type { BigramStat, CharacterStat, UserBaseline } from "../stats/types";
import {
  CONFIDENCE_WEIGHT_K,
  INNER_COLUMN_BONUS,
  JOURNEY_BONUSES,
  LOW_CONFIDENCE_THRESHOLD,
  computeWeaknessScore,
  confidenceWeight,
  isLowConfidence,
} from "./weaknessScore";

const baseline = (over: Partial<UserBaseline> = {}): UserBaseline => ({
  meanErrorRate: 0.08,
  meanKeystrokeTime: 280,
  meanHesitationRate: 0.1,
  journey: "conventional",
  ...over,
});

const charStat = (over: Partial<CharacterStat> = {}): CharacterStat => ({
  character: over.character ?? "a",
  attempts: over.attempts ?? 100,
  errors: over.errors ?? 0,
  sumTime: over.sumTime ?? 100 * 280,
  hesitationCount: over.hesitationCount ?? 0,
});

const bigramStat = (over: Partial<BigramStat> = {}): BigramStat => ({
  bigram: over.bigram ?? "ab",
  attempts: over.attempts ?? 100,
  errors: over.errors ?? 0,
  sumTime: over.sumTime ?? 100 * 280,
});

// Hold baseline constant when comparing phases — otherwise the phase-default
// baseline differences (lower error rate in refining → larger normalized
// values) confound the coefficient effect we want to isolate.
describe("computeWeaknessScore — phase coefficient differences (baseline held constant)", () => {
  const SHARED = PHASE_BASELINES.transitioning;

  it("weights errors more heavily in transitioning than in refining (ALPHA)", () => {
    const errorHeavy = charStat({ character: "a", attempts: 100, errors: 20 });
    const t = computeWeaknessScore(errorHeavy, SHARED, "transitioning", 0);
    const r = computeWeaknessScore(errorHeavy, SHARED, "refining", 0);
    expect(t).toBeGreaterThan(r);
  });

  it("weights hesitation more heavily in refining than in transitioning (BETA)", () => {
    const hesitationHeavy = charStat({
      character: "a",
      attempts: 100,
      errors: 0,
      hesitationCount: 30,
    });
    const t = computeWeaknessScore(hesitationHeavy, SHARED, "transitioning", 0);
    const r = computeWeaknessScore(hesitationHeavy, SHARED, "refining", 0);
    expect(r).toBeGreaterThan(t);
  });

  it("weights slowness more heavily in refining than in transitioning (GAMMA)", () => {
    const slowUnit = charStat({
      character: "a",
      attempts: 100,
      errors: 0,
      sumTime: 100 * 600,
    });
    const t = computeWeaknessScore(slowUnit, SHARED, "transitioning", 0);
    const r = computeWeaknessScore(slowUnit, SHARED, "refining", 0);
    expect(r).toBeGreaterThan(t);
  });
});

describe("computeWeaknessScore — inner column transition bonus", () => {
  const innerColUnit = charStat({ character: "b", attempts: 100, errors: 5 });
  const nonInnerColUnit = charStat({ character: "a", attempts: 100, errors: 5 });

  it("adds the bonus only in transitioning phase", () => {
    const tWithBonus = computeWeaknessScore(
      innerColUnit,
      PHASE_BASELINES.transitioning,
      "transitioning",
      0,
    );
    const tWithoutBonus = computeWeaknessScore(
      nonInnerColUnit,
      PHASE_BASELINES.transitioning,
      "transitioning",
      0,
    );
    expect(tWithBonus - tWithoutBonus).toBeCloseTo(INNER_COLUMN_BONUS, 5);
  });

  it("does not add the bonus in refining phase", () => {
    const rInner = computeWeaknessScore(innerColUnit, PHASE_BASELINES.refining, "refining", 0);
    const rNonInner = computeWeaknessScore(
      nonInnerColUnit,
      PHASE_BASELINES.refining,
      "refining",
      0,
    );
    expect(rInner).toBeCloseTo(rNonInner, 5);
  });

  it("recognizes all six inner-column characters (b, g, h, n, t, y) in columnar journey", () => {
    const noBonus = computeWeaknessScore(
      charStat({ character: "a" }),
      baseline({ journey: "columnar" }),
      "transitioning",
      0,
    );
    for (const ch of ["b", "g", "h", "n", "t", "y"]) {
      const score = computeWeaknessScore(
        charStat({ character: ch }),
        baseline({ journey: "columnar" }),
        "transitioning",
        0,
      );
      expect(score - noBonus, `expected bonus for '${ch}'`).toBeCloseTo(INNER_COLUMN_BONUS, 5);
    }
  });

  it("treats inner-column character matching as case-insensitive", () => {
    const lower = computeWeaknessScore(
      charStat({ character: "b" }),
      baseline({ journey: "columnar" }),
      "transitioning",
      0,
    );
    const upper = computeWeaknessScore(
      charStat({ character: "B" }),
      baseline({ journey: "columnar" }),
      "transitioning",
      0,
    );
    expect(upper).toBeCloseTo(lower, 5);
  });

  it("does not apply the inner-column bonus to bigrams", () => {
    const bigramWithInnerCol = bigramStat({ bigram: "bn" });
    const bigramWithoutInnerCol = bigramStat({ bigram: "as" });
    const withInner = computeWeaknessScore(
      bigramWithInnerCol,
      PHASE_BASELINES.transitioning,
      "transitioning",
      0,
    );
    const withoutInner = computeWeaknessScore(
      bigramWithoutInnerCol,
      PHASE_BASELINES.transitioning,
      "transitioning",
      0,
    );
    expect(withInner).toBeCloseTo(withoutInner, 5);
  });
});

describe("computeWeaknessScore — frequency penalty", () => {
  it("reduces the score for high-frequency units", () => {
    const unit = charStat({ character: "a", attempts: 100, errors: 5 });
    const lowFreq = computeWeaknessScore(unit, PHASE_BASELINES.transitioning, "transitioning", 0);
    const highFreq = computeWeaknessScore(unit, PHASE_BASELINES.transitioning, "transitioning", 1);
    expect(lowFreq).toBeGreaterThan(highFreq);
  });
});

describe("computeWeaknessScore — defensive numerics", () => {
  it("returns a finite number when baseline.meanErrorRate is 0", () => {
    const score = computeWeaknessScore(
      charStat({ character: "a", attempts: 100, errors: 5 }),
      baseline({ meanErrorRate: 0 }),
      "refining",
      0,
    );
    expect(Number.isFinite(score)).toBe(true);
  });

  it("returns a finite number when baseline.meanHesitationRate is 0", () => {
    const score = computeWeaknessScore(
      charStat({ character: "a", attempts: 100, hesitationCount: 5 }),
      baseline({ meanHesitationRate: 0 }),
      "refining",
      0,
    );
    expect(Number.isFinite(score)).toBe(true);
  });

  it("returns a finite number when the unit has zero attempts", () => {
    const score = computeWeaknessScore(
      charStat({ character: "a", attempts: 0, errors: 0, sumTime: 0 }),
      PHASE_BASELINES.transitioning,
      "transitioning",
      0,
    );
    expect(Number.isFinite(score)).toBe(true);
  });
});

describe("computeWeaknessScore — evidence-weight attenuation for small samples", () => {
  it("same error rate, fewer attempts → lower score (shrinkage fires)", () => {
    // Both units show ~15% error rate relative to 8% baseline. The
    // small-sample unit has 6 attempts, the large-sample has 600.
    // Under raw-rate scoring they'd tie; with confidenceWeight they
    // differ by the ratio of their weights.
    const smallSample = charStat({
      character: "a",
      attempts: 6,
      errors: 1,
      sumTime: 6 * 280,
    });
    const largeSample = charStat({
      character: "a",
      attempts: 600,
      errors: 90,
      sumTime: 600 * 280,
    });
    const small = computeWeaknessScore(
      smallSample,
      PHASE_BASELINES.transitioning,
      "transitioning",
      0,
    );
    const large = computeWeaknessScore(
      largeSample,
      PHASE_BASELINES.transitioning,
      "transitioning",
      0,
    );
    expect(small).toBeLessThan(large);
  });

  it("confidenceWeight(attempts) → 0 at attempts=0, approaches 1 for large attempts", () => {
    expect(confidenceWeight(0)).toBe(0);
    expect(confidenceWeight(CONFIDENCE_WEIGHT_K)).toBeCloseTo(0.5, 5);
    expect(confidenceWeight(1000)).toBeGreaterThan(0.98);
    expect(confidenceWeight(1000)).toBeLessThan(1);
  });

  it("journey bonus is NOT attenuated (structural prior, independent of attempts)", () => {
    // Inner-column 'b' at very low attempts should still get the bonus
    // at full strength — even though the evidence-based components
    // are attenuated near zero.
    const noise = charStat({ character: "b", attempts: 1, errors: 0, sumTime: 280 });
    const score = computeWeaknessScore(
      noise,
      baseline({ journey: "columnar" }),
      "transitioning",
      0,
    );
    // With zero observed weakness and zero frequency, the score
    // should be very close to the journey bonus (~0.3). If the bonus
    // were being attenuated by confidenceWeight(1) = 1/11 ≈ 0.09, the
    // score would be ~0.027 instead.
    expect(score).toBeCloseTo(JOURNEY_BONUSES.columnar.INNER_COLUMN_BONUS, 1);
  });
});

describe("isLowConfidence", () => {
  it(`returns true when attempts < ${LOW_CONFIDENCE_THRESHOLD}`, () => {
    expect(isLowConfidence(charStat({ attempts: 0 }))).toBe(true);
    expect(isLowConfidence(charStat({ attempts: 4 }))).toBe(true);
  });

  it(`returns false when attempts >= ${LOW_CONFIDENCE_THRESHOLD}`, () => {
    expect(isLowConfidence(charStat({ attempts: 5 }))).toBe(false);
    expect(isLowConfidence(charStat({ attempts: 100 }))).toBe(false);
  });

  it("works on bigram stats too", () => {
    expect(isLowConfidence(bigramStat({ attempts: 2 }))).toBe(true);
    expect(isLowConfidence(bigramStat({ attempts: 50 }))).toBe(false);
  });
});

describe("computeWeaknessScore — journey branching (ADR-003 §4.1)", () => {
  it("conventional journey: applies VERTICAL_REACH_BONUS to off-home-row chars, no INNER_COLUMN_BONUS", () => {
    // 'q' is row 1 (top) — should get vertical bonus under conventional
    const topRowChar = charStat({ character: "q" });
    const score = computeWeaknessScore(
      topRowChar,
      baseline({ journey: "conventional" }),
      "transitioning",
      0.5,
    );
    const scoreColumnar = computeWeaknessScore(
      topRowChar,
      baseline({ journey: "columnar" }),
      "transitioning",
      0.5,
    );
    expect(score).toBeGreaterThan(scoreColumnar); // conventional gets +0.3
  });

  it("conventional JOURNEY_BONUSES: INNER_COLUMN = 0, VERTICAL_REACH = 0.3", () => {
    expect(JOURNEY_BONUSES.conventional.INNER_COLUMN_BONUS).toBe(0);
    expect(JOURNEY_BONUSES.conventional.VERTICAL_REACH_BONUS).toBe(0.3);
  });

  it("columnar JOURNEY_BONUSES: INNER_COLUMN = 0.3, VERTICAL_REACH = 0", () => {
    expect(JOURNEY_BONUSES.columnar.INNER_COLUMN_BONUS).toBe(0.3);
    expect(JOURNEY_BONUSES.columnar.VERTICAL_REACH_BONUS).toBe(0);
  });

  it("columnar journey: applies INNER_COLUMN_BONUS to inner-column chars, no VERTICAL_REACH", () => {
    // 'g' is home-row inner-column
    const gScore = computeWeaknessScore(
      charStat({ character: "g" }),
      baseline({ journey: "columnar" }),
      "transitioning",
      0.5,
    );
    const gConv = computeWeaknessScore(
      charStat({ character: "g" }),
      baseline({ journey: "conventional" }),
      "transitioning",
      0.5,
    );
    expect(gScore).toBeGreaterThan(gConv); // columnar gets +0.3 on 'g'; conventional gets 0
  });

  it("unsure journey: behaves as conventional (same BONUSES shape)", () => {
    expect(JOURNEY_BONUSES.unsure).toEqual(JOURNEY_BONUSES.conventional);
  });

  it("refining phase: no journey bonus applied regardless of journey", () => {
    const refConv = computeWeaknessScore(
      charStat({ character: "q" }),
      baseline({ journey: "conventional" }),
      "refining",
      0.5,
    );
    const refCol = computeWeaknessScore(
      charStat({ character: "q" }),
      baseline({ journey: "columnar" }),
      "refining",
      0.5,
    );
    expect(refConv).toBe(refCol);
  });

  it("bigrams never get journey bonus (even in transitioning)", () => {
    const bigram: BigramStat = {
      bigram: "gh",
      attempts: 50,
      errors: 5,
      sumTime: 15_000,
    } as BigramStat;
    const conv = computeWeaknessScore(
      bigram,
      baseline({ journey: "conventional" }),
      "transitioning",
      0.5,
    );
    const col = computeWeaknessScore(
      bigram,
      baseline({ journey: "columnar" }),
      "transitioning",
      0.5,
    );
    expect(conv).toBe(col);
  });

  it("INNER_COLUMN_BONUS backward-compat export equals 0.3", () => {
    expect(INNER_COLUMN_BONUS).toBe(0.3);
  });
});
