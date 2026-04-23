import { describe, expect, it } from "vitest";
import type { Corpus, CorpusWord } from "../corpus/types";
import { generateExercise } from "./exerciseGenerator";
import { mulberry32 } from "./rng";

const word = (over: Partial<CorpusWord> = {}): CorpusWord => {
  const w = over.word ?? "the";
  return {
    word: w,
    length: over.length ?? w.length,
    chars: over.chars ?? [...new Set(w.split(""))].sort(),
    bigrams: over.bigrams ?? Array.from({ length: w.length - 1 }, (_, i) => w.slice(i, i + 2)),
    freqRank: over.freqRank ?? 0,
    leftKeystrokes: over.leftKeystrokes ?? 0,
    rightKeystrokes: over.rightKeystrokes ?? w.length,
    innerColumnCount: over.innerColumnCount ?? 0,
  };
};

const corpus = (words: CorpusWord[]): Corpus => ({
  version: 1,
  scope: "alpha-only",
  source: "test-fixture",
  words,
});

const uniformScore = () => 1;

describe("generateExercise — basic output", () => {
  it("returns exactly targetWordCount words when corpus is large enough", () => {
    const words = Array.from({ length: 100 }, (_, i) =>
      word({ word: `w${String(i).padStart(3, "0")}` }),
    );
    const out = generateExercise({
      corpus: corpus(words),
      weaknessScoreFor: uniformScore,
      targetWordCount: 50,
      rng: mulberry32(1),
    });
    expect(out).toHaveLength(50);
  });

  it("returns only strings from the corpus", () => {
    const words = [word({ word: "alpha" }), word({ word: "beta" })];
    const out = generateExercise({
      corpus: corpus(words),
      weaknessScoreFor: uniformScore,
      targetWordCount: 2,
      rng: mulberry32(1),
    });
    const allowed = new Set(words.map((w) => w.word));
    for (const w of out) expect(allowed.has(w)).toBe(true);
  });

  it("returns no duplicates within a single exercise (without-replacement)", () => {
    const words = Array.from({ length: 60 }, (_, i) =>
      word({ word: `w${String(i).padStart(2, "0")}` }),
    );
    const out = generateExercise({
      corpus: corpus(words),
      weaknessScoreFor: uniformScore,
      targetWordCount: 50,
      rng: mulberry32(1),
    });
    expect(new Set(out).size).toBe(out.length);
  });

  it("is deterministic given the same seed", () => {
    const words = Array.from({ length: 100 }, (_, i) =>
      word({ word: `w${String(i).padStart(3, "0")}` }),
    );
    const a = generateExercise({
      corpus: corpus(words),
      weaknessScoreFor: uniformScore,
      targetWordCount: 20,
      rng: mulberry32(7),
    });
    const b = generateExercise({
      corpus: corpus(words),
      weaknessScoreFor: uniformScore,
      targetWordCount: 20,
      rng: mulberry32(7),
    });
    expect(a).toEqual(b);
  });
});

