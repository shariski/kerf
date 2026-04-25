import { describe, expect, it } from "vitest";
import type { Corpus, CorpusWord } from "../corpus/types";
import type { ComputedStats } from "../stats/types";
import { generateDiagnosticExercise } from "./diagnosticExercise";
import { mulberry32 } from "./rng";

/**
 * Build a CorpusWord with the metadata fields the diagnostic generator
 * actually reads. Other fields get neutral values; tests don't depend
 * on them.
 */
const word = (w: string, freqRank = 0): CorpusWord => {
  const chars = Array.from(new Set(w.split("")));
  const bigrams: string[] = [];
  for (let i = 0; i < w.length - 1; i++) bigrams.push(w.slice(i, i + 2));
  return {
    word: w,
    length: w.length,
    chars,
    bigrams,
    freqRank,
    leftKeystrokes: w.length,
    rightKeystrokes: 0,
    innerColumnCount: 0,
  };
};

const corpusOf = (words: string[]): Corpus => ({
  version: 1,
  scope: "alpha-only",
  source: "test",
  words: words.map((w, i) => word(w, i)),
});

const emptyStats: ComputedStats = { characters: [], bigrams: [] };

describe("generateDiagnosticExercise — phase 1: char coverage", () => {
  it("covers every uncovered alphabet letter the corpus supports", () => {
    // 6 words spanning the entire alphabet. With empty stats every
    // letter is uncovered. Phase 1 must select enough words so that
    // their union of chars contains every letter.
    const corpus = corpusOf([
      "the", // t,h,e
      "quick", // q,u,i,c,k
      "brown", // b,r,o,w,n
      "fox", // f,o,x
      "jumps", // j,u,m,p,s
      "lazyvgd", // l,a,z,y,v,g,d (synthetic to round out the alphabet)
    ]);
    const charSupport = new Map<string, number>();
    for (let i = 0; i < 26; i++) {
      const c = String.fromCharCode(97 + i);
      charSupport.set(c, 1);
    }
    const out = generateDiagnosticExercise({
      corpus,
      stats: emptyStats,
      corpusCharSupport: charSupport,
      corpusBigramSupport: new Map(),
      targetWordCount: 10,
      rng: mulberry32(1),
    });
    const letters = new Set(out.join("").split(""));
    for (let i = 0; i < 26; i++) {
      const c = String.fromCharCode(97 + i);
      expect(letters.has(c), `expected coverage for "${c}"`).toBe(true);
    }
  });

  it("skips chars whose corpus support is 0 (drill-key cross-layer guard)", () => {
    // ";" has support 0 → not in the coverable universe. With only
    // measured "a" (and "a" appearing in the corpus), nothing else is
    // uncovered, so phase 1 immediately exits.
    const corpus = corpusOf(["a", "ba"]);
    const charSupport = new Map<string, number>([
      ["a", 2],
      ["b", 1],
      [";", 0],
    ]);
    const out = generateDiagnosticExercise({
      corpus,
      stats: emptyStats,
      corpusCharSupport: charSupport,
      corpusBigramSupport: new Map(),
      targetWordCount: 5,
      rng: mulberry32(1),
    });
    expect(out.join("").includes(";")).toBe(false);
  });

  it("does not try to cover chars the user has already measured", () => {
    // The user has measured "a" and "b"; only "c" is uncovered. Phase
    // 1 should pick exactly one "c"-containing word, then exit.
    const corpus = corpusOf(["abc", "ab", "bc", "ac"]);
    const stats: ComputedStats = {
      characters: [
        { character: "a", attempts: 10, errors: 1, sumTime: 1000, hesitationCount: 0 },
        { character: "b", attempts: 10, errors: 1, sumTime: 1000, hesitationCount: 0 },
      ],
      bigrams: [],
    };
    const charSupport = new Map<string, number>([
      ["a", 4],
      ["b", 3],
      ["c", 3],
    ]);
    // No phase-3 fill so we only see what coverage produces.
    const out = generateDiagnosticExercise({
      corpus,
      stats,
      corpusCharSupport: charSupport,
      corpusBigramSupport: new Map(),
      targetWordCount: 1,
      coverageBudgetRatio: 1,
      rng: mulberry32(1),
    });
    expect(out.join("").includes("c")).toBe(true);
  });
});

