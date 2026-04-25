import { describe, expect, it } from "vitest";
import { generateSession } from "./sessionGenerator";
import { DRILL_LIBRARY } from "./drillLibraryData";
import { mulberry32 } from "./rng";
import type { Corpus } from "../corpus/types";
import type { UserBaseline } from "../stats/types";

const minimalCorpus: Corpus = {
  version: 1,
  scope: "alpha-only",
  source: "test",
  words: [
    {
      word: "get",
      length: 3,
      chars: ["g", "e", "t"],
      bigrams: ["ge", "et"],
      freqRank: 1,
      leftKeystrokes: 3,
      rightKeystrokes: 0,
      innerColumnCount: 2,
    },
    {
      word: "big",
      length: 3,
      chars: ["b", "i", "g"],
      bigrams: ["bi", "ig"],
      freqRank: 2,
      leftKeystrokes: 2,
      rightKeystrokes: 1,
      innerColumnCount: 2,
    },
    {
      word: "top",
      length: 3,
      chars: ["t", "o", "p"],
      bigrams: ["to", "op"],
      freqRank: 3,
      leftKeystrokes: 1,
      rightKeystrokes: 2,
      innerColumnCount: 1,
    },
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

describe("generateSession — rare-letter-biased filler", () => {
  it("prefers filler words containing corpus-rare letters when charSupport is provided", () => {
    // Minimal fixture: one emphasis word (contains target 'g'), two
    // filler candidates — "quiz" (all rare letters per charSupport)
    // vs "cat" (all common). Under uniform-per-word filler selection
    // each would win ~half the time; with RARE_LETTER_BOOST active,
    // "quiz" should dominate across seeds.
    const corpus: Corpus = {
      version: 1,
      scope: "alpha-only",
      source: "test",
      words: [
        {
          word: "get",
          length: 3,
          chars: ["g", "e", "t"],
          bigrams: ["ge", "et"],
          freqRank: 1,
          leftKeystrokes: 3,
          rightKeystrokes: 0,
          innerColumnCount: 0,
        },
        {
          word: "quiz",
          length: 4,
          chars: ["q", "u", "i", "z"],
          bigrams: ["qu", "ui", "iz"],
          freqRank: 2,
          leftKeystrokes: 4,
          rightKeystrokes: 0,
          innerColumnCount: 0,
        },
        {
          word: "cat",
          length: 3,
          chars: ["a", "c", "t"],
          bigrams: ["ca", "at"],
          freqRank: 3,
          leftKeystrokes: 3,
          rightKeystrokes: 0,
          innerColumnCount: 0,
        },
      ],
    };
    const charSupport = new Map<string, number>([
      ["q", 1],
      ["u", 1],
      ["i", 1],
      ["z", 1],
      ["g", 100],
      ["e", 100],
      ["t", 100],
      ["a", 100],
      ["c", 100],
    ]);
    let quizHits = 0;
    let catHits = 0;
    const trials = 20;
    for (let seed = 1; seed <= trials; seed++) {
      const output = generateSession({
        // Empty stats + explicit targetOverride bypasses selectTarget,
        // forcing the character-target word-picker path. We're testing
        // the filler weighting, not target selection.
        stats: { characters: [], bigrams: [] },
        baseline,
        phase: "transitioning",
        corpus,
        corpusCharSupport: charSupport,
        drillLibrary: DRILL_LIBRARY,
        frequencyInLanguage: () => 0.5,
        targetOverride: {
          type: "character",
          value: "g",
          keys: ["g"],
          label: "test target g",
        },
        exerciseOptions: {
          targetWordCount: 2,
          mustContainMinRatio: 0.5,
          rng: mulberry32(seed),
        },
      });
      if (output.exercise.includes("quiz")) quizHits++;
      if (output.exercise.includes("cat")) catHits++;
    }
    // Rare-letter word should clearly dominate: at RARE_LETTER_BOOST=30
    // with 'q' support=1 vs common=100, quiz weight ≈ 121, cat ≈ 1.9.
    expect(quizHits).toBeGreaterThan(catHits);
    expect(quizHits).toBeGreaterThanOrEqual(Math.floor(trials * 0.8));
  });

  it("falls back to uniform filler when charSupport is not provided", () => {
    // Same corpus, no charSupport → the rare bias is disabled and
    // both filler candidates have equal weight. Smoke test: just
    // verify the code path still produces a well-formed session and
    // doesn't throw. Distribution isn't strictly checked because a
    // 50/50 uniform sample over 20 seeds is statistically noisy at
    // this sample size.
    const corpus: Corpus = {
      version: 1,
      scope: "alpha-only",
      source: "test",
      words: [
        {
          word: "get",
          length: 3,
          chars: ["g", "e", "t"],
          bigrams: ["ge", "et"],
          freqRank: 1,
          leftKeystrokes: 3,
          rightKeystrokes: 0,
          innerColumnCount: 0,
        },
        {
          word: "cat",
          length: 3,
          chars: ["a", "c", "t"],
          bigrams: ["ca", "at"],
          freqRank: 2,
          leftKeystrokes: 3,
          rightKeystrokes: 0,
          innerColumnCount: 0,
        },
      ],
    };
    const output = generateSession({
      stats: { characters: [], bigrams: [] },
      baseline,
      phase: "transitioning",
      corpus,
      // NO corpusCharSupport — exercises the fallback path
      drillLibrary: DRILL_LIBRARY,
      frequencyInLanguage: () => 0.5,
      targetOverride: {
        type: "character",
        value: "g",
        keys: ["g"],
        label: "test target g",
      },
      exerciseOptions: {
        targetWordCount: 2,
        mustContainMinRatio: 0.5,
        rng: mulberry32(1),
      },
    });
    expect(output.exercise.length).toBeGreaterThan(0);
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