describe("generateExercise — filters", () => {
  it("handIsolation 'left' keeps only words with no right-hand keystrokes", () => {
    const leftOnly = word({
      word: "sad",
      leftKeystrokes: 3,
      rightKeystrokes: 0,
    });
    const rightOnly = word({
      word: "pop",
      leftKeystrokes: 0,
      rightKeystrokes: 3,
    });
    const mixed = word({
      word: "the",
      leftKeystrokes: 1,
      rightKeystrokes: 2,
    });
    const out = generateExercise({
      corpus: corpus([leftOnly, rightOnly, mixed]),
      weaknessScoreFor: uniformScore,
      filters: { handIsolation: "left" },
      targetWordCount: 10,
      rng: mulberry32(1),
    });
    expect(out).toEqual(["sad"]);
  });

  it("handIsolation 'right' keeps only words with no left-hand keystrokes", () => {
    const leftOnly = word({
      word: "sad",
      leftKeystrokes: 3,
      rightKeystrokes: 0,
    });
    const rightOnly = word({
      word: "pop",
      leftKeystrokes: 0,
      rightKeystrokes: 3,
    });
    const out = generateExercise({
      corpus: corpus([leftOnly, rightOnly]),
      weaknessScoreFor: uniformScore,
      filters: { handIsolation: "right" },
      targetWordCount: 10,
      rng: mulberry32(1),
    });
    expect(out).toEqual(["pop"]);
  });

  it("handIsolation 'either' (default) keeps all words", () => {
    const words = [
      word({ word: "sad", leftKeystrokes: 3, rightKeystrokes: 0 }),
      word({ word: "pop", leftKeystrokes: 0, rightKeystrokes: 3 }),
      word({ word: "the", leftKeystrokes: 1, rightKeystrokes: 2 }),
    ];
    const out = generateExercise({
      corpus: corpus(words),
      weaknessScoreFor: uniformScore,
      targetWordCount: 10,
      rng: mulberry32(1),
    });
    expect(new Set(out)).toEqual(new Set(["sad", "pop", "the"]));
  });

  it("maxLength drops words longer than the limit", () => {
    const short = word({ word: "hi" });
    const ok = word({ word: "four" });
    const long = word({ word: "elephant" });
    const out = generateExercise({
      corpus: corpus([short, ok, long]),
      weaknessScoreFor: uniformScore,
      filters: { maxLength: 4 },
      targetWordCount: 10,
      rng: mulberry32(1),
    });
    expect(new Set(out)).toEqual(new Set(["hi", "four"]));
  });

  it("maxInnerColumnCount drops words with more inner-column chars than allowed", () => {
    const easy = word({ word: "some", innerColumnCount: 0 });
    const medium = word({ word: "ben", innerColumnCount: 2 });
    const hard = word({ word: "bgthy", innerColumnCount: 5 });
    const out = generateExercise({
      corpus: corpus([easy, medium, hard]),
      weaknessScoreFor: uniformScore,
      filters: { maxInnerColumnCount: 2 },
      targetWordCount: 10,
      rng: mulberry32(1),
    });
    expect(new Set(out)).toEqual(new Set(["some", "ben"]));
  });
});

describe("generateExercise — weighted sampling", () => {
  it("drops zero-match-score words from candidates", () => {
    // scoreFor returns 0 for 'pop', positive for 'sad' — 'pop' should
    // never be drawn even though filters allow it.
    const sad = word({ word: "sad" });
    const pop = word({ word: "pop" });
    const score = (unit: string) => (sad.chars.includes(unit) ? 1 : 0);
    const out = generateExercise({
      corpus: corpus([sad, pop]),
      weaknessScoreFor: score,
      targetWordCount: 1,
      rng: mulberry32(1),
    });
    expect(out).toEqual(["sad"]);
  });

  it("returns empty array when all candidates have zero match score", () => {
    const words = [word({ word: "sad" }), word({ word: "pop" })];
    const out = generateExercise({
      corpus: corpus(words),
      weaknessScoreFor: () => 0,
      targetWordCount: 10,
      rng: mulberry32(1),
    });
    expect(out).toEqual([]);
  });

  it("returns fewer than targetWordCount when candidate pool is smaller", () => {
    const words = [word({ word: "sad" }), word({ word: "pop" })];
    const out = generateExercise({
      corpus: corpus(words),
      weaknessScoreFor: uniformScore,
      targetWordCount: 50,
      rng: mulberry32(1),
    });
    expect(out).toHaveLength(2);
  });

  it("heavily-weighted words appear more often than lightly-weighted ones over many runs", () => {
    // Three words with equal lengths so no structural bias; scoring
    // puts all weight on 'q' which appears only in 'qq___'.
    const heavy = word({
      word: "query",
      chars: ["e", "q", "r", "u", "y"],
      bigrams: ["qu", "ue", "er", "ry"],
    });
    const light = word({
      word: "apple",
      chars: ["a", "e", "l", "p"],
      bigrams: ["ap", "pp", "pl", "le"],
    });
    const score = (unit: string) => (unit.includes("q") ? 10 : 1);
    let heavyWins = 0;
    const runs = 200;
    for (let i = 0; i < runs; i++) {
      const out = generateExercise({
        corpus: corpus([heavy, light]),
        weaknessScoreFor: score,
        targetWordCount: 1,
        rng: mulberry32(i + 1),
      });
      if (out[0] === "query") heavyWins++;
    }
    // Expected proportion: query weight = 10+10+1+1+1+1+1+1+1 = 27,
    // apple weight = 1+1+1+1+1+1+1+1 = 8. So ~27/35 ≈ 77%.
    // Use a loose bound to keep this test stable across rng variants.
    expect(heavyWins / runs).toBeGreaterThan(0.6);
    expect(heavyWins / runs).toBeLessThan(0.9);
  });
});