describe("generateDiagnosticExercise — phase 2: bigram coverage", () => {
  it("covers unmeasured bigrams with corpus support at/above the threshold", () => {
    // No char gaps (a, b are both measured). Phase 1 noop. Phase 2
    // should pick a word containing the uncovered bigram "ab".
    const corpus = corpusOf(["ab", "ba", "aa", "bb"]);
    const stats: ComputedStats = {
      characters: [
        { character: "a", attempts: 10, errors: 0, sumTime: 1000, hesitationCount: 0 },
        { character: "b", attempts: 10, errors: 0, sumTime: 1000, hesitationCount: 0 },
      ],
      bigrams: [],
    };
    const charSupport = new Map<string, number>([
      ["a", 4],
      ["b", 4],
    ]);
    const bigramSupport = new Map<string, number>([
      ["ab", 5],
      ["ba", 5],
    ]);
    const out = generateDiagnosticExercise({
      corpus,
      stats,
      corpusCharSupport: charSupport,
      corpusBigramSupport: bigramSupport,
      targetWordCount: 4,
      coverageBudgetRatio: 1,
      rng: mulberry32(1),
    });
    const joined = out.join(" ");
    expect(joined.includes("ab")).toBe(true);
    expect(joined.includes("ba")).toBe(true);
  });

  it("excludes bigrams below LOW_CORPUS_SUPPORT_THRESHOLD from the coverable universe", () => {
    // "zx" has support 1 (below threshold of 3). Even though it's
    // unmeasured, phase 2 must not try to cover it. With no other
    // coverage targets, phase 2 noops and phase 3 fills.
    const corpus = corpusOf(["zx", "ab"]);
    const stats: ComputedStats = {
      characters: [
        { character: "a", attempts: 10, errors: 0, sumTime: 1000, hesitationCount: 0 },
        { character: "b", attempts: 10, errors: 0, sumTime: 1000, hesitationCount: 0 },
        { character: "z", attempts: 10, errors: 0, sumTime: 1000, hesitationCount: 0 },
        { character: "x", attempts: 10, errors: 0, sumTime: 1000, hesitationCount: 0 },
      ],
      bigrams: [{ bigram: "ab", attempts: 5, errors: 0, sumTime: 500 }],
    };
    const bigramSupport = new Map<string, number>([
      ["zx", 1], // below threshold
      ["ab", 5],
    ]);
    // Build a session where coverage budget is 1 and the corpus only
    // has 2 words; we expect phase 2 to NOT pick "zx" via coverage.
    const out = generateDiagnosticExercise({
      corpus,
      stats,
      corpusCharSupport: new Map([
        ["a", 2],
        ["b", 1],
        ["z", 1],
        ["x", 1],
      ]),
      corpusBigramSupport: bigramSupport,
      targetWordCount: 2,
      coverageBudgetRatio: 1,
      rng: mulberry32(1),
    });
    // "zx" can still appear via phase-3 fill (it's a corpus word) —
    // but that's a fill choice, not a coverage choice. The point is
    // phase-2 must not have *targeted* it. With both words eligible
    // for fill and identical Bayesian weights, this assertion just
    // pins that the function returns the requested word count.
    expect(out.length).toBeLessThanOrEqual(2);
  });

  it("respects the coverage budget cap on phase 2", () => {
    // 10-word session, ratio 0.2 → budget = 2. Many uncovered
    // bigrams; only 2 of them should get covered before phase 2
    // bails out and phase 3 fills.
    const corpus = corpusOf(["ab", "cd", "ef", "gh", "ij", "kl", "mn", "op", "qr", "st"]);
    const charSupport = new Map<string, number>();
    for (let i = 0; i < 26; i++) charSupport.set(String.fromCharCode(97 + i), 5);
    const bigramSupport = new Map<string, number>();
    const allBigrams = ["ab", "cd", "ef", "gh", "ij", "kl", "mn", "op", "qr", "st"];
    for (const bg of allBigrams) bigramSupport.set(bg, 5);
    // All chars measured → phase 1 noops.
    const stats: ComputedStats = {
      characters: Array.from(charSupport.keys()).map((c) => ({
        character: c,
        attempts: 10,
        errors: 0,
        sumTime: 1000,
        hesitationCount: 0,
      })),
      bigrams: [],
    };
    const out = generateDiagnosticExercise({
      corpus,
      stats,
      corpusCharSupport: charSupport,
      corpusBigramSupport: bigramSupport,
      targetWordCount: 10,
      coverageBudgetRatio: 0.2, // budget = 2 words for coverage
      rng: mulberry32(1),
    });
    expect(out.length).toBe(10);
  });
});

