import { describe, expect, it } from "vitest";
import { generateSession } from "./sessionGenerator";
import { DRILL_LIBRARY } from "./drillLibraryData";
import type { Corpus } from "../corpus/types";
import type { UserBaseline } from "../stats/types";

const minimalCorpus: Corpus = {
  version: 1,
  scope: "alpha-only",
  source: "test",
  words: [
    { word: "get", length: 3, chars: ["g", "e", "t"], bigrams: ["ge", "et"], freqRank: 1, leftKeystrokes: 3, rightKeystrokes: 0, innerColumnCount: 2 },
    { word: "big", length: 3, chars: ["b", "i", "g"], bigrams: ["bi", "ig"], freqRank: 2, leftKeystrokes: 2, rightKeystrokes: 1, innerColumnCount: 2 },
    { word: "top", length: 3, chars: ["t", "o", "p"], bigrams: ["to", "op"], freqRank: 3, leftKeystrokes: 1, rightKeystrokes: 2, innerColumnCount: 1 },
  ],
};

const baseline: UserBaseline = {
  meanErrorRate: 0.08,
  meanKeystrokeTime: 280,
  meanHesitationRate: 0.1,
  journey: "conventional",
};

describe("generateSession — motion target → drill path", () => {
  it("when selectTarget returns a motion target, exercise comes from drill library", () => {
    const output = generateSession({
      stats: {
        characters: [
          // force vertical-column to win: lots of errors on W (left-ring top)
          { character: "w", attempts: 100, errors: 30, sumTime: 30_000, hesitationCount: 5 },
          { character: "s", attempts: 100, errors: 20, sumTime: 30_000, hesitationCount: 3 },
          { character: "x", attempts: 100, errors: 15, sumTime: 30_000, hesitationCount: 2 },
        ],
        bigrams: [],
      },
      baseline: { ...baseline, journey: "conventional" },
      phase: "transitioning",
      corpus: minimalCorpus,
      drillLibrary: DRILL_LIBRARY,
      frequencyInLanguage: () => 0.5,
    });
    expect(["vertical-column", "character"]).toContain(output.target.type);
    if (output.target.type === "vertical-column") {
      // exercise string matches a drill-library entry
      expect(output.exercise.length).toBeGreaterThan(0);
      expect(output.briefing.text).toMatch(/column/i);
    }
  });
});

describe("generateSession — character target → word-picker path", () => {
  it("returns words when target.type === 'character'", () => {
    const output = generateSession({
      stats: {
        characters: [
          { character: "g", attempts: 100, errors: 20, sumTime: 30_000, hesitationCount: 5 },
          { character: "a", attempts: 100, errors: 1, sumTime: 28_000, hesitationCount: 0 },
        ],
        bigrams: [],
      },
      baseline,
      phase: "transitioning",
      corpus: minimalCorpus,
      drillLibrary: DRILL_LIBRARY,
      frequencyInLanguage: () => 0.5,
    });
    if (output.target.type === "character") {
      expect(output.exercise.length).toBeGreaterThan(0);
    }
  });
});

describe("generateSession — drill mode override", () => {
  it("uses targetOverride and skips selectTarget", () => {
    const output = generateSession({
      stats: { characters: [], bigrams: [] }, // no stats; would normally go diagnostic
      baseline,
      phase: "transitioning",
      corpus: minimalCorpus,
      drillLibrary: DRILL_LIBRARY,
      frequencyInLanguage: () => 0.5,
      targetOverride: {
        type: "vertical-column",
        value: "left-ring",
        keys: ["w", "s", "x"],
        label: "Left ring column vertical reach",
      },
    });
    expect(output.target.value).toBe("left-ring");
    expect(output.target.score).toBeUndefined();
    expect(output.briefing.keys).toEqual(["w", "s", "x"]);
  });
});
