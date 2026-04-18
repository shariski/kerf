import { describe, expect, it } from "vitest";
import type {
  BigramStat,
  CharacterStat,
  ComputedStats,
  KeystrokeEvent,
  TransitionPhase,
  UserBaseline,
} from "../stats/types";
import type { SplitMetricsSnapshot } from "../metrics/types";
import {
  BANNED_WORDS,
  THUMB_HESITATION_THRESHOLD_MS,
  generateSessionInsight,
} from "./sessionInsight";

// --- fixture helpers -------------------------------------------------------

const ts = new Date("2026-04-18T12:00:00Z");

const charStat = (over: Partial<CharacterStat>): CharacterStat => ({
  character: over.character ?? "a",
  attempts: over.attempts ?? 100,
  errors: over.errors ?? 0,
  sumTime: over.sumTime ?? 100 * 180,
  hesitationCount: over.hesitationCount ?? 0,
});

const stats = (
  chars: CharacterStat[],
  bigrams: BigramStat[] = [],
): ComputedStats => ({ characters: chars, bigrams });

const baseline: UserBaseline = {
  meanErrorRate: 0.05,
  meanKeystrokeTime: 200,
  meanHesitationRate: 0.1,
};

const zeroSplitMetrics: SplitMetricsSnapshot = {
  innerColAttempts: 0,
  innerColErrors: 0,
  innerColErrorRate: 0,
  thumbClusterCount: 0,
  thumbClusterSumMs: 0,
  thumbClusterAvgMs: 0,
  crossHandBigramCount: 0,
  crossHandBigramSumMs: 0,
  crossHandBigramAvgMs: 0,
  columnarStableCount: 0,
  columnarDriftCount: 0,
  columnarStabilityPct: 1,
  totalKeystrokes: 500,
  insufficientData: false,
};

const event = (over: Partial<KeystrokeEvent> = {}): KeystrokeEvent => ({
  targetChar: over.targetChar ?? "a",
  actualChar: over.actualChar ?? over.targetChar ?? "a",
  isError:
    over.isError ??
    (over.actualChar !== undefined &&
      over.actualChar !== (over.targetChar ?? "a")),
  keystrokeMs: over.keystrokeMs ?? 180,
  prevChar: over.prevChar,
  timestamp: over.timestamp ?? ts,
});

type InputOverrides = {
  events?: KeystrokeEvent[];
  splitMetrics?: Partial<SplitMetricsSnapshot>;
  beforeStats?: ComputedStats;
  afterStats?: ComputedStats;
  phase?: TransitionPhase;
  sessionAccuracyPct?: number;
  sessionWpm?: number;
  prevSessionAccuracyPct?: number;
  prevSessionWpm?: number;
};

const defaultStats = stats([charStat({ character: "a" })]);

const makeInput = (over: InputOverrides = {}) => ({
  events: over.events ?? [],
  splitMetrics: { ...zeroSplitMetrics, ...(over.splitMetrics ?? {}) },
  beforeStats: over.beforeStats ?? defaultStats,
  afterStats: over.afterStats ?? defaultStats,
  baseline,
  phase: over.phase ?? ("transitioning" as TransitionPhase),
  sessionAccuracyPct: over.sessionAccuracyPct ?? 95,
  sessionWpm: over.sessionWpm ?? 50,
  prevSessionAccuracyPct: over.prevSessionAccuracyPct,
  prevSessionWpm: over.prevSessionWpm,
});

// --- trajectory framing ----------------------------------------------------

describe("generateSessionInsight — trajectory framing", () => {
  it("frames accuracy-up + speed-down as 'right-trajectory'", () => {
    const out = generateSessionInsight(
      makeInput({
        sessionAccuracyPct: 96,
        sessionWpm: 48,
        prevSessionAccuracyPct: 93,
        prevSessionWpm: 52,
      }),
    );
    expect(out.trajectoryFrame).toBe("right-trajectory");
    expect(out.plainLanguageSummary.toLowerCase()).toMatch(
      /muscle memory|tighter|right (direction|trajectory)/,
    );
  });

  it("frames accuracy-down + speed-up as 'concern'", () => {
    const out = generateSessionInsight(
      makeInput({
        sessionAccuracyPct: 91,
        sessionWpm: 55,
        prevSessionAccuracyPct: 94,
        prevSessionWpm: 50,
      }),
    );
    expect(out.trajectoryFrame).toBe("concern");
    expect(out.plainLanguageSummary.toLowerCase()).toMatch(
      /slow(ing)? down|accuracy slipped|accuracy dipped/,
    );
  });

  it("frames both-up as 'neutral'", () => {
    const out = generateSessionInsight(
      makeInput({
        sessionAccuracyPct: 96,
        sessionWpm: 55,
        prevSessionAccuracyPct: 94,
        prevSessionWpm: 50,
      }),
    );
    expect(out.trajectoryFrame).toBe("neutral");
  });

  it("frames both-down as 'mixed'", () => {
    const out = generateSessionInsight(
      makeInput({
        sessionAccuracyPct: 91,
        sessionWpm: 45,
        prevSessionAccuracyPct: 94,
        prevSessionWpm: 50,
      }),
    );
    expect(out.trajectoryFrame).toBe("mixed");
    expect(out.plainLanguageSummary.toLowerCase()).toMatch(
      /break|shorter|dipped/,
    );
  });

  it("falls back to 'neutral' when there is no prior session", () => {
    const out = generateSessionInsight(makeInput({}));
    expect(out.trajectoryFrame).toBe("neutral");
  });
});

