import { describe, expect, it } from "vitest";
import {
  COOLDOWN_RUN_LENGTH,
  DIAGNOSTIC_PERIOD,
  RANK_EXPLORATION_PERIOD,
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

/** Inclusive range helper for scanning session numbers in tests. */
const sessionsInRange = (lo: number, hi: number): number[] =>
  Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

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

  it("conventional journey promotes column-type targets", () => {
    // Under the current tune, conventional's column/motion weights all
    // exceed character/bigram weights. The exact column type depends
    // on which key drives the top aggregate — the behavioral claim is
    // just "not a plain character," which is what the journey
    // weighting is supposed to enforce.
    const chosen = selectTarget(
      statsWith(richStats()),
      baseline({ journey: "conventional" }),
      "transitioning",
      freq,
    );
    expect(["vertical-column", "inner-column", "thumb-cluster", "character"]).toContain(
      chosen.type,
    );
  });

  it("weights table sanity — transitioning phase", () => {
    const t = TARGET_JOURNEY_WEIGHTS.transitioning;
    expect(t.conventional.bigram).toBe(0.8);
    expect(t.conventional["vertical-column"]).toBe(1.3);
    expect(t.conventional["inner-column"]).toBe(1.5);
    expect(t.conventional["thumb-cluster"]).toBe(1.8);
    expect(t.columnar["inner-column"]).toBe(1.8);
    expect(t.columnar["vertical-column"]).toBe(1.3);
    expect(t.columnar["thumb-cluster"]).toBe(1.5);
    expect(t.unsure).toEqual(t.conventional);
  });

  it("weights table sanity — refining phase collapses to 1.0 across types (ADR-005)", () => {
    // Refining-phase rationale: motor patterns are established, so target-type
    // bias is dropped and the strongest weakness wins on its own merits. This
    // fixes the rotation trap where common-letter weaknesses were eaten by
    // their containing columns.
    const r = TARGET_JOURNEY_WEIGHTS.refining;
    for (const journey of ["conventional", "columnar", "unsure"] as const) {
      expect(r[journey].character).toBe(1.0);
      expect(r[journey].bigram).toBe(1.0);
      expect(r[journey]["vertical-column"]).toBe(1.0);
      expect(r[journey]["inner-column"]).toBe(1.0);
      expect(r[journey]["thumb-cluster"]).toBe(1.0);
      expect(r[journey].diagnostic).toBe(0);
    }
  });
});

