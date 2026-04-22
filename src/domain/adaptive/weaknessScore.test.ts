import { describe, expect, it } from "vitest";
import { PHASE_BASELINES } from "../stats/baselines";
import type { BigramStat, CharacterStat, UserBaseline } from "../stats/types";
import {
  INNER_COLUMN_BONUS,
  LOW_CONFIDENCE_THRESHOLD,
  computeWeaknessScore,
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
    const rInner = computeWeaknessScore(
      innerColUnit,
      PHASE_BASELINES.refining,
      "refining",
      0,
    );
    const rNonInner = computeWeaknessScore(
      nonInnerColUnit,
      PHASE_BASELINES.refining,
      "refining",
      0,
    );
    expect(rInner).toBeCloseTo(rNonInner, 5);
  });

  it("recognizes all six inner-column characters (b, g, h, n, t, y)", () => {
    const noBonus = computeWeaknessScore(
      charStat({ character: "a" }),
      PHASE_BASELINES.transitioning,
      "transitioning",
      0,
    );
    for (const ch of ["b", "g", "h", "n", "t", "y"]) {
      const score = computeWeaknessScore(
        charStat({ character: ch }),
        PHASE_BASELINES.transitioning,
        "transitioning",
        0,
      );
      expect(score - noBonus, `expected bonus for '${ch}'`).toBeCloseTo(
        INNER_COLUMN_BONUS,
        5,
      );
    }
  });

  it("treats inner-column character matching as case-insensitive", () => {
    const lower = computeWeaknessScore(
      charStat({ character: "b" }),
      PHASE_BASELINES.transitioning,
      "transitioning",
      0,
    );
    const upper = computeWeaknessScore(
      charStat({ character: "B" }),
      PHASE_BASELINES.transitioning,
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
    const lowFreq = computeWeaknessScore(
      unit,
      PHASE_BASELINES.transitioning,
      "transitioning",
      0,
    );
    const highFreq = computeWeaknessScore(
      unit,
      PHASE_BASELINES.transitioning,
      "transitioning",
      1,
    );
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