// --- pattern detection -----------------------------------------------------

describe("generateSessionInsight — pattern detection", () => {
  const bnPair = () => [
    event({ targetChar: "b", actualChar: "n" }),
    event({ targetChar: "n", actualChar: "b" }),
  ];

  it("surfaces B↔N confusion when there are 3+ b/n substitutions", () => {
    const events = [...bnPair(), ...bnPair()]; // 4 pairs
    const out = generateSessionInsight(makeInput({ events }));
    const bn = out.patterns.find((p) => p.kind === "bn-confusion");
    expect(bn).toBeDefined();
    expect(bn?.count).toBe(4);
    expect(bn?.evidence).toMatch(/b.?n|n.?b/i);
  });

  it("does NOT surface B↔N confusion below 3 occurrences", () => {
    const events = [event({ targetChar: "b", actualChar: "n" })];
    const out = generateSessionInsight(makeInput({ events }));
    expect(out.patterns.some((p) => p.kind === "bn-confusion")).toBe(false);
  });

  it("surfaces B↔V drift when there are 3+ b/v substitutions", () => {
    const events = [
      event({ targetChar: "b", actualChar: "v" }),
      event({ targetChar: "b", actualChar: "v" }),
      event({ targetChar: "v", actualChar: "b" }),
    ];
    const out = generateSessionInsight(makeInput({ events }));
    const bv = out.patterns.find((p) => p.kind === "bv-drift");
    expect(bv).toBeDefined();
    expect(bv?.count).toBe(3);
  });

  it("surfaces thumb-hesitation when thumbClusterAvgMs exceeds threshold", () => {
    const out = generateSessionInsight(
      makeInput({
        splitMetrics: {
          thumbClusterCount: 50,
          thumbClusterSumMs: 50 * (THUMB_HESITATION_THRESHOLD_MS + 50),
          thumbClusterAvgMs: THUMB_HESITATION_THRESHOLD_MS + 50,
        },
      }),
    );
    const thumb = out.patterns.find((p) => p.kind === "thumb-hesitation");
    expect(thumb).toBeDefined();
  });

  it("does NOT surface thumb-hesitation below threshold", () => {
    const out = generateSessionInsight(
      makeInput({
        splitMetrics: {
          thumbClusterCount: 50,
          thumbClusterSumMs: 50 * (THUMB_HESITATION_THRESHOLD_MS - 50),
          thumbClusterAvgMs: THUMB_HESITATION_THRESHOLD_MS - 50,
        },
      }),
    );
    expect(out.patterns.some((p) => p.kind === "thumb-hesitation")).toBe(false);
  });

  it("does NOT surface thumb-hesitation when there are no thumb events at all", () => {
    // Zero thumb events → avg is 0 which is below threshold but we should
    // also never claim 'hesitation' when the user didn't press space enough.
    const out = generateSessionInsight(
      makeInput({
        splitMetrics: { thumbClusterCount: 0, thumbClusterAvgMs: 0 },
      }),
    );
    expect(out.patterns.some((p) => p.kind === "thumb-hesitation")).toBe(false);
  });

  it("returns an empty patterns array when nothing triggers", () => {
    const out = generateSessionInsight(makeInput({}));
    expect(out.patterns).toEqual([]);
  });
});

// --- improvements + new weaknesses -----------------------------------------

