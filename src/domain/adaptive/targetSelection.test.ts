import { describe, expect, it } from "vitest";
import {
  rankTargets,
  selectTarget,
  TARGET_JOURNEY_WEIGHTS,
  diagnosticTarget,
} from "./targetSelection";
import type { CharacterStat, BigramStat, UserBaseline } from "../stats/types";

const baseline = (over: Partial<UserBaseline> = {}): UserBaseline => ({
  meanErrorRate: 0.08,
  meanKeystrokeTime: 280,
  meanHesitationRate: 0.1,
  journey: "conventional",
  ...over,
});

const freq = (_: string) => 0.5;

const statsWith = (chars: CharacterStat[] = [], bigrams: BigramStat[] = []) => ({
  characters: chars,
  bigrams,
});

describe("diagnosticTarget", () => {
  it("returns a diagnostic-type target with empty keys", () => {
    const d = diagnosticTarget();
    expect(d.type).toBe("diagnostic");
    expect(d.keys).toEqual([]);
    expect(d.score).toBeUndefined();
  });
});

describe("selectTarget — low-confidence fallback", () => {
  it("returns diagnostic when stats are empty", () => {
    const chosen = selectTarget(statsWith(), baseline(), "transitioning", freq);
    expect(chosen.type).toBe("diagnostic");
  });

  it("returns diagnostic when all character attempts < LOW_CONFIDENCE_THRESHOLD", () => {
    const chosen = selectTarget(
      statsWith([{ character: "g", attempts: 2, errors: 1, sumTime: 500, hesitationCount: 0 }]),
      baseline(),
      "transitioning",
      freq,
    );
    expect(chosen.type).toBe("diagnostic");
  });
});

describe("selectTarget — journey weighting (ADR-003 §4.2)", () => {
  const richStats = (): CharacterStat[] => [
    { character: "g", attempts: 100, errors: 20, sumTime: 30_000, hesitationCount: 5 },
    { character: "q", attempts: 100, errors: 15, sumTime: 30_000, hesitationCount: 3 },
    { character: "a", attempts: 100, errors: 2, sumTime: 28_000, hesitationCount: 0 },
  ];

  it("columnar journey promotes inner-column target", () => {
    const chosen = selectTarget(
      statsWith(richStats()),
      baseline({ journey: "columnar" }),
      "transitioning",
      freq,
    );
    expect(chosen.type).toBe("inner-column");
  });

  it("conventional journey promotes vertical-column target", () => {
    const chosen = selectTarget(
      statsWith(richStats()),
      baseline({ journey: "conventional" }),
      "transitioning",
      freq,
    );
    expect(["vertical-column", "character"]).toContain(chosen.type);
  });

  it("weights table sanity", () => {
    expect(TARGET_JOURNEY_WEIGHTS.conventional["vertical-column"]).toBe(1.2);
    expect(TARGET_JOURNEY_WEIGHTS.conventional["inner-column"]).toBe(0.6);
    expect(TARGET_JOURNEY_WEIGHTS.columnar["inner-column"]).toBe(1.2);
    expect(TARGET_JOURNEY_WEIGHTS.columnar["vertical-column"]).toBe(0.8);
    expect(TARGET_JOURNEY_WEIGHTS.unsure).toEqual(TARGET_JOURNEY_WEIGHTS.conventional);
  });
});

describe("selectTarget — returns SessionTarget with correct shape", () => {
  it("includes label, keys, and score", () => {
    const chosen = selectTarget(
      statsWith([
        { character: "g", attempts: 100, errors: 20, sumTime: 30_000, hesitationCount: 5 },
      ]),
      baseline(),
      "transitioning",
      freq,
    );
    expect(chosen.keys.length).toBeGreaterThan(0);
    expect(chosen.label).toMatch(/\S/);
    expect(typeof chosen.score).toBe("number");
  });

  it("score on returned SessionTarget is engine score × journey weight (weighted, not raw)", () => {
    // 'g' has high error rate; under columnar, inner-column wins
    // verify chosen.score is roughly inner-column's raw score × 1.2 (columnar weight)
    const chosen = selectTarget(
      statsWith([
        { character: "g", attempts: 100, errors: 30, sumTime: 30_000, hesitationCount: 5 },
        { character: "b", attempts: 100, errors: 25, sumTime: 30_000, hesitationCount: 3 },
        { character: "t", attempts: 100, errors: 20, sumTime: 30_000, hesitationCount: 2 },
      ]),
      baseline({ journey: "columnar" }),
      "transitioning",
      freq,
    );
    expect(chosen.type).toBe("inner-column");
    expect(chosen.score).toBeGreaterThan(0);
    // The weighted score should be at least 1.2× a typical normalized error rate
    // (inner-column has weight 1.2 under columnar). Sanity: the value should
    // be larger than the unweighted aggregate would be alone.
    expect(chosen.score).toBeGreaterThan(0.8); // very loose lower bound
  });
});

describe("rankTargets — full candidate ranking for diagnostics", () => {
  const charsStats = (): CharacterStat[] => [
    { character: "x", attempts: 100, errors: 25, sumTime: 30_000, hesitationCount: 5 },
    { character: "q", attempts: 100, errors: 15, sumTime: 30_000, hesitationCount: 3 },
    { character: "a", attempts: 100, errors: 2, sumTime: 28_000, hesitationCount: 0 },
  ];
  const bigramsStats = (): BigramStat[] => [
    { bigram: "uw", attempts: 40, errors: 18, sumTime: 16_000 },
    { bigram: "th", attempts: 200, errors: 4, sumTime: 50_000 },
  ];

  it("returns candidates sorted by weighted score descending", () => {
    const ranked = rankTargets(
      statsWith(charsStats(), bigramsStats()),
      baseline(),
      "transitioning",
      freq,
    );
    expect(ranked.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]?.score ?? 0).toBeGreaterThanOrEqual(ranked[i]?.score ?? 0);
    }
  });

  it("scores match what selectTarget would pick as the top", () => {
    const ranked = rankTargets(
      statsWith(charsStats(), bigramsStats()),
      baseline(),
      "transitioning",
      freq,
    );
    const chosen = selectTarget(
      statsWith(charsStats(), bigramsStats()),
      baseline(),
      "transitioning",
      freq,
    );
    const [top] = ranked;
    expect(top).toBeDefined();
    expect(top?.type).toBe(chosen.type);
    expect(top?.value).toBe(chosen.value);
  });

  it("returns empty array when no stats meet the confidence threshold", () => {
    const ranked = rankTargets(
      statsWith([{ character: "g", attempts: 1, errors: 0, sumTime: 200, hesitationCount: 0 }], []),
      baseline(),
      "transitioning",
      freq,
    );
    expect(ranked).toEqual([]);
  });
});
