import { describe, expect, it } from "vitest";
import type { Corpus, CorpusWord } from "#/domain/corpus/types";
import { buildBigramSupport } from "./useCorpus";

// Hand-built minimal CorpusWord — bypass test-builder helpers so this
// test is self-contained at the de-duplication boundary.
const wordWith = (w: string, bigrams: string[]): CorpusWord => ({
  word: w,
  length: w.length,
  chars: [...new Set(w.split(""))].sort(),
  bigrams,
  freqRank: 0,
  leftKeystrokes: 0,
  rightKeystrokes: 0,
  innerColumnCount: 0,
});

const corpusOf = (words: CorpusWord[]): Corpus => ({
  version: 1,
  scope: "alpha-only",
  source: "test",
  words,
});

describe("buildBigramSupport", () => {
  it("counts each word once per bigram, even when the bigram repeats within a word", () => {
    // "mama" naturally produces bigrams ["ma", "am", "ma"] — the "ma"
    // is duplicated. De-duplication ensures the count is 1 (one word
    // contains "ma"), not 2 (two occurrences of "ma" in the corpus).
    const support = buildBigramSupport(corpusOf([wordWith("mama", ["ma", "am", "ma"])]));
    expect(support.get("ma")).toBe(1);
    expect(support.get("am")).toBe(1);
  });

  it("accumulates counts across multiple words", () => {
    const support = buildBigramSupport(
      corpusOf([
        wordWith("cat", ["ca", "at"]),
        wordWith("car", ["ca", "ar"]),
        wordWith("bat", ["ba", "at"]),
      ]),
    );
    expect(support.get("ca")).toBe(2); // cat, car
    expect(support.get("at")).toBe(2); // cat, bat
    expect(support.get("ar")).toBe(1); // car
    expect(support.get("ba")).toBe(1); // bat
  });

  it("returns 0-support (via missing entry) for a bigram no word contains", () => {
    const support = buildBigramSupport(corpusOf([wordWith("ab", ["ab"])]));
    expect(support.get("xw")).toBeUndefined();
    // Downstream consumers use `?? 0` to coerce; verify that pattern works:
    expect(support.get("xw") ?? 0).toBe(0);
  });
});
