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

describe("selectTarget — cold-start fallback", () => {
  it("returns diagnostic when stats are empty AND no corpus support is provided", () => {
    // True cold start — no signal anywhere. Without a corpus, the
    // Bayesian engine has no characters to enumerate; motion targets
    // with empty stats produce score-0 candidates. Fall back to
    // diagnostic rather than arbitrarily pick one.
    const chosen = selectTarget(statsWith(), baseline(), "transitioning", freq);
    expect(chosen.type).toBe("diagnostic");
  });

  it("falls back to diagnostic when corpus is provided but no chars have been measured", () => {
    // Path 2 (post-tuning): the ranker only includes MEASURED
    // candidates. Unmeasured corpus chars are explored via the
    // periodic diagnostic, not by enumerating them at the prior.
    // With empty stats there's nothing to rank → diagnostic.
    const charSupport = new Map<string, number>([["a", 100]]);
    const chosen = selectTarget(statsWith(), baseline(), "transitioning", freq, {
      corpusCharSupport: charSupport,
    });
    expect(chosen.type).toBe("diagnostic");
  });

  it("does NOT fall back when stats have sub-threshold attempts — Bayesian posterior still ranks", () => {
    // Pre-Path-2 the engine excluded chars with <5 attempts and
    // returned diagnostic. Path 2 keeps them in the ranking via the
    // Bayesian posterior (1 attempt + prior is still rankable).
    const chosen = selectTarget(
      statsWith([{ character: "g", attempts: 2, errors: 1, sumTime: 500, hesitationCount: 0 }]),
      baseline(),
      "transitioning",
      freq,
    );
    expect(chosen.type).not.toBe("diagnostic");
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

  it("score on returned SessionTarget is engine score × journey weight", () => {
    // Path 2: under Bayesian aggregation, individual chars can beat
    // their column when they're individually worse than the column
    // average. Here 'g' (30% errors) is worse than the b/g/t aggregate
    // (25% errors), so character 'g' wins even with the columnar
    // 1.2× boost on inner-column. The test now just verifies the
    // returned score is the journey-weighted Bayesian weakness, not
    // a specific candidate-type assertion.
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
    expect(chosen.score).toBeGreaterThan(0);
    expect(chosen.score).toBeLessThanOrEqual(1.5); // Bayesian × weight stays bounded
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

  it("returns rankable candidates even when stats are sub-threshold (Bayesian posterior)", () => {
    // Pre-Path-2: this test asserted `[]` because LOW_CONFIDENCE_THRESHOLD
    // filtered out chars with <5 attempts. Under Path 2's Bayesian
    // model, sub-threshold stats are still rankable — the posterior
    // is dominated by the prior but produces a real score.
    const ranked = rankTargets(
      statsWith([{ character: "g", attempts: 1, errors: 0, sumTime: 200, hesitationCount: 0 }], []),
      baseline(),
      "transitioning",
      freq,
    );
    expect(ranked.length).toBeGreaterThan(0);
    const g = ranked.find((c) => c.type === "character" && c.value === "g");
    expect(g).toBeDefined();
    // 1 success, 0 errors → posterior α=2, β=4 → weakness 4/6 ≈ 0.667.
    // Multiplied by character journey weight 1.0 = 0.667.
    expect(g?.score).toBeCloseTo(4 / 6, 3);
  });

  it("applies decay to bigrams whose corpus support is 0, letting next-ranked practicable targets win", () => {
    // Construct stats where "xw" is the top bigram weakness and "yd" is
    // second. With the penalty (0.5×), xw's score should drop below yd's.
    const stats = statsWith(
      [{ character: "a", attempts: 100, errors: 1, sumTime: 28_000, hesitationCount: 0 }],
      [
        { bigram: "xw", attempts: 40, errors: 22, sumTime: 18_000 },
        { bigram: "yd", attempts: 40, errors: 20, sumTime: 17_000 },
      ],
    );
    const support = new Map<string, number>([
      ["xw", 0],
      ["yd", 8],
    ]);
    const ranked = rankTargets(stats, baseline(), "transitioning", freq, {
      corpusBigramSupport: support,
    });
    const [top] = ranked;
    expect(top?.type).toBe("bigram");
    expect(top?.value).toBe("yd");
  });

  it("does not apply decay when the bigram has corpus support at or above the threshold", () => {
    const stats = statsWith(
      [{ character: "a", attempts: 100, errors: 1, sumTime: 28_000, hesitationCount: 0 }],
      [
        { bigram: "xw", attempts: 40, errors: 22, sumTime: 18_000 },
        { bigram: "yd", attempts: 40, errors: 20, sumTime: 17_000 },
      ],
    );
    // Both bigrams have support at/above threshold (3) — xw keeps its lead.
    const support = new Map<string, number>([
      ["xw", 5],
      ["yd", 8],
    ]);
    const ranked = rankTargets(stats, baseline(), "transitioning", freq, {
      corpusBigramSupport: support,
    });
    const [top] = ranked;
    expect(top?.value).toBe("xw");
  });

  it("applies decay to bigrams whose support is between 1 and threshold-1 (boundary case)", () => {
    // Same stats as above, but xw has support=2 — below the threshold
    // of 3. Decay must fire (xw → yd), same as the support=0 case.
    // This pins the `<` comparison: if a future refactor switched to
    // `=== 0`, this test would fail.
    const stats = statsWith(
      [{ character: "a", attempts: 100, errors: 1, sumTime: 28_000, hesitationCount: 0 }],
      [
        { bigram: "xw", attempts: 40, errors: 22, sumTime: 18_000 },
        { bigram: "yd", attempts: 40, errors: 20, sumTime: 17_000 },
      ],
    );
    const support = new Map<string, number>([
      ["xw", 2],
      ["yd", 8],
    ]);
    const ranked = rankTargets(stats, baseline(), "transitioning", freq, {
      corpusBigramSupport: support,
    });
    const [top] = ranked;
    expect(top?.value).toBe("yd");
  });
});

describe("rankTargets — Path 2 Bayesian behaviors", () => {
  it("excludes unmeasured corpus characters — exploration is delegated to DIAGNOSTIC_PERIOD", () => {
    // Path 2 (post-tuning): the ranker no longer enumerates the prior.
    // Unmeasured chars get explored via the periodic diagnostic. This
    // pins the swarm-effect fix where 676 unmeasured bigrams at the
    // prior weakness used to crowd out the user's actual measured
    // weaknesses in the argmax.
    const charSupport = new Map<string, number>([
      ["a", 100],
      ["b", 50],
      ["c", 25],
    ]);
    const ranked = rankTargets(statsWith(), baseline(), "transitioning", freq, {
      corpusCharSupport: charSupport,
    });
    expect(ranked.filter((c) => c.type === "character")).toEqual([]);
  });

  it("excludes corpus characters with support === 0 (drill-key cross-layer guard)", () => {
    // `;` has support 0 → not a real corpus letter → must not appear
    // as a candidate even though it might exist in stats from drill mode.
    const charSupport = new Map<string, number>([
      ["a", 100],
      [";", 0],
    ]);
    const ranked = rankTargets(statsWith(), baseline(), "transitioning", freq, {
      corpusCharSupport: charSupport,
    });
    expect(ranked.find((c) => c.value === ";")).toBeUndefined();
  });

  it("ranks only measured chars — unmeasured chars are deferred to the diagnostic", () => {
    // Path 2 (post-tuning): unmeasured `b` doesn't appear in the
    // ranker. Measured `a` (50% errors over 100 attempts) is the
    // only character candidate; the diagnostic period will surface
    // `b` separately when it's its turn.
    const charSupport = new Map<string, number>([
      ["a", 100],
      ["b", 100],
    ]);
    const ranked = rankTargets(
      statsWith([
        { character: "a", attempts: 100, errors: 50, sumTime: 30_000, hesitationCount: 0 },
      ]),
      baseline(),
      "transitioning",
      freq,
      { corpusCharSupport: charSupport },
    );
    expect(ranked.find((c) => c.type === "character" && c.value === "a")).toBeDefined();
    expect(ranked.find((c) => c.type === "character" && c.value === "b")).toBeUndefined();
  });

  it("excludes a value that's been the target for the last COOLDOWN_RUN_LENGTH - 1 sessions", () => {
    // Both chars must be measured to even appear in the post-tuning
    // ranker; cooldown then drops `a` for one cycle.
    const charSupport = new Map<string, number>([
      ["a", 100],
      ["b", 100],
    ]);
    const ranked = rankTargets(
      statsWith([
        { character: "a", attempts: 50, errors: 20, sumTime: 15_000, hesitationCount: 0 },
        { character: "b", attempts: 50, errors: 20, sumTime: 15_000, hesitationCount: 0 },
      ]),
      baseline(),
      "transitioning",
      freq,
      {
        corpusCharSupport: charSupport,
        recentTargets: ["a", "a"], // 2 in a row → cooldown
      },
    );
    expect(ranked.find((c) => c.value === "a")).toBeUndefined();
    expect(ranked.find((c) => c.value === "b")).toBeDefined();
  });
});

describe("selectTarget — periodic diagnostic", () => {
  it("returns diagnostic on every DIAGNOSTIC_PERIOD-th session regardless of argmax", () => {
    const charSupport = new Map<string, number>([["a", 100]]);
    const session10 = selectTarget(statsWith(), baseline(), "transitioning", freq, {
      corpusCharSupport: charSupport,
      upcomingSessionNumber: 10,
    });
    expect(session10.type).toBe("diagnostic");
    const session20 = selectTarget(statsWith(), baseline(), "transitioning", freq, {
      corpusCharSupport: charSupport,
      upcomingSessionNumber: 20,
    });
    expect(session20.type).toBe("diagnostic");
  });

  it("does not return diagnostic on non-multiple sessions", () => {
    // Need at least one measured stat for the post-tuning ranker to
    // return a non-diagnostic candidate. Empty stats now correctly
    // fall back to diagnostic regardless of `upcomingSessionNumber`.
    const charSupport = new Map<string, number>([["a", 100]]);
    const stats = statsWith([
      { character: "a", attempts: 100, errors: 20, sumTime: 30_000, hesitationCount: 0 },
    ]);
    for (const n of [1, 2, 3, 5, 7, 9, 11]) {
      const chosen = selectTarget(stats, baseline(), "transitioning", freq, {
        corpusCharSupport: charSupport,
        upcomingSessionNumber: n,
      });
      expect(chosen.type).not.toBe("diagnostic");
    }
  });
});
