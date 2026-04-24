import { describe, expect, it } from "vitest";
import { computeWeaknessBreakdown } from "./breakdown";
import { computeWeaknessScore } from "#/domain/adaptive/weaknessScore";
import type {
  BigramStat,
  CharacterStat,
  TransitionPhase,
  UserBaseline,
} from "#/domain/stats/types";

const baseline: UserBaseline = {
  meanErrorRate: 0.08,
  meanKeystrokeTime: 280,
  meanHesitationRate: 0.1,
  journey: "conventional",
};

const makeChar = (over: Partial<CharacterStat> = {}): CharacterStat => ({
  character: "b",
  attempts: 100,
  errors: 12,
  sumTime: 32_000, // 320ms/keystroke
  hesitationCount: 18, // 18% hesitation rate
  ...over,
});

const makeBigram = (over: Partial<BigramStat> = {}): BigramStat => ({
  bigram: "er",
  attempts: 80,
  errors: 6,
  sumTime: 19_200, // 240ms/keystroke
  ...over,
});

describe("computeWeaknessBreakdown — totals match engine", () => {
  it.each([
    "transitioning",
    "refining",
  ] as const)("matches computeWeaknessScore exactly for char in %s phase", (phase: TransitionPhase) => {
    const unit = makeChar();
    const breakdown = computeWeaknessBreakdown(unit, baseline, phase, 0);
    const engineScore = computeWeaknessScore(unit, baseline, phase, 0);
    expect(breakdown.total).toBeCloseTo(engineScore, 10);
  });

  it.each([
    "transitioning",
    "refining",
  ] as const)("matches computeWeaknessScore exactly for bigram in %s phase", (phase: TransitionPhase) => {
    const unit = makeBigram();
    const breakdown = computeWeaknessBreakdown(unit, baseline, phase, 0);
    const engineScore = computeWeaknessScore(unit, baseline, phase, 0);
    expect(breakdown.total).toBeCloseTo(engineScore, 10);
  });

  it("includes non-zero frequency term in total", () => {
    const unit = makeChar();
    const withFreq = computeWeaknessBreakdown(unit, baseline, "refining", 0.12);
    const withoutFreq = computeWeaknessBreakdown(unit, baseline, "refining", 0);
    // Frequency is subtracted, so a positive frequency lowers total.
    expect(withFreq.total).toBeLessThan(withoutFreq.total);
    expect(withFreq.frequency.contribution).toBeLessThan(0);
    expect(withFreq.frequency.raw).toBe(0.12);
  });
});

describe("computeWeaknessBreakdown — component values", () => {
  it("exposes raw, baseline, normalized, and contribution for each component", () => {
    const unit = makeChar();
    const b = computeWeaknessBreakdown(unit, baseline, "transitioning", 0);
    // error rate: 12/100 = 0.12 raw, baseline 0.08 → 1.5×, coefficient 0.6
    // contribution is evidence-weighted: (100/110) × 0.6 × 1.5 ≈ 0.818
    const w = 100 / 110;
    expect(b.errorRate.raw).toBeCloseTo(0.12, 10);
    expect(b.errorRate.baseline).toBe(0.08);
    expect(b.errorRate.normalized).toBeCloseTo(1.5, 10);
    expect(b.errorRate.coefficient).toBe(0.6);
    expect(b.errorRate.contribution).toBeCloseTo(w * 0.9, 10);
    expect(b.confidenceWeight).toBeCloseTo(w, 10);

    // slowness: 320ms raw, baseline 280ms → 1.143×, coefficient 0.1
    expect(b.slowness.raw).toBeCloseTo(320, 10);
    expect(b.slowness.baseline).toBe(280);
    expect(b.slowness.normalized).toBeCloseTo(320 / 280, 10);
  });

  it("switches coefficients when phase changes", () => {
    const unit = makeChar();
    const tr = computeWeaknessBreakdown(unit, baseline, "transitioning", 0);
    const rf = computeWeaknessBreakdown(unit, baseline, "refining", 0);
    expect(tr.errorRate.coefficient).toBe(0.6);
    expect(rf.errorRate.coefficient).toBe(0.3);
    expect(tr.coefficients.BETA).toBe(0.2);
    expect(rf.coefficients.BETA).toBe(0.35);
  });

  it("returns null hesitation for bigrams (no hesitation tracking in schema)", () => {
    const unit = makeBigram();
    const b = computeWeaknessBreakdown(unit, baseline, "transitioning", 0);
    expect(b.hesitation).toBeNull();
    expect(b.isCharacter).toBe(false);
  });

  it("exposes hesitation rate for characters", () => {
    const unit = makeChar({ hesitationCount: 18 }); // 18/100 = 0.18
    const b = computeWeaknessBreakdown(unit, baseline, "transitioning", 0);
    expect(b.hesitation).not.toBeNull();
    expect(b.hesitation!.raw).toBeCloseTo(0.18, 10);
    expect(b.hesitation!.baseline).toBe(0.1);
    expect(b.hesitation!.normalized).toBeCloseTo(1.8, 10);
  });
});

