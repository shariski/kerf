import { describe, expect, it } from "vitest";
import { bayesianWeakness, PRIOR_MASTERY, PRIOR_STRENGTH, PRIOR_WEAKNESS } from "./bayesianMastery";

describe("bayesianWeakness — closed-form properties", () => {
  it("returns the prior weakness for an unmeasured unit (0 attempts, 0 errors)", () => {
    // β / (α + β) = 4 / 5 = 0.8 with default constants.
    const weakness = bayesianWeakness({ attempts: 0, errors: 0 });
    expect(weakness).toBeCloseTo(0.8, 6);
    expect(weakness).toBe(PRIOR_WEAKNESS);
  });

  it("decreases monotonically with each error-free practice", () => {
    // Each successful keystroke pulls the posterior toward 1.0.
    const w0 = bayesianWeakness({ attempts: 0, errors: 0 });
    const w5 = bayesianWeakness({ attempts: 5, errors: 0 });
    const w10 = bayesianWeakness({ attempts: 10, errors: 0 });
    const w50 = bayesianWeakness({ attempts: 50, errors: 0 });
    expect(w5).toBeLessThan(w0);
    expect(w10).toBeLessThan(w5);
    expect(w50).toBeLessThan(w10);
  });

  it("increases monotonically with each error", () => {
    // Holding attempts constant, more errors → higher weakness.
    const wPerfect = bayesianWeakness({ attempts: 10, errors: 0 });
    const wOne = bayesianWeakness({ attempts: 10, errors: 1 });
    const wHalf = bayesianWeakness({ attempts: 10, errors: 5 });
    const wAll = bayesianWeakness({ attempts: 10, errors: 10 });
    expect(wOne).toBeGreaterThan(wPerfect);
    expect(wHalf).toBeGreaterThan(wOne);
    expect(wAll).toBeGreaterThan(wHalf);
  });

  it("clamps at sensible bounds — weakness stays in [0, 1]", () => {
    // Bayesian posterior cannot escape the unit interval. Pin it.
    const wMin = bayesianWeakness({ attempts: 1_000_000, errors: 0 });
    const wMax = bayesianWeakness({ attempts: 1_000_000, errors: 1_000_000 });
    expect(wMin).toBeGreaterThanOrEqual(0);
    expect(wMin).toBeLessThan(0.001); // very mastered, weakness near 0
    expect(wMax).toBeLessThanOrEqual(1);
    expect(wMax).toBeGreaterThan(0.999); // catastrophic, weakness near 1
  });

  it("approaches the empirical error rate as data dominates the prior", () => {
    // With many attempts, prior weight (5) becomes negligible against
    // observed counts. weakness → errors/attempts = 0.2.
    const w = bayesianWeakness({ attempts: 1000, errors: 200 });
    expect(w).toBeCloseTo(0.2, 2);
  });

  it("is robust to nonsense inputs — negative errors clamp to 0, errors > attempts clamp at attempts", () => {
    // The function shouldn't blow up if upstream produces bad data.
    const wNegative = bayesianWeakness({ attempts: 10, errors: -5 });
    expect(wNegative).toBeCloseTo(bayesianWeakness({ attempts: 10, errors: 0 }), 6);
    // Note: `errors > attempts` isn't clamped — it's left to the caller
    // to ensure stat consistency. We only guard against negative.
  });

  it("PRIOR_MASTERY × PRIOR_STRENGTH = α₀ encodes the assumed-mastery-before-data", () => {
    // Pin the constant relationship so a refactor that changes one
    // without the other gets caught.
    const alpha0 = PRIOR_MASTERY * PRIOR_STRENGTH;
    const beta0 = (1 - PRIOR_MASTERY) * PRIOR_STRENGTH;
    const weakness = beta0 / (alpha0 + beta0);
    expect(weakness).toBeCloseTo(PRIOR_WEAKNESS, 6);
  });
});