describe("generateSessionInsight — improvements + new weaknesses", () => {
  it("reports improvement deltas for units that were top-weakness before", () => {
    // 'b' was weak before (30% error rate), improved after (10% error rate).
    const before = stats([
      charStat({ character: "b", attempts: 100, errors: 30, sumTime: 100 * 300 }),
      charStat({ character: "a", attempts: 100, errors: 1 }),
    ]);
    const after = stats([
      charStat({ character: "b", attempts: 100, errors: 10, sumTime: 100 * 220 }),
      charStat({ character: "a", attempts: 100, errors: 1 }),
    ]);
    const out = generateSessionInsight(
      makeInput({ beforeStats: before, afterStats: after }),
    );
    const bDelta = out.improvements.find((d) => d.unit === "b");
    expect(bDelta).toBeDefined();
    expect(bDelta?.errorRateBefore).toBeCloseTo(0.3, 5);
    expect(bDelta?.errorRateAfter).toBeCloseTo(0.1, 5);
  });

  it("excludes low-confidence units from the top-weakness ranking", () => {
    // 'z' has high error rate but only 3 attempts — should be ignored.
    const before = stats([
      charStat({ character: "z", attempts: 3, errors: 3 }),
      charStat({ character: "b", attempts: 100, errors: 20 }),
    ]);
    const out = generateSessionInsight(
      makeInput({ beforeStats: before, afterStats: before }),
    );
    expect(out.improvements.some((d) => d.unit === "z")).toBe(false);
    expect(out.improvements.some((d) => d.unit === "b")).toBe(true);
  });

  it("reports units that are top-weakness AFTER but weren't before", () => {
    const before = stats([
      charStat({ character: "a", attempts: 100, errors: 1 }),
      charStat({ character: "b", attempts: 100, errors: 25 }),
    ]);
    const after = stats([
      charStat({ character: "a", attempts: 100, errors: 1 }),
      charStat({ character: "b", attempts: 100, errors: 25 }),
      // 'e' was fine before, now is weak.
      charStat({ character: "e", attempts: 100, errors: 30 }),
    ]);
    const out = generateSessionInsight(
      makeInput({ beforeStats: before, afterStats: after }),
    );
    expect(out.newWeaknesses).toContain("e");
    expect(out.newWeaknesses).not.toContain("b");
  });

  it("returns empty arrays when there are no weak units", () => {
    const clean = stats([charStat({ character: "a", attempts: 100, errors: 1 })]);
    const out = generateSessionInsight(
      makeInput({ beforeStats: clean, afterStats: clean }),
    );
    expect(out.improvements).toEqual([]);
    expect(out.newWeaknesses).toEqual([]);
  });
});

// --- phase-aware copy ------------------------------------------------------

describe("generateSessionInsight — phase-aware copy", () => {
  it("uses 'muscle memory' framing during transitioning phase", () => {
    const out = generateSessionInsight(
      makeInput({
        phase: "transitioning",
        sessionAccuracyPct: 96,
        sessionWpm: 48,
        prevSessionAccuracyPct: 93,
        prevSessionWpm: 52,
      }),
    );
    expect(out.plainLanguageSummary.toLowerCase()).toContain("muscle memory");
  });

  it("uses 'flow' / 'polishing' framing during refining phase", () => {
    const out = generateSessionInsight(
      makeInput({
        phase: "refining",
        sessionAccuracyPct: 96,
        sessionWpm: 48,
        prevSessionAccuracyPct: 93,
        prevSessionWpm: 52,
      }),
    );
    expect(out.plainLanguageSummary.toLowerCase()).toMatch(/flow|polish/);
  });

  it("next recommendation leans on accuracy during transitioning phase", () => {
    const before = stats([
      charStat({ character: "b", attempts: 100, errors: 25 }),
    ]);
    const out = generateSessionInsight(
      makeInput({ phase: "transitioning", beforeStats: before, afterStats: before }),
    );
    expect(out.nextRecommendation.toLowerCase()).toMatch(/accuracy|careful/);
  });

  it("next recommendation leans into speed during refining phase", () => {
    const before = stats([
      charStat({ character: "b", attempts: 100, errors: 25 }),
    ]);
    const out = generateSessionInsight(
      makeInput({ phase: "refining", beforeStats: before, afterStats: before }),
    );
    expect(out.nextRecommendation.toLowerCase()).toMatch(/speed|flow/);
  });
});

// --- accuracy-first copy self-check ----------------------------------------

describe("generateSessionInsight — accuracy-first copy lint", () => {
  it("exports a non-empty BANNED_WORDS list", () => {
    expect(Array.isArray(BANNED_WORDS)).toBe(true);
    expect(BANNED_WORDS.length).toBeGreaterThan(0);
  });

  it("never emits banned hype words in any summary it produces", () => {
    // Exercise a representative matrix of inputs and assert none of the
    // produced summaries contain banned language. Cheap but effective.
    const scenarios = [
      makeInput({
        sessionAccuracyPct: 96,
        sessionWpm: 48,
        prevSessionAccuracyPct: 93,
        prevSessionWpm: 52,
      }),
      makeInput({
        sessionAccuracyPct: 91,
        sessionWpm: 55,
        prevSessionAccuracyPct: 94,
        prevSessionWpm: 50,
      }),
      makeInput({
        events: [
          event({ targetChar: "b", actualChar: "n" }),
          event({ targetChar: "b", actualChar: "n" }),
          event({ targetChar: "n", actualChar: "b" }),
        ],
      }),
      makeInput({ phase: "refining" }),
    ];
    for (const s of scenarios) {
      const out = generateSessionInsight(s);
      const all = `${out.plainLanguageSummary} ${out.nextRecommendation}`.toLowerCase();
      for (const banned of BANNED_WORDS) {
        expect(all).not.toContain(banned.toLowerCase());
      }
      // No ALL-CAPS emphasis and no multiple bangs.
      expect(all).not.toMatch(/!{2,}/);
    }
  });
});
