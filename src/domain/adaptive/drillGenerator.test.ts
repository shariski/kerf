import { describe, expect, it } from "vitest";
import type { Corpus, CorpusWord } from "../corpus/types";
import {
  INNER_COLUMN_CHARS,
  VOWELS,
  generateCrossHandBigramDrill,
  generateDrill,
  generateInnerColumnDrill,
  generateThumbClusterDrill,
} from "./drillGenerator";
import { mulberry32 } from "./rng";

// --- test fixtures ---------------------------------------------------------

const word = (w: string, over: Partial<CorpusWord> = {}): CorpusWord => {
  const chars = [...new Set(w.split(""))].sort();
  const bigrams = Array.from({ length: w.length - 1 }, (_, i) =>
    w.slice(i, i + 2),
  );
  // Naive hand assignment for fixture words: left = {a-m}, right = {n-z}.
  // Fixtures override when we need specific hand balance.
  let left = 0;
  let right = 0;
  for (const ch of w) {
    if (ch < "n") left++;
    else right++;
  }
  const inner = [...w].filter((c) => "bghnty".includes(c)).length;
  return {
    word: w,
    length: w.length,
    chars,
    bigrams,
    freqRank: over.freqRank ?? 0,
    leftKeystrokes: over.leftKeystrokes ?? left,
    rightKeystrokes: over.rightKeystrokes ?? right,
    innerColumnCount: over.innerColumnCount ?? inner,
  };
};

const corpusOf = (...words: CorpusWord[]): Corpus => ({
  version: 1,
  scope: "alpha-only",
  source: "test-fixture",
  words,
});

describe("generateDrill — single character target", () => {
  it("includes every cVc synthetic form (target + vowel + target)", () => {
    const out = generateDrill({
      corpus: corpusOf(word("bob"), word("bay"), word("bench")),
      target: "b",
      targetLength: 40,
      rng: mulberry32(1),
    });
    for (const v of VOWELS) {
      expect(out).toContain(`b${v}b`);
    }
  });

  it("includes every ccV and Vcc synthetic form", () => {
    const out = generateDrill({
      corpus: corpusOf(word("bob")),
      target: "b",
      targetLength: 40,
      rng: mulberry32(1),
    });
    for (const v of VOWELS) {
      expect(out).toContain(`bb${v}`);
      expect(out).toContain(`${v}bb`);
    }
  });

  it("appends real words from the corpus that contain the target", () => {
    const out = generateDrill({
      corpus: corpusOf(word("bay"), word("big"), word("boy"), word("cat")),
      target: "b",
      targetLength: 120,
      rng: mulberry32(1),
    });
    const tokens = out.split(" ");
    const realWords = tokens.filter((t: string) =>
      ["bay", "big", "boy", "cat"].includes(t),
    );
    expect(realWords.length).toBeGreaterThan(0);
    // 'cat' has no 'b' and must not appear.
    expect(out).not.toContain(" cat");
    expect(out.startsWith("cat ")).toBe(false);
  });

  it("is deterministic given the same seed", () => {
    const c = corpusOf(word("bay"), word("big"), word("boy"), word("bench"));
    const a = generateDrill({
      corpus: c,
      target: "b",
      targetLength: 120,
      rng: mulberry32(7),
    });
    const b = generateDrill({
      corpus: c,
      target: "b",
      targetLength: 120,
      rng: mulberry32(7),
    });
    expect(a).toBe(b);
  });

  it("approximates targetLength (within 15%)", () => {
    const out = generateDrill({
      corpus: corpusOf(word("bay"), word("big"), word("boy"), word("bench")),
      target: "b",
      targetLength: 200,
      rng: mulberry32(1),
    });
    expect(out.length).toBeGreaterThan(200 * 0.85);
    expect(out.length).toBeLessThan(200 * 1.15 + 50);
  });

  it("returns just the synthetic portion when corpus has no matching words", () => {
    const out = generateDrill({
      corpus: corpusOf(word("cat"), word("dog")),
      target: "b",
      targetLength: 200,
      rng: mulberry32(1),
    });
    // All 15 synthetic tokens present (5 cVc + 5 ccV + 5 Vcc).
    for (const v of VOWELS) {
      expect(out).toContain(`b${v}b`);
      expect(out).toContain(`bb${v}`);
      expect(out).toContain(`${v}bb`);
    }
    // No real words were available.
    const tokens = out.split(" ").filter((t: string) => t.length > 0);
    expect(tokens).toHaveLength(15);
  });
});

