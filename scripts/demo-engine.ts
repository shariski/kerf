/**
 * Phase 1 milestone demo — simulates a transitioning-phase user and a
 * refining-phase user, runs every layer of the adaptive engine end to
 * end, and prints human-readable output. Run manually for a gut-check
 * of the engine's behavior per docs/03-task-breakdown.md §1.6.
 *
 * Run:  pnpm demo:engine
 *
 * No network, no database — this script composes pure domain functions
 * over synthetic fixtures and the bundled corpus. Deterministic (seeded
 * rng), so output is reproducible across machines.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { generateExercise } from "../src/domain/adaptive/exerciseGenerator";
import {
  generateCrossHandBigramDrill,
  generateInnerColumnDrill,
  generateThumbClusterDrill,
} from "../src/domain/adaptive/drillGenerator";
import { suggestPhaseTransition } from "../src/domain/adaptive/phaseSuggestion";
import { mulberry32 } from "../src/domain/adaptive/rng";
import {
  computeWeaknessScore,
  isLowConfidence,
} from "../src/domain/adaptive/weaknessScore";
import { createCorpusLoader } from "../src/domain/corpus/loader";
import type { Corpus } from "../src/domain/corpus/types";
import { generateSessionInsight } from "../src/domain/insight/sessionInsight";
import { computeSplitMetrics } from "../src/domain/metrics/computeSplitMetrics";
import type {
  BigramStat,
  CharacterStat,
  ComputedStats,
  KeystrokeEvent,
  TransitionPhase,
  UserBaseline,
} from "../src/domain/stats/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS_PATH = resolve(__dirname, "..", "public", "corpus.json");

// --- fixtures --------------------------------------------------------------

const baseline: UserBaseline = {
  meanErrorRate: 0.05,
  meanKeystrokeTime: 200,
  meanHesitationRate: 0.1,
  journey: "conventional",
};

const charStat = (
  character: string,
  attempts: number,
  errors: number,
  meanTimeMs: number,
  hesitationCount = 0,
): CharacterStat => ({
  character,
  attempts,
  errors,
  sumTime: attempts * meanTimeMs,
  hesitationCount,
});

const bigramStat = (
  bigram: string,
  attempts: number,
  errors: number,
  meanTimeMs: number,
): BigramStat => ({
  bigram,
  attempts,
  errors,
  sumTime: attempts * meanTimeMs,
});

// Transitioning user — clearly struggles with inner-column + cross-hand.
const transitioningBefore: ComputedStats = {
  characters: [
    charStat("a", 300, 3, 180),
    charStat("e", 300, 6, 190),
    charStat("b", 120, 28, 320, 14), // weak
    charStat("n", 140, 22, 280, 10), // weak
    charStat("h", 130, 19, 260, 8), // weak
    charStat("t", 200, 5, 200),
    charStat("s", 180, 4, 190),
  ],
  bigrams: [
    bigramStat("th", 80, 12, 260),
    bigramStat("he", 70, 9, 240),
  ],
};

// Transitioning user — after a session, weaknesses softened.
const transitioningAfter: ComputedStats = {
  characters: [
    charStat("a", 320, 3, 180),
    charStat("e", 320, 6, 190),
    charStat("b", 150, 16, 270, 8), // improved
    charStat("n", 160, 14, 250, 6), // improved
    charStat("h", 150, 12, 230, 5), // improved
    charStat("t", 220, 5, 200),
    charStat("s", 200, 4, 190),
    // new weakness surfaced
    charStat("r", 200, 40, 260),
  ],
  bigrams: [
    bigramStat("th", 100, 10, 240),
    bigramStat("he", 90, 7, 220),
  ],
};

// Refining user — mostly fluent, tiny residual hesitations.
const refiningBefore: ComputedStats = {
  characters: [
    charStat("a", 500, 5, 150),
    charStat("e", 500, 4, 150),
    charStat("b", 300, 9, 170, 4),
    charStat("n", 320, 10, 170, 5),
    charStat("h", 310, 8, 160, 3),
    charStat("t", 400, 6, 155),
    charStat("s", 380, 5, 150),
    // one bigram still a little sticky — classic refining-phase residue
    charStat("r", 400, 14, 195, 12),
  ],
  bigrams: [
    bigramStat("th", 180, 6, 170),
    bigramStat("he", 170, 5, 160),
  ],
};

const refiningAfter: ComputedStats = refiningBefore;

// Synthetic keystroke events for split-metrics demonstration.
const ts = new Date("2026-04-19T10:00:00Z");
const ev = (over: Partial<KeystrokeEvent>): KeystrokeEvent => ({
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

const filler = (n: number): KeystrokeEvent[] =>
  Array.from({ length: n }, () => ev({ targetChar: "a", keystrokeMs: 175 }));

const transitioningEvents: KeystrokeEvent[] = [
  ...filler(120),
  // Inner-column struggle: B, N errors
  ev({ targetChar: "b", actualChar: "v", keystrokeMs: 320 }), // drift
  ev({ targetChar: "b", actualChar: "v", keystrokeMs: 340 }), // drift
  ev({ targetChar: "b", actualChar: "n", keystrokeMs: 300 }), // QWERTY residue
  ev({ targetChar: "n", actualChar: "b", keystrokeMs: 290 }), // QWERTY residue
  ev({ targetChar: "n", actualChar: "b", keystrokeMs: 310 }), // QWERTY residue
  // Cross-hand bigram timing
  ev({ targetChar: "h", prevChar: "t", keystrokeMs: 280 }),
  ev({ targetChar: "e", prevChar: "h", keystrokeMs: 260 }),
  ev({ targetChar: "y", prevChar: "e", keystrokeMs: 300 }),
  // Thumb cluster — slow, hesitant
  ev({ targetChar: " ", prevChar: "e", keystrokeMs: 420 }),
  ev({ targetChar: " ", prevChar: "d", keystrokeMs: 410 }),
  ev({ targetChar: " ", prevChar: "s", keystrokeMs: 440 }),
];

const refiningEvents: KeystrokeEvent[] = [
  ...filler(300),
  // A few residual errors, much cleaner timing
  ev({ targetChar: "b", actualChar: "v", keystrokeMs: 180 }),
  ev({ targetChar: "h", prevChar: "t", keystrokeMs: 150 }),
  ev({ targetChar: "e", prevChar: "h", keystrokeMs: 145 }),
  ev({ targetChar: " ", prevChar: "e", keystrokeMs: 190 }),
  ev({ targetChar: " ", prevChar: "d", keystrokeMs: 185 }),
];

// --- helpers ---------------------------------------------------------------

function loadCorpus(): Promise<Corpus> {
  const loader = createCorpusLoader({
    fetchJson: async () => JSON.parse(readFileSync(CORPUS_PATH, "utf8")),
  });
  return loader.load();
}

function rankWeaknesses(
  stats: ComputedStats,
  phase: TransitionPhase,
): { id: string; score: number }[] {
  const units: (CharacterStat | BigramStat)[] = [
    ...stats.characters,
    ...stats.bigrams,
  ];
  return units
    .filter((u) => !isLowConfidence(u))
    .map((u) => ({
      id: "character" in u ? u.character : u.bigram,
      score: computeWeaknessScore(u, baseline, phase, 0),
    }))
    .sort((a, b) => b.score - a.score);
}

function weaknessLookup(
  stats: ComputedStats,
  phase: TransitionPhase,
): (id: string) => number {
  const ranked = rankWeaknesses(stats, phase);
  const map = new Map(ranked.map((r) => [r.id, r.score]));
  return (id) => map.get(id) ?? 0;
}

function heading(s: string): void {
  console.log(`\n${"─".repeat(72)}`);
  console.log(s);
  console.log("─".repeat(72));
}

function sub(s: string): void {
  console.log(`\n  ${s}`);
}

function kv(label: string, value: string | number): void {
  console.log(`    ${label.padEnd(28)} ${value}`);
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

// --- simulation ------------------------------------------------------------

async function simulate(
  phase: TransitionPhase,
  before: ComputedStats,
  after: ComputedStats,
  events: KeystrokeEvent[],
  corpus: Corpus,
  session: { accuracyPct: number; wpm: number; prevAccuracyPct?: number; prevWpm?: number },
  seed: number,
): Promise<void> {
  heading(`${phase.toUpperCase()} user`);

  sub("Top weaknesses (before session, phase-aware ranking):");
  const ranked = rankWeaknesses(before, phase).slice(0, 5);
  for (const r of ranked) kv(`'${r.id}'`, r.score.toFixed(3));

  sub("Adaptive exercise (first 20 words):");
  const exercise = generateExercise({
    corpus,
    weaknessScoreFor: weaknessLookup(before, phase),
    targetWordCount: 50,
    rng: mulberry32(seed),
  });
  console.log(`    ${exercise.slice(0, 20).join(" ")}`);

  sub("Drill presets (first 120 chars each):");
  const inner = generateInnerColumnDrill({
    corpus,
    targetLength: 240,
    rng: mulberry32(seed + 1),
  });
  const cross = generateCrossHandBigramDrill({
    corpus,
    targetLength: 240,
    rng: mulberry32(seed + 2),
  });
  const thumb = generateThumbClusterDrill({
    corpus,
    targetLength: 240,
    rng: mulberry32(seed + 3),
  });
  console.log(`    inner-column : ${inner.slice(0, 120)}…`);
  console.log(`    cross-hand   : ${cross.slice(0, 120)}…`);
  console.log(`    thumb-cluster: ${thumb.slice(0, 120)}…`);

  sub("Split metrics snapshot:");
  const splitMetrics = computeSplitMetrics(events, "sofle");
  kv("totalKeystrokes", splitMetrics.totalKeystrokes);
  kv("insufficientData", String(splitMetrics.insufficientData));
  kv("innerColErrorRate", pct(splitMetrics.innerColErrorRate));
  kv("thumbClusterAvgMs", `${splitMetrics.thumbClusterAvgMs.toFixed(0)}ms`);
  kv("crossHandBigramAvgMs", `${splitMetrics.crossHandBigramAvgMs.toFixed(0)}ms`);
  kv("columnarStabilityPct", pct(splitMetrics.columnarStabilityPct));
  kv(
    "drift/stable counts",
    `${splitMetrics.columnarDriftCount} drift / ${splitMetrics.columnarStableCount} stable`,
  );

  sub("Session insight:");
  const insight = generateSessionInsight({
    events,
    splitMetrics,
    beforeStats: before,
    afterStats: after,
    baseline,
    phase,
    sessionAccuracyPct: session.accuracyPct,
    sessionWpm: session.wpm,
    prevSessionAccuracyPct: session.prevAccuracyPct,
    prevSessionWpm: session.prevWpm,
  });
  kv("trajectoryFrame", insight.trajectoryFrame);
  kv("improvements", insight.improvements.map((d) => d.unit).join(", ") || "—");
  kv("newWeaknesses", insight.newWeaknesses.join(", ") || "—");
  kv(
    "patterns",
    insight.patterns.map((p) => p.kind).join(", ") || "—",
  );
  console.log(`\n    Summary:\n      ${insight.plainLanguageSummary}`);
  console.log(`\n    Next recommendation:\n      ${insight.nextRecommendation}`);
}

async function simulatePhaseSuggestion(): Promise<void> {
  heading("PHASE SUGGESTION signals");

  // Graduation case — 10 clean sessions from a transitioning user.
  const graduation = suggestPhaseTransition({
    currentPhase: "transitioning",
    lastSessionAt: new Date("2026-04-18T00:00:00Z"),
    recentSessions: Array.from({ length: 10 }, () => ({ accuracy: 0.965 })),
    recentSnapshots: Array.from({ length: 10 }, () => ({
      innerColAttempts: 300,
      innerColErrors: 12,
      innerColErrorRate: 0.04,
      thumbClusterCount: 50,
      thumbClusterSumMs: 50 * 220,
      thumbClusterAvgMs: 220,
      crossHandBigramCount: 40,
      crossHandBigramSumMs: 40 * 180,
      crossHandBigramAvgMs: 180,
      columnarStableCount: 3,
      columnarDriftCount: 1,
      columnarStabilityPct: 0.75,
      totalKeystrokes: 800,
      insufficientData: false,
    })),
    now: new Date("2026-04-19T00:00:00Z"),
  });

  sub("Transitioning → Refining (graduation):");
  if (graduation) {
    kv("suggestedPhase", graduation.suggestedPhase);
    kv("confidence", graduation.confidence);
    console.log(`    reason: ${graduation.reason}`);
  } else {
    console.log("    (no signal)");
  }

  // Break-return case — refining user back after 20 days with an accuracy dip.
  const breakReturn = suggestPhaseTransition({
    currentPhase: "refining",
    lastSessionAt: new Date("2026-03-30T00:00:00Z"),
    recentSessions: [
      { accuracy: 0.84 },
      { accuracy: 0.85 },
      { accuracy: 0.83 },
    ],
    recentSnapshots: Array.from({ length: 3 }, () => ({
      innerColAttempts: 100,
      innerColErrors: 12,
      innerColErrorRate: 0.12,
      thumbClusterCount: 20,
      thumbClusterSumMs: 20 * 300,
      thumbClusterAvgMs: 300,
      crossHandBigramCount: 10,
      crossHandBigramSumMs: 10 * 230,
      crossHandBigramAvgMs: 230,
      columnarStableCount: 2,
      columnarDriftCount: 2,
      columnarStabilityPct: 0.5,
      totalKeystrokes: 400,
      insufficientData: false,
    })),
    now: new Date("2026-04-19T00:00:00Z"),
  });

  sub("Refining → Transitioning (break return):");
  if (breakReturn) {
    kv("suggestedPhase", breakReturn.suggestedPhase);
    kv("confidence", breakReturn.confidence);
    console.log(`    reason: ${breakReturn.reason}`);
  } else {
    console.log("    (no signal)");
  }
}

// --- main ------------------------------------------------------------------

async function main(): Promise<void> {
  const corpus = await loadCorpus();
  console.log(
    `\nkerf adaptive engine demo — corpus has ${corpus.words.length} words\n`,
  );

  await simulate(
    "transitioning",
    transitioningBefore,
    transitioningAfter,
    transitioningEvents,
    corpus,
    { accuracyPct: 93.5, wpm: 42, prevAccuracyPct: 91, prevWpm: 44 },
    1,
  );

  await simulate(
    "refining",
    refiningBefore,
    refiningAfter,
    refiningEvents,
    corpus,
    { accuracyPct: 97.2, wpm: 68, prevAccuracyPct: 95.8, prevWpm: 71 },
    2,
  );

  await simulatePhaseSuggestion();

  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