describe("computeWeaknessBreakdown — inner-column bonus", () => {
  it("fires for inner-column chars in transitioning phase", () => {
    for (const ch of ["b", "g", "h", "n", "t", "y"]) {
      const unit = makeChar({ character: ch });
      const b = computeWeaknessBreakdown(unit, baseline, "transitioning", 0);
      expect(b.innerColumnBonus, `expected bonus for ${ch}`).toBeGreaterThan(0);
    }
  });

  it("does NOT fire for non-inner-column chars even in transitioning", () => {
    for (const ch of ["a", "e", "o", "q", "z"]) {
      const unit = makeChar({ character: ch });
      const b = computeWeaknessBreakdown(unit, baseline, "transitioning", 0);
      expect(b.innerColumnBonus, `unexpected bonus for ${ch}`).toBe(0);
    }
  });

  it("does NOT fire for any char in refining phase", () => {
    for (const ch of ["b", "g", "h", "n", "t", "y"]) {
      const unit = makeChar({ character: ch });
      const b = computeWeaknessBreakdown(unit, baseline, "refining", 0);
      expect(b.innerColumnBonus, `bonus leaked into refining for ${ch}`).toBe(0);
    }
  });

  it("does NOT fire for bigrams regardless of phase", () => {
    const unit = makeBigram({ bigram: "th" }); // starts with inner-column 't'
    const tr = computeWeaknessBreakdown(unit, baseline, "transitioning", 0);
    const rf = computeWeaknessBreakdown(unit, baseline, "refining", 0);
    expect(tr.innerColumnBonus).toBe(0);
    expect(rf.innerColumnBonus).toBe(0);
  });
});

describe("computeWeaknessBreakdown — edge cases", () => {
  it("handles zero attempts without dividing by zero", () => {
    const unit: CharacterStat = {
      character: "b",
      attempts: 0,
      errors: 0,
      sumTime: 0,
      hesitationCount: 0,
    };
    const b = computeWeaknessBreakdown(unit, baseline, "transitioning", 0);
    expect(b.errorRate.raw).toBe(0);
    expect(b.slowness.raw).toBe(0);
    expect(Number.isFinite(b.total)).toBe(true);
  });

  it("handles zero baseline without dividing by zero (normalized = 0)", () => {
    const zeroBaseline: UserBaseline = {
      meanErrorRate: 0,
      meanKeystrokeTime: 0,
      meanHesitationRate: 0,
      journey: "conventional",
    };
    const unit = makeChar();
    const b = computeWeaknessBreakdown(unit, zeroBaseline, "transitioning", 0);
    expect(b.errorRate.normalized).toBe(0);
    expect(b.slowness.normalized).toBe(0);
    expect(b.hesitation!.normalized).toBe(0);
    expect(Number.isFinite(b.total)).toBe(true);
  });

  it("lowercases the unit string for both chars and bigrams", () => {
    const char = computeWeaknessBreakdown(
      makeChar({ character: "B" }),
      baseline,
      "transitioning",
      0,
    );
    const bigram = computeWeaknessBreakdown(
      makeBigram({ bigram: "ER" }),
      baseline,
      "transitioning",
      0,
    );
    expect(char.unit).toBe("b");
    expect(bigram.unit).toBe("er");
  });
});