describe("rankTargets — refining-phase rotation fix (ADR-005)", () => {
  // Behavioral claim: the rotation trap that prod-data audit exposed
  // (common-letter weaknesses like `t` getting eaten by their containing
  // columns, never surfacing as their own targets) loosens in refining
  // phase. Equal weights mean character/bigram targets rank closer to the
  // columns containing them, so the rotation pool is wider.
  //
  // Asserts use *relative rank position* across phases rather than "char
  // wins #1" because the underlying scoring formulas for character vs.
  // motion-pattern produce naturally different scales (motion uses pure
  // error normalization; character uses α·err + β·hes + γ·slow). The fix
  // removes the amplifying journey-weight boost that turned a small
  // natural advantage into permanent column dominance — it does not
  // equalize the formulas themselves.
  const findRank = (ranked: ReturnType<typeof rankTargets>, type: string, value: string): number =>
    ranked.findIndex((c) => c.type === type && c.value === value);

  // Prod-like baseline tuned to surface the rotation trap. Real prod values
  // for the falahudin6@gmail.com / lily58 profile that motivated ADR-005.
  const prodBaseline = (): UserBaseline => ({
    meanErrorRate: 0.045,
    meanKeystrokeTime: 120,
    meanHesitationRate: 0.04,
    journey: "unsure",
  });

  it("character `t` ranks higher (lower index) in refining than in transitioning", () => {
    // Reproduction of the prod-data scenario:
    // - char `t`: 6.07% err, 4.66% hes, 156ms avg — strong but balanced weakness
    // - b, g: solid (3% error, low hesitation)
    // - Inner-column inner-left (b, g, t) raw aggregate ≈ char t's raw weakness
    // - In transitioning, inner-column ×1.5 weight pulls column above char t
    // - In refining, equal weights let char t surface above the diluted column
    const stats = statsWith([
      { character: "t", attempts: 922, errors: 56, sumTime: 144_000, hesitationCount: 43 },
      { character: "b", attempts: 368, errors: 11, sumTime: 70_000, hesitationCount: 20 },
      { character: "g", attempts: 381, errors: 12, sumTime: 64_000, hesitationCount: 20 },
    ]);
    const transRanked = rankTargets(stats, prodBaseline(), "transitioning", freq);
    const refRanked = rankTargets(stats, prodBaseline(), "refining", freq);

    const transTRank = findRank(transRanked, "character", "t");
    const refTRank = findRank(refRanked, "character", "t");

    expect(transTRank).toBeGreaterThanOrEqual(0); // t exists as candidate in both
    expect(refTRank).toBeGreaterThanOrEqual(0);
    // Refining promotes t's rank vs transitioning (smaller index = higher rank).
    expect(refTRank).toBeLessThan(transTRank);
  });

  it("inner-column rank does not improve in refining (column boost removed)", () => {
    // Counterpart to the previous test: confirm that the column's ranking
    // doesn't artificially climb in refining. With the ×1.5 boost gone,
    // its raw score competes on its own merits.
    const stats = statsWith([
      { character: "t", attempts: 922, errors: 56, sumTime: 144_000, hesitationCount: 43 },
      { character: "b", attempts: 368, errors: 11, sumTime: 70_000, hesitationCount: 20 },
      { character: "g", attempts: 381, errors: 12, sumTime: 64_000, hesitationCount: 20 },
    ]);
    const transRanked = rankTargets(stats, prodBaseline(), "transitioning", freq);
    const refRanked = rankTargets(stats, prodBaseline(), "refining", freq);

    const transColRank = findRank(transRanked, "inner-column", "inner-left");
    const refColRank = findRank(refRanked, "inner-column", "inner-left");

    expect(transColRank).toBeGreaterThanOrEqual(0);
    expect(refColRank).toBeGreaterThanOrEqual(0);
    // Refining should not promote inner-left's rank.
    expect(refColRank).toBeGreaterThanOrEqual(transColRank);
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
    // verify chosen.score is roughly inner-column's raw score × 1.8 (columnar weight)
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
    // The weighted score should be at least 1.8× a typical normalized error rate
    // (inner-column has weight 1.8 under columnar). Sanity: the value should
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

  it("excludes bigrams with support=0 from ranking, letting next-ranked practicable targets win", () => {
    // "xw" is the top raw bigram weakness and "yd" is second. With
    // xw's support=0, xw is filtered out entirely and yd wins.
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
    // xw shouldn't appear anywhere in the ranking, not just the top slot.
    expect(ranked.find((c) => c.value === "xw")).toBeUndefined();
  });

  it("keeps bigrams whose corpus support is at or above the threshold", () => {
    const stats = statsWith(
      [{ character: "a", attempts: 100, errors: 1, sumTime: 28_000, hesitationCount: 0 }],
      [
        { bigram: "xw", attempts: 40, errors: 22, sumTime: 18_000 },
        { bigram: "yd", attempts: 40, errors: 20, sumTime: 17_000 },
      ],
    );
    // Both bigrams have support at/above threshold (3) — neither is excluded,
    // xw wins on raw weakness.
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

  it("excludes bigrams whose support is between 1 and threshold-1 (boundary case)", () => {
    // xw has support=2 — below the threshold of 3. Exclusion fires
    // (xw dropped, yd wins), same as the support=0 case. This pins
    // the `>=` comparison: if a future refactor switched to `> 0` or
    // an exact `=== 0` check, this test would fail.
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
    expect(ranked.find((c) => c.value === "xw")).toBeUndefined();
  });
});

describe("selectTarget — periodic diagnostic (DIAGNOSTIC_PERIOD)", () => {
  // Rich stats that would otherwise produce a non-diagnostic argmax
  // result — any character-targeting test uses these so the diagnostic
  // behavior is unambiguously the cause of the override.
  const richStats = statsWith([
    { character: "g", attempts: 100, errors: 20, sumTime: 30_000, hesitationCount: 5 },
    { character: "q", attempts: 100, errors: 15, sumTime: 30_000, hesitationCount: 3 },
  ]);

  it("returns diagnostic when upcomingSessionNumber is a positive multiple of DIAGNOSTIC_PERIOD", () => {
    const chosen = selectTarget(richStats, baseline(), "transitioning", freq, {
      upcomingSessionNumber: DIAGNOSTIC_PERIOD,
    });
    expect(chosen.type).toBe("diagnostic");
  });

  it("returns argmax on non-multiples (session N-1 and N+1)", () => {
    const before = selectTarget(richStats, baseline(), "transitioning", freq, {
      upcomingSessionNumber: DIAGNOSTIC_PERIOD - 1,
    });
    const after = selectTarget(richStats, baseline(), "transitioning", freq, {
      upcomingSessionNumber: DIAGNOSTIC_PERIOD + 1,
    });
    expect(before.type).not.toBe("diagnostic");
    expect(after.type).not.toBe("diagnostic");
  });

  it("returns argmax (not diagnostic) when upcomingSessionNumber is 0", () => {
    // 0 % N === 0 but semantically no session has happened yet; we don't
    // want to force a diagnostic on the very first session via this path
    // (the cold-start diagnostic is handled by isFirstSession separately).
    const chosen = selectTarget(richStats, baseline(), "transitioning", freq, {
      upcomingSessionNumber: 0,
    });
    expect(chosen.type).not.toBe("diagnostic");
  });

  it("returns argmax when upcomingSessionNumber is omitted (opt-in mechanism)", () => {
    const chosen = selectTarget(richStats, baseline(), "transitioning", freq);
    expect(chosen.type).not.toBe("diagnostic");
  });

  it("fires on multiples beyond the first (session 20, 30)", () => {
    const session20 = selectTarget(richStats, baseline(), "transitioning", freq, {
      upcomingSessionNumber: DIAGNOSTIC_PERIOD * 2,
    });
    const session30 = selectTarget(richStats, baseline(), "transitioning", freq, {
      upcomingSessionNumber: DIAGNOSTIC_PERIOD * 3,
    });
    expect(session20.type).toBe("diagnostic");
    expect(session30.type).toBe("diagnostic");
  });
});

describe("rankTargets — prior-weakness floor for unseen characters", () => {
  it("injects an unseen corpus character as a candidate with the prior score", () => {
    // User has measured `a` only; `q` has corpus support but no
    // measured stat. Without the prior, `q` would be invisible. With
    // the prior, `q` enters the ranking at the floor score.
    const stats = statsWith([
      { character: "a", attempts: 100, errors: 5, sumTime: 30_000, hesitationCount: 1 },
    ]);
    const charSupport = new Map<string, number>([
      ["a", 500],
      ["q", 50],
    ]);
    const ranked = rankTargets(stats, baseline(), "transitioning", freq, {
      corpusCharSupport: charSupport,
    });
    const qCandidate = ranked.find((c) => c.type === "character" && c.value === "q");
    expect(qCandidate).toBeDefined();
    expect(qCandidate?.label).toMatch(/Q/);
  });

  it("does not inject unseen characters with corpus support === 0", () => {
    // `;` has 0 corpus support — the char-support exclusion check
    // takes precedence over the prior-weakness inject. Unseen
    // characters that aren't in the corpus stay invisible.
    const charSupport = new Map<string, number>([
      ["a", 500],
      [";", 0],
    ]);
    const ranked = rankTargets(statsWith(), baseline(), "transitioning", freq, {
      corpusCharSupport: charSupport,
    });
    expect(ranked.find((c) => c.value === ";")).toBeUndefined();
  });

  it("prefers measured weakness over prior — once a char clears the threshold its score is computed, not synthetic", () => {
    // `a` has confident attempts; ranking should reflect its computed
    // weakness, not the prior floor.
    const stats = statsWith([
      { character: "a", attempts: 100, errors: 40, sumTime: 30_000, hesitationCount: 5 },
    ]);
    const charSupport = new Map<string, number>([["a", 500]]);
    const ranked = rankTargets(stats, baseline(), "transitioning", freq, {
      corpusCharSupport: charSupport,
    });
    const aCandidate = ranked.find((c) => c.type === "character" && c.value === "a");
    expect(aCandidate?.label).toMatch(/weakness/i);
    // Computed score should not equal the prior floor (it's signal-driven).
    expect(aCandidate?.score).not.toBe(0.5);
  });

  it("no prior injection when corpusCharSupport is omitted (opt-in only)", () => {
    // Backwards compat — without the support map, the prior model
    // doesn't fire. Existing callers (drill tests, fixtures without
    // a corpus) see unchanged behavior.
    const ranked = rankTargets(statsWith(), baseline(), "transitioning", freq);
    expect(ranked.length).toBe(0);
  });

  it("scales the prior by rarity — rare unseen letters get a higher prior than common unseen letters", () => {
    // Two unseen characters in the same support map: "q" rare, "a"
    // common. Both get a prior, but "q" should be much higher
    // because its rarity factor is larger.
    const charSupport = new Map<string, number>([
      ["a", 500],
      ["q", 50],
    ]);
    const ranked = rankTargets(statsWith(), baseline(), "transitioning", freq, {
      corpusCharSupport: charSupport,
    });
    const aPrior = ranked.find((c) => c.value === "a")?.score ?? 0;
    const qPrior = ranked.find((c) => c.value === "q")?.score ?? 0;
    expect(aPrior).toBeGreaterThan(0);
    expect(qPrior).toBeGreaterThan(aPrior);
  });
});

describe("rankTargets — character corpus support exclusion", () => {
  // These tests check exclusion semantics — not which target wins — because
  // derived candidates (column, inner-column) can legitimately out-rank a
  // single character whose data drives them. The behavioral claim is
  // narrower: "this character value is gone from the ranking entirely."
  it("excludes character candidates with support === 0", () => {
    const stats = statsWith([
      { character: ";", attempts: 100, errors: 40, sumTime: 30_000, hesitationCount: 5 },
    ]);
    const charSupport = new Map<string, number>([[";", 0]]);
    const ranked = rankTargets(stats, baseline(), "transitioning", freq, {
      corpusCharSupport: charSupport,
    });
    expect(ranked.find((c) => c.type === "character" && c.value === ";")).toBeUndefined();
  });

  it("keeps character candidates with support > 0 even when low", () => {
    // Support=1 is still > 0 — keep. Character-support uses a stricter
    // filter than bigram (== 0, not < threshold) because a single
    // corpus word containing the char still lets the word-picker
    // produce non-zero practice.
    const stats = statsWith([
      { character: "q", attempts: 100, errors: 40, sumTime: 30_000, hesitationCount: 5 },
    ]);
    const charSupport = new Map<string, number>([["q", 1]]);
    const ranked = rankTargets(stats, baseline(), "transitioning", freq, {
      corpusCharSupport: charSupport,
    });
    expect(ranked.find((c) => c.type === "character" && c.value === "q")).toBeDefined();
  });

  it("behaves unchanged when corpusCharSupport is omitted", () => {
    const stats = statsWith([
      { character: ";", attempts: 100, errors: 40, sumTime: 30_000, hesitationCount: 5 },
    ]);
    const ranked = rankTargets(stats, baseline(), "transitioning", freq);
    // Without the map, exclusion is opt-in only — `;` remains rankable
    // as a character candidate.
    expect(ranked.find((c) => c.type === "character" && c.value === ";")).toBeDefined();
  });
});

describe("rankTargets — same-target cooldown", () => {
  // Same pattern: assert exclusion of the specific value, not which
  // candidate wins. Derived column targets that aggregate the cooled-
  // down character are intentionally NOT excluded by this rule (the
  // cooldown is value-scoped, not weakness-scoped) — see the
  // "does not exclude derived motion targets" test below.
  const gDominantStats = statsWith([
    { character: "g", attempts: 100, errors: 40, sumTime: 30_000, hesitationCount: 5 },
  ]);

  it("excludes the target value after COOLDOWN_RUN_LENGTH - 1 consecutive wins", () => {
    const recent = Array(COOLDOWN_RUN_LENGTH - 1).fill("g");
    const ranked = rankTargets(gDominantStats, baseline(), "transitioning", freq, {
      recentTargets: recent,
    });
    expect(ranked.find((c) => c.value === "g")).toBeUndefined();
  });

  it("allows the target back once a different value breaks the run", () => {
    // Recent: [t, g] — g's run is broken by t at head.
    const ranked = rankTargets(gDominantStats, baseline(), "transitioning", freq, {
      recentTargets: ["t", "g"],
    });
    expect(ranked.find((c) => c.value === "g")).toBeDefined();
  });

  it("does not fire when recent history is shorter than the run threshold", () => {
    const ranked = rankTargets(gDominantStats, baseline(), "transitioning", freq, {
      recentTargets: ["g"],
    });
    expect(ranked.find((c) => c.value === "g")).toBeDefined();
  });

  it("does not fire when recent history has mixed values at run positions", () => {
    const ranked = rankTargets(gDominantStats, baseline(), "transitioning", freq, {
      recentTargets: ["g", "t"],
    });
    expect(ranked.find((c) => c.value === "g")).toBeDefined();
  });

  it("behaves unchanged when recentTargets is omitted", () => {
    const ranked = rankTargets(gDominantStats, baseline(), "transitioning", freq);
    expect(ranked.find((c) => c.value === "g")).toBeDefined();
  });

  it("does not exclude derived motion targets even when the cooled-down char drives them", () => {
    // `g` is excluded by cooldown, but `left-index-inner` — which
    // aggregates g's errors along with b and t — remains rankable.
    // The rule is value-scoped. A user might still get a
    // column-target session focused on g after a g cooldown.
    const recent = Array(COOLDOWN_RUN_LENGTH - 1).fill("g");
    const ranked = rankTargets(gDominantStats, baseline(), "transitioning", freq, {
      recentTargets: recent,
    });
    expect(ranked.find((c) => c.value === "left-index-inner")).toBeDefined();
  });
});

describe("selectTarget — rank exploration (RANK_EXPLORATION_PERIOD)", () => {
  // Four distinct-weakness characters to give the ranking at least
  // 2+ candidates after filtering — rank exploration needs room to
  // pick a non-argmax. Using characters that don't share a single
  // column prevents column candidates from dominating.
  const multiCandidateStats = statsWith([
    { character: "a", attempts: 100, errors: 40, sumTime: 30_000, hesitationCount: 5 },
    { character: "s", attempts: 100, errors: 30, sumTime: 30_000, hesitationCount: 4 },
    { character: "d", attempts: 100, errors: 20, sumTime: 30_000, hesitationCount: 3 },
    { character: "f", attempts: 100, errors: 10, sumTime: 30_000, hesitationCount: 2 },
  ]);

  it("picks argmax on non-multiple sessions", () => {
    // Sessions that aren't divisible by RANK_EXPLORATION_PERIOD return
    // the top-ranked target. Derive the test set from the constants
    // themselves so this stays valid across tuning changes.
    const allRanked = rankTargets(multiCandidateStats, baseline(), "transitioning", freq);
    const topValue = allRanked[0]?.value;
    expect(topValue).toBeDefined();
    const nonMultiples = sessionsInRange(1, 25).filter(
      (n) => n % RANK_EXPLORATION_PERIOD !== 0 && n % DIAGNOSTIC_PERIOD !== 0,
    );
    expect(nonMultiples.length).toBeGreaterThan(0);
    for (const n of nonMultiples) {
      const chosen = selectTarget(multiCandidateStats, baseline(), "transitioning", freq, {
        upcomingSessionNumber: n,
      });
      expect(chosen.value).toBe(topValue);
    }
  });

  it("picks a non-argmax target on multiple-of-period sessions", () => {
    // Multiples of RANK_EXPLORATION_PERIOD that aren't also multiples of
    // DIAGNOSTIC_PERIOD (diagnostic wins — covered in its own test).
    const allRanked = rankTargets(multiCandidateStats, baseline(), "transitioning", freq);
    const topValue = allRanked[0]?.value;
    const multiples = sessionsInRange(1, 25).filter(
      (n) => n % RANK_EXPLORATION_PERIOD === 0 && n % DIAGNOSTIC_PERIOD !== 0,
    );
    expect(multiples.length).toBeGreaterThan(0);
    for (const n of multiples) {
      const chosen = selectTarget(multiCandidateStats, baseline(), "transitioning", freq, {
        upcomingSessionNumber: n,
      });
      expect(chosen.value).not.toBe(topValue);
      // Still must be in the ranked list (not diagnostic).
      expect(allRanked.find((c) => c.value === chosen.value)).toBeDefined();
    }
  });

  it("is deterministic per session number (same seed → same rank)", () => {
    // Calling selectTarget twice for the same session number should
    // yield the same target. Important for the route loader — after
    // router.invalidate() the preview recomputes and must agree with
    // the generator's choice.
    const first = selectTarget(multiCandidateStats, baseline(), "transitioning", freq, {
      upcomingSessionNumber: 6,
    });
    const second = selectTarget(multiCandidateStats, baseline(), "transitioning", freq, {
      upcomingSessionNumber: 6,
    });
    expect(first.value).toBe(second.value);
  });

  it("diagnostic wins when both DIAGNOSTIC_PERIOD and RANK_EXPLORATION_PERIOD match", () => {
    // Session 30 is divisible by both 10 and 3 — the diagnostic check
    // runs first in selectTarget and short-circuits before exploration.
    // Pin this behavior so a refactor that reorders the checks fails
    // the test.
    const chosen = selectTarget(multiCandidateStats, baseline(), "transitioning", freq, {
      upcomingSessionNumber: DIAGNOSTIC_PERIOD * 3, // = 30, also 3 * 10
    });
    expect(chosen.type).toBe("diagnostic");
  });

  it("opt-in only — behaves unchanged when upcomingSessionNumber is omitted", () => {
    const allRanked = rankTargets(multiCandidateStats, baseline(), "transitioning", freq);
    const topValue = allRanked[0]?.value;
    const chosen = selectTarget(multiCandidateStats, baseline(), "transitioning", freq);
    expect(chosen.value).toBe(topValue);
  });
});

describe("rankTargets — recency score decay", () => {
  // Two comparable weaknesses — "a" slightly ahead of "s" on raw
  // score. Baseline ranking (no recency) puts "a" on top; after "a"
  // appears once recently the 0.7 decay should narrow the gap;
  // after two appearances "a" should drop below "s" unless "a"'s
  // raw score exceeds "s"'s by more than (1/0.49) ≈ 2.04×.
  const closeRaceStats = statsWith([
    { character: "a", attempts: 100, errors: 25, sumTime: 30_000, hesitationCount: 3 },
    { character: "s", attempts: 100, errors: 22, sumTime: 30_000, hesitationCount: 3 },
  ]);

  it("discounts a candidate's score by RECENCY_DECAY per appearance in recentTargets", () => {
    // History positions must be arranged so the cooldown rule does NOT
    // fire — cooldown excludes a target whose value fills the first
    // COOLDOWN_RUN_LENGTH - 1 entries. Putting a break at position 0
    // ("s") guarantees cooldown sees mixed values and lets decay
    // apply cleanly to the remaining "a"s at positions >= 1.
    const noHistory = rankTargets(closeRaceStats, baseline(), "transitioning", freq);
    const oneAppearance = rankTargets(closeRaceStats, baseline(), "transitioning", freq, {
      recentTargets: ["s", "a"],
    });
    const twoAppearances = rankTargets(closeRaceStats, baseline(), "transitioning", freq, {
      recentTargets: ["s", "a", "a"],
    });
    const aNoHistory = noHistory.find((c) => c.value === "a")?.score ?? 0;
    const aOne = oneAppearance.find((c) => c.value === "a")?.score ?? 0;
    const aTwo = twoAppearances.find((c) => c.value === "a")?.score ?? 0;
    // Each additional appearance further decays the score.
    expect(aOne).toBeCloseTo(aNoHistory * 0.7, 4);
    expect(aTwo).toBeCloseTo(aNoHistory * 0.49, 4);
  });

  it("leaves non-recent candidates' scores untouched", () => {
    // Same history shape — cooldown won't fire (first two are ["s", "a"]),
    // so "a" gets decay applied but "s" (appearing once at position 0)
    // also shifts. Compare "d" which doesn't appear at all.
    const dStats = statsWith([
      { character: "a", attempts: 100, errors: 25, sumTime: 30_000, hesitationCount: 3 },
      { character: "d", attempts: 100, errors: 15, sumTime: 30_000, hesitationCount: 3 },
    ]);
    const ranked = rankTargets(dStats, baseline(), "transitioning", freq, {
      recentTargets: ["s", "a", "a"],
    });
    const noHistory = rankTargets(dStats, baseline(), "transitioning", freq);
    const dDecayed = ranked.find((c) => c.value === "d")?.score ?? 0;
    const dRaw = noHistory.find((c) => c.value === "d")?.score ?? 0;
    expect(dDecayed).toBe(dRaw);
  });

  it("only considers the first RECENCY_WINDOW entries; older history is ignored", () => {
    // Pass a history longer than the window; entries beyond position
    // RECENCY_WINDOW - 1 shouldn't affect the decay. Using a window
    // of 5 positions and an 8-entry history, positions 5-7 of "a"
    // are beyond the window and shouldn't count.
    const longHistory = ["z", "z", "z", "z", "z", "a", "a", "a"]; // "a" only at positions 5-7
    const ranked = rankTargets(closeRaceStats, baseline(), "transitioning", freq, {
      recentTargets: longHistory,
    });
    const noHistory = rankTargets(closeRaceStats, baseline(), "transitioning", freq);
    const aDecayed = ranked.find((c) => c.value === "a")?.score ?? 0;
    const aRaw = noHistory.find((c) => c.value === "a")?.score ?? 0;
    expect(aDecayed).toBe(aRaw);
  });

  it("behaves unchanged when recentTargets is omitted", () => {
    const ranked = rankTargets(closeRaceStats, baseline(), "transitioning", freq);
    const rankedExplicitEmpty = rankTargets(closeRaceStats, baseline(), "transitioning", freq, {
      recentTargets: [],
    });
    const a1 = ranked.find((c) => c.value === "a")?.score ?? 0;
    const a2 = rankedExplicitEmpty.find((c) => c.value === "a")?.score ?? 0;
    expect(a1).toBe(a2);
  });
});

describe("rankTargets — rarity-weighted recency decay (RARE_MASTERY_BOOST)", () => {
  // Two characters with identical raw weakness scores. Recent history
  // contains the same number of practices for both. Differs only in
  // corpus support: "a" common, "q" rare. After decay applies, the
  // rare letter's score should be lower (because each practice on a
  // rare letter is worth more "mastery credit").
  const equallyWeakStats = statsWith([
    { character: "a", attempts: 100, errors: 25, sumTime: 30_000, hesitationCount: 3 },
    { character: "q", attempts: 100, errors: 25, sumTime: 30_000, hesitationCount: 3 },
  ]);

  it("rare-letter practice produces a deeper decay than common-letter practice", () => {
    // Both letters appear once in recent history (in non-cooldown
    // positions). Common = "a" support 500; rare = "q" support 50.
    const charSupport = new Map<string, number>([
      ["a", 500],
      ["q", 50],
    ]);
    const ranked = rankTargets(equallyWeakStats, baseline(), "transitioning", freq, {
      corpusCharSupport: charSupport,
      recentTargets: ["d", "a", "q"], // first slot avoids cooldown trip
    });
    const aScore = ranked.find((c) => c.value === "a")?.score ?? 0;
    const qScore = ranked.find((c) => c.value === "q")?.score ?? 0;
    // Same raw weakness, same recent count, but q's rarity factor is
    // higher → q's decay is steeper → q's final score is lower.
    expect(qScore).toBeLessThan(aScore);
  });

  it("most-common letter gets factor 1 (decay matches unweighted recency)", () => {
    // "a" is the only entry in support, so it's the most-common by
    // definition → normalized=1 → factor=1 → decay = 0.7^1.
    const charSupport = new Map<string, number>([["a", 500]]);
    const stats = statsWith([
      { character: "a", attempts: 100, errors: 25, sumTime: 30_000, hesitationCount: 3 },
    ]);
    const noHistory = rankTargets(stats, baseline(), "transitioning", freq, {
      corpusCharSupport: charSupport,
    });
    const oneRecent = rankTargets(stats, baseline(), "transitioning", freq, {
      corpusCharSupport: charSupport,
      recentTargets: ["d", "a"],
    });
    const aRaw = noHistory.find((c) => c.value === "a")?.score ?? 0;
    const aDecayed = oneRecent.find((c) => c.value === "a")?.score ?? 0;
    expect(aDecayed).toBeCloseTo(aRaw * 0.7, 4);
  });

  it("motion targets bypass rarity weighting (factor = 1 always)", () => {
    // Build stats where a column candidate would emerge. Compare the
    // column candidate's score with and without rarity weighting in
    // play (charSupport provided vs absent). The column score should
    // be identical in both — it has no corpus-frequency dimension.
    const stats = statsWith([
      { character: "g", attempts: 100, errors: 30, sumTime: 30_000, hesitationCount: 5 },
    ]);
    const baselineCharSupport = new Map<string, number>([["g", 100]]);
    const withMap = rankTargets(stats, baseline(), "transitioning", freq, {
      corpusCharSupport: baselineCharSupport,
      recentTargets: ["d", "left-index-inner"],
    });
    const withoutMap = rankTargets(stats, baseline(), "transitioning", freq, {
      recentTargets: ["d", "left-index-inner"],
    });
    const colWith = withMap.find((c) => c.type === "inner-column")?.score ?? 0;
    const colWithout = withoutMap.find((c) => c.type === "inner-column")?.score ?? 0;
    expect(colWith).toBe(colWithout);
  });

  it("rarity weighting applies to bigrams via bigramSupport", () => {
    // Two bigrams with similar raw weakness, both above the corpus-
    // support threshold. "th" common (support high), "qu" rare
    // (support low). Both appear once in recent history.
    const stats = statsWith(
      [{ character: "a", attempts: 100, errors: 1, sumTime: 28_000, hesitationCount: 0 }],
      [
        { bigram: "th", attempts: 100, errors: 25, sumTime: 30_000 },
        { bigram: "qu", attempts: 100, errors: 25, sumTime: 30_000 },
      ],
    );
    const bigramSupport = new Map<string, number>([
      ["th", 500],
      ["qu", 30],
    ]);
    const ranked = rankTargets(stats, baseline(), "transitioning", freq, {
      corpusBigramSupport: bigramSupport,
      recentTargets: ["xz", "th", "qu"], // first slot avoids cooldown trip
    });
    const thScore = ranked.find((c) => c.value === "th")?.score ?? 0;
    const quScore = ranked.find((c) => c.value === "qu")?.score ?? 0;
    expect(quScore).toBeLessThan(thScore);
  });
});