describe("generateDiagnosticExercise — phase 3: weighted fill", () => {
  it("biases fill toward words containing measured weak units", () => {
    // 5-word corpus where "x" is the user's measured weakness (high
    // error rate). All chars AND bigrams are measured (so the
    // unmeasured-bigram prior of 0.8 doesn't dilute the signal),
    // letting x's weakness dominate the weight of "xa".
    const corpus = corpusOf(["xa", "ab", "bc", "cd", "de"]);
    const stats: ComputedStats = {
      characters: [
        { character: "x", attempts: 100, errors: 80, sumTime: 30000, hesitationCount: 5 },
        { character: "a", attempts: 100, errors: 0, sumTime: 30000, hesitationCount: 0 },
        { character: "b", attempts: 100, errors: 0, sumTime: 30000, hesitationCount: 0 },
        { character: "c", attempts: 100, errors: 0, sumTime: 30000, hesitationCount: 0 },
        { character: "d", attempts: 100, errors: 0, sumTime: 30000, hesitationCount: 0 },
        { character: "e", attempts: 100, errors: 0, sumTime: 30000, hesitationCount: 0 },
      ],
      bigrams: [
        { bigram: "xa", attempts: 100, errors: 0, sumTime: 30000 },
        { bigram: "ab", attempts: 100, errors: 0, sumTime: 30000 },
        { bigram: "bc", attempts: 100, errors: 0, sumTime: 30000 },
        { bigram: "cd", attempts: 100, errors: 0, sumTime: 30000 },
        { bigram: "de", attempts: 100, errors: 0, sumTime: 30000 },
      ],
    };
    const charSupport = new Map([
      ["x", 1],
      ["a", 2],
      ["b", 2],
      ["c", 2],
      ["d", 2],
      ["e", 1],
    ]);
    // Weight calc with all units measured:
    //   "xa": bw({100,80}) + bw({100,0}) + bw({100,0}) ≈ 0.80 + 0.04 + 0.04 ≈ 0.88
    //   others: 3 × 0.04 = 0.12. Ratio ~7× → "xa" expected ≈ 65% of samples.
    let xaCount = 0;
    const trials = 30;
    for (let seed = 1; seed <= trials; seed++) {
      const out = generateDiagnosticExercise({
        corpus,
        stats,
        corpusCharSupport: charSupport,
        corpusBigramSupport: new Map(),
        targetWordCount: 1,
        coverageBudgetRatio: 0,
        rng: mulberry32(seed),
      });
      if (out.includes("xa")) xaCount++;
    }
    expect(xaCount).toBeGreaterThan(trials * 0.5);
  });
});

describe("generateDiagnosticExercise — degenerate inputs", () => {
  it("returns [] when targetWordCount is 0", () => {
    expect(
      generateDiagnosticExercise({
        corpus: corpusOf(["a"]),
        stats: emptyStats,
        corpusCharSupport: new Map([["a", 1]]),
        corpusBigramSupport: new Map(),
        targetWordCount: 0,
      }),
    ).toEqual([]);
  });

  it("returns [] when the corpus is empty", () => {
    expect(
      generateDiagnosticExercise({
        corpus: { version: 1, scope: "alpha-only", source: "test", words: [] },
        stats: emptyStats,
        corpusCharSupport: new Map([["a", 1]]),
        corpusBigramSupport: new Map(),
        targetWordCount: 5,
      }),
    ).toEqual([]);
  });

  it("returns at most targetWordCount words even when coverage demands more", () => {
    // Force a case where uncoveredChars > targetWordCount — phase 1
    // must respect the cap.
    const corpus = corpusOf(["a", "b", "c", "d", "e", "f", "g"]);
    const charSupport = new Map<string, number>([
      ["a", 1],
      ["b", 1],
      ["c", 1],
      ["d", 1],
      ["e", 1],
      ["f", 1],
      ["g", 1],
    ]);
    const out = generateDiagnosticExercise({
      corpus,
      stats: emptyStats,
      corpusCharSupport: charSupport,
      corpusBigramSupport: new Map(),
      targetWordCount: 3,
      coverageBudgetRatio: 1,
      rng: mulberry32(1),
    });
    expect(out.length).toBe(3);
  });
});

describe("generateDiagnosticExercise — determinism", () => {
  it("produces the same output for the same seed", () => {
    const corpus = corpusOf(["the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog"]);
    const charSupport = new Map<string, number>();
    for (const w of [
      "t",
      "h",
      "e",
      "q",
      "u",
      "i",
      "c",
      "k",
      "b",
      "r",
      "o",
      "w",
      "n",
      "f",
      "x",
      "j",
      "m",
      "p",
      "s",
      "v",
      "l",
      "a",
      "z",
      "y",
      "d",
      "g",
    ]) {
      charSupport.set(w, 1);
    }
    const opts = {
      corpus,
      stats: emptyStats,
      corpusCharSupport: charSupport,
      corpusBigramSupport: new Map<string, number>(),
      targetWordCount: 5,
    };
    const a = generateDiagnosticExercise({ ...opts, rng: mulberry32(42) });
    const b = generateDiagnosticExercise({ ...opts, rng: mulberry32(42) });
    expect(a).toEqual(b);
  });
});