describe("generateExercise — shuffle", () => {
  it("does not return words sorted by match_score", () => {
    // Assign decreasing scores by word index; a correct implementation
    // must shuffle the output so it isn't returned in score order.
    const words = Array.from({ length: 50 }, (_, i) =>
      word({ word: `w${String(i).padStart(2, "0")}` }),
    );
    const score = (unit: string) => {
      // Map 'a'..'z' to a decreasing weight so earlier-named words win.
      const m = unit.match(/\d\d/);
      if (!m) return 1;
      return 1;
    };
    const out = generateExercise({
      corpus: corpus(words),
      weaknessScoreFor: score,
      targetWordCount: 50,
      rng: mulberry32(12345),
    });
    // All 50 words got picked (same weight each → reservoir sampling
    // returns them all). The output order must not be the input order,
    // otherwise the shuffle is missing.
    const inputOrder = words.map((w) => w.word);
    expect(out).not.toEqual(inputOrder);
    // And must be a permutation of the input.
    expect(new Set(out)).toEqual(new Set(inputOrder));
  });
});

describe("generateExercise — mustContainUnit emphasis floor", () => {
  // Synthetic corpus where target-char words score LOWER than filler words
  // under the default weighted-sum, so the legacy algorithm alone cannot
  // guarantee a target-containing majority. This isolates the emphasis
  // floor as the mechanism under test.
  const buildMixedCorpus = () => {
    // 10 short words containing 'u': default score = 10 + 4*0.5 = 12
    const withU = ["up", "us", "un", "ub", "uc", "ud", "uf", "ug", "uh", "uk"].map((w) =>
      word({ word: w }),
    );
    // 30 long words without 'u': default score ≈ 15 (more 0.5s summed)
    const withoutU = Array.from({ length: 30 }, (_, i) => {
      // 15-char words over b..t, skipping 'u'. Pad with digits so every
      // word is unique. (All chars are treated as units; digits are fine
      // for the fixture because they land under the 0.5 floor.)
      const w = `bcdefghijklmnop${String(i).padStart(2, "0")}`;
      return word({ word: w });
    });
    return corpus([...withU, ...withoutU]);
  };

  const uScore = (unit: string) => (unit === "u" ? 10 : 0.5);

  it("guarantees at least mustContainMinRatio of words contain the target unit", () => {
    const out = generateExercise({
      corpus: buildMixedCorpus(),
      weaknessScoreFor: uScore,
      targetWordCount: 10,
      mustContainUnit: "u",
      mustContainMinRatio: 0.8,
      rng: mulberry32(42),
    });
    const uCount = out.filter((w) => w.includes("u")).length;
    expect(out).toHaveLength(10);
    expect(uCount).toBeGreaterThanOrEqual(Math.ceil(10 * 0.8));
  });

  it("falls back gracefully when the target pool is smaller than the ratio implies", () => {
    // Only 2 words contain 'z'; a ratio of 0.8 would ideally pick 8.
    const withZ = [word({ word: "zoo" }), word({ word: "buzz" })];
    const withoutZ = Array.from({ length: 20 }, (_, i) =>
      word({ word: `bcdefgh${String(i).padStart(2, "0")}` }),
    );
    const out = generateExercise({
      corpus: corpus([...withZ, ...withoutZ]),
      weaknessScoreFor: (unit) => (unit === "z" ? 10 : 0.5),
      targetWordCount: 10,
      mustContainUnit: "z",
      mustContainMinRatio: 0.8,
      rng: mulberry32(99),
    });
    expect(out).toHaveLength(10);
    const zCount = out.filter((w) => w.includes("z")).length;
    // All available z-words get included; the remainder come from the
    // non-z pool. No duplicates forced.
    expect(zCount).toBe(2);
    expect(new Set(out).size).toBe(10);
  });

  it("detects bigram targets via the bigrams field, not character membership", () => {
    // Target is 'th' (bigram). Words containing the bigram 'th' are in
    // the emphasis pool; words that merely contain 't' or 'h' separately
    // are not.
    const withTh = [
      word({ word: "the" }),
      word({ word: "that" }),
      word({ word: "with" }),
      word({ word: "both" }),
      word({ word: "thin" }),
    ];
    const withoutTh = [
      word({ word: "cat" }), // has 't' but no 'th' bigram
      word({ word: "has" }), // has 'h' but no 'th' bigram
      word({ word: "hit" }), // has both 'h' and 't' but bigram is 'hi','it'
      word({ word: "ton" }),
      word({ word: "hot" }),
      word({ word: "not" }),
      word({ word: "son" }),
      word({ word: "one" }),
      word({ word: "two" }),
      word({ word: "red" }),
    ];
    const out = generateExercise({
      corpus: corpus([...withTh, ...withoutTh]),
      weaknessScoreFor: (unit) => (unit === "th" ? 10 : 0.5),
      targetWordCount: 6,
      mustContainUnit: "th",
      mustContainMinRatio: 0.67,
      rng: mulberry32(7),
    });
    const thCount = out.filter((w) => w.includes("th")).length;
    // With 5 'th' words available and need = ceil(6 * 0.67) = 5, all 5
    // should be included. "hit" contains both 'h' and 't' but not as the
    // adjacent-pair 'th', so it must NOT count.
    expect(thCount).toBeGreaterThanOrEqual(5);
  });

  it("ignores the emphasis floor when mustContainMinRatio is 0 or undefined", () => {
    // Omitting the options should produce identical output to omitting
    // the feature entirely — guards backward compatibility.
    const words = Array.from({ length: 20 }, (_, i) =>
      word({ word: `w${String(i).padStart(2, "0")}` }),
    );
    const baseOpts = {
      corpus: corpus(words),
      weaknessScoreFor: uniformScore,
      targetWordCount: 10,
    };
    const legacy = generateExercise({ ...baseOpts, rng: mulberry32(3) });
    const explicitOff = generateExercise({
      ...baseOpts,
      mustContainUnit: "w",
      mustContainMinRatio: 0,
      rng: mulberry32(3),
    });
    expect(explicitOff).toEqual(legacy);
  });

  it("widens emphasis pool to component characters when bigram has zero corpus support", () => {
    // 8 words containing 'x' or 'w' individually (none have 'xw' adjacent),
    // 16 words containing neither. Target xw with zero corpus support
    // should pull words with x or w instead of falling all the way to
    // filler.
    const withComponent = ["ax", "bx", "cx", "wa", "wb", "wc", "xo", "ow"].map((w) =>
      word({ word: w }),
    );
    const neither = Array.from({ length: 16 }, (_, i) =>
      word({ word: `bc${String(i).padStart(2, "0")}` }),
    );
    const support = new Map<string, number>([["xw", 0]]);
    const out = generateExercise({
      corpus: corpus([...withComponent, ...neither]),
      weaknessScoreFor: (unit) => (unit === "xw" ? 10 : 0.5),
      targetWordCount: 10,
      mustContainUnit: "xw",
      mustContainMinRatio: 0.8,
      corpusBigramSupport: support,
      rng: mulberry32(42),
    });
    const componentHits = out.filter((w) => w.includes("x") || w.includes("w")).length;
    expect(out).toHaveLength(10);
    expect(componentHits).toBeGreaterThanOrEqual(Math.ceil(10 * 0.8));
  });

  it("does not widen when bigram has non-zero corpus support (literal match still required)", () => {
    // Same fixture as the widening test: 8 words with 'x' or 'w'
    // individually, 16 with neither. BUT this time we claim the 'xw'
    // bigram has non-zero support via the map — so widening must NOT
    // trigger. Since no fixture word contains 'xw' as an adjacent pair,
    // the literal-match emphasis pool is empty and the emphasis sample
    // falls to 0; the session should be drawn entirely from filler.
    const withComponent = ["ax", "bx", "cx", "wa", "wb", "wc", "xo", "ow"].map((w) =>
      word({ word: w }),
    );
    const neither = Array.from({ length: 16 }, (_, i) =>
      word({ word: `bc${String(i).padStart(2, "0")}` }),
    );
    const support = new Map<string, number>([["xw", 3]]);
    const out = generateExercise({
      corpus: corpus([...withComponent, ...neither]),
      weaknessScoreFor: (unit) => (unit === "xw" ? 10 : 0.5),
      targetWordCount: 10,
      mustContainUnit: "xw",
      mustContainMinRatio: 0.8,
      corpusBigramSupport: support,
      rng: mulberry32(42),
    });
    const componentHits = out.filter((w) => w.includes("x") || w.includes("w")).length;
    expect(out).toHaveLength(10);
    // With widening OFF, component words may still appear as filler (they are
    // valid non-xw words). The discriminating assertion is that they do NOT
    // saturate to the emphasis ratio — a stuck-true widenToComponentChars
    // would produce componentHits >= ceil(10 * 0.8) = 8.
    expect(componentHits).toBeLessThan(Math.ceil(10 * 0.8));
  });
});
