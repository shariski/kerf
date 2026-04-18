import { describe, it, expect } from "vitest";
import { computeChars, computeBigrams } from "./seed";

describe("computeChars", () => {
  it("returns unique characters in first-seen order", () => {
    expect(computeChars("hello")).toEqual(["h", "e", "l", "o"]);
  });

  it("handles single-character word", () => {
    expect(computeChars("a")).toEqual(["a"]);
  });

  it("handles all identical characters", () => {
    expect(computeChars("aaa")).toEqual(["a"]);
  });

  it("handles two distinct characters", () => {
    expect(computeChars("ab")).toEqual(["a", "b"]);
  });
});

describe("computeBigrams", () => {
  it("returns adjacent pairs for a 3-letter word", () => {
    expect(computeBigrams("cat")).toEqual(["ca", "at"]);
  });

  it("deduplicates repeated bigrams", () => {
    // 'aba' → ['ab', 'ba'] — no duplicate
    expect(computeBigrams("aba")).toEqual(["ab", "ba"]);
    // 'abab' → ['ab', 'ba'] — 'ab' appears twice, deduped
    expect(computeBigrams("abab")).toEqual(["ab", "ba"]);
  });

  it("returns empty array for single-character word", () => {
    expect(computeBigrams("a")).toEqual([]);
  });

  it("returns one bigram for two-character word", () => {
    expect(computeBigrams("ab")).toEqual(["ab"]);
  });

  it("handles a realistic word", () => {
    // 'bench' → ['be', 'en', 'nc', 'ch']
    expect(computeBigrams("bench")).toEqual(["be", "en", "nc", "ch"]);
  });
});