describe("generateDrill — bigram target", () => {
  it("includes xyV and Vxy synthetic forms for each vowel", () => {
    const out = generateDrill({
      corpus: corpusOf(word("the"), word("that")),
      target: "th",
      targetLength: 80,
      rng: mulberry32(1),
    });
    for (const v of VOWELS) {
      expect(out).toContain(`th${v}`);
      expect(out).toContain(`${v}th`);
    }
  });

  it("includes a doubled-bigram form", () => {
    const out = generateDrill({
      corpus: corpusOf(word("the")),
      target: "th",
      targetLength: 80,
      rng: mulberry32(1),
    });
    expect(out).toContain("thth");
  });

  it("filters real words to those containing the bigram", () => {
    const out = generateDrill({
      corpus: corpusOf(word("the"), word("that"), word("cat"), word("dog")),
      target: "th",
      targetLength: 200,
      rng: mulberry32(1),
    });
    expect(out).not.toContain(" cat");
    expect(out).not.toContain(" dog");
  });
});

describe("generateInnerColumnDrill", () => {
  it("exports the 6 inner-column characters", () => {
    expect([...INNER_COLUMN_CHARS].sort()).toEqual(
      ["b", "g", "h", "n", "t", "y"].sort(),
    );
  });

  it("includes synthetic content for every inner-column character", () => {
    // A corpus with no matching real words still produces the full
    // synthetic slice for each of the 6 chars, so this test doesn't
    // need a rich fixture.
    const out = generateInnerColumnDrill({
      corpus: corpusOf(word("xxxxx")),
      targetLength: 600,
      rng: mulberry32(1),
    });
    for (const c of INNER_COLUMN_CHARS) {
      // cVc form is unique per target, so presence of e.g. "bab" proves
      // the 'b' slice was generated.
      expect(out).toContain(`${c}a${c}`);
    }
  });

  it("is deterministic given the same seed", () => {
    const c = corpusOf(word("the"), word("big"), word("boy"), word("note"));
    const a = generateInnerColumnDrill({
      corpus: c,
      targetLength: 400,
      rng: mulberry32(3),
    });
    const b = generateInnerColumnDrill({
      corpus: c,
      targetLength: 400,
      rng: mulberry32(3),
    });
    expect(a).toBe(b);
  });
});

describe("generateCrossHandBigramDrill", () => {
  // Corpus tuned so 'th' (left+right on QWERTY) and 'he' (right+left)
  // appear often; 'in' (both right) does not — so it must NOT be picked
  // as a target. Verifies the preset computes from the finger table.
  const crossHandCorpus = corpusOf(
    word("the"),
    word("that"),
    word("then"),
    word("there"),
    word("these"),
    word("those"),
    word("though"),
    word("through"),
    word("in"),
    word("into"),
    word("inside"),
  );

  it("picks bigrams that actually span hands (never same-hand)", () => {
    const out = generateCrossHandBigramDrill({
      corpus: crossHandCorpus,
      targetLength: 200,
      rng: mulberry32(1),
    });
    // "th" should appear often in the drill; "in" must not dominate
    // because both 'i' and 'n' are on the right hand on QWERTY.
    const thOccurrences = (out.match(/th/g) ?? []).length;
    const inOccurrences = (out.match(/in/g) ?? []).length;
    expect(thOccurrences).toBeGreaterThan(inOccurrences);
  });

  it("returns the empty string when no cross-hand bigrams exist", () => {
    // 'op' is same-hand (both right). Only same-hand bigrams here.
    const out = generateCrossHandBigramDrill({
      corpus: corpusOf(word("pop"), word("poo")),
      targetLength: 100,
      rng: mulberry32(1),
    });
    expect(out).toBe("");
  });

  it("is deterministic given the same seed and layout", () => {
    const a = generateCrossHandBigramDrill({
      corpus: crossHandCorpus,
      targetLength: 200,
      rng: mulberry32(9),
    });
    const b = generateCrossHandBigramDrill({
      corpus: crossHandCorpus,
      targetLength: 200,
      rng: mulberry32(9),
    });
    expect(a).toBe(b);
  });
});

describe("generateThumbClusterDrill", () => {
  it("returns only words at or below maxWordLength (default 4)", () => {
    const out = generateThumbClusterDrill({
      corpus: corpusOf(
        word("a"),
        word("to"),
        word("the"),
        word("word"),
        word("thing"),
        word("elephant"),
      ),
      targetLength: 200,
      rng: mulberry32(1),
    });
    const tokens = out.split(" ").filter((t: string) => t.length > 0);
    for (const t of tokens) {
      expect(t.length).toBeLessThanOrEqual(4);
    }
  });

  it("respects a custom maxWordLength", () => {
    const out = generateThumbClusterDrill({
      corpus: corpusOf(word("a"), word("to"), word("the"), word("word")),
      targetLength: 100,
      maxWordLength: 2,
      rng: mulberry32(1),
    });
    const tokens = out.split(" ").filter((t: string) => t.length > 0);
    for (const t of tokens) {
      expect(t.length).toBeLessThanOrEqual(2);
    }
  });

  it("returns the empty string when corpus has no short words", () => {
    const out = generateThumbClusterDrill({
      corpus: corpusOf(word("elephant"), word("configuration")),
      targetLength: 100,
      rng: mulberry32(1),
    });
    expect(out).toBe("");
  });
});
