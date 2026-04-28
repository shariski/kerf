import type { SplitMetricsSnapshot } from "../metrics/types";
import { computeWeaknessScore, isLowConfidence } from "../adaptive/weaknessScore";
import type {
  BigramStat,
  CharacterStat,
  ComputedStats,
  KeystrokeEvent,
  TransitionPhase,
  UserBaseline,
} from "../stats/types";
import type { PatternDetection, SessionInsight, TrajectoryFrame, UnitDelta } from "./types";

/**
 * Session insight generation per 02-architecture.md §4.4 and
 * task-breakdown §1.5.
 *
 * Template-based (no LLM — see product-spec §7 / CLAUDE.md §B7). Every
 * string emitted honors accuracy-first copy guidelines from
 * product-spec §6.2:
 *
 *   - Accuracy leads; speed is framed in relation to it.
 *   - Accuracy-up+speed-down is the positive frame.
 *   - Accuracy-down+speed-up is framed as concern, not a win.
 *   - No hype words (see BANNED_WORDS), no stacked exclamation marks.
 *
 * Phase-aware: transitioning phase uses "building muscle memory"
 * language; refining phase uses "polishing flow" language (§B3).
 */

// --- thresholds ------------------------------------------------------------

/** Minimum number of substitution events (b→n, n→b) required to surface
 * a B↔N / B↔V pattern in the post-session summary. Below this, the
 * pattern is likely noise. */
export const SUBSTITUTION_PATTERN_THRESHOLD = 3;

/** Thumb cluster average over this value triggers a "hesitation"
 * pattern. Tuned from §4.5 pseudocode; can be revisited after beta. */
export const THUMB_HESITATION_THRESHOLD_MS = 350;

/** Minimum weakness score to count as a ranked weakness. A unit whose
 * error rate, slowness, and hesitation all sit at or below baseline
 * produces a score near the sum of coefficients (~0.9); requiring >1.0
 * keeps "top weakness" meaning "noteworthy weakness", not "barely worse
 * than average". */
export const WEAKNESS_SCORE_THRESHOLD = 1.0;

/** Minimum accuracy delta (percentage points) to register as a
 * meaningful direction change versus the prior session. Guards against
 * tiny fluctuations driving copy swings. */
export const ACCURACY_MEANINGFUL_DELTA_PCT = 0.5;

/** Words that must never appear in generated copy per §B3. The test
 * file lints every emitted summary against this list. */
export const BANNED_WORDS: readonly string[] = [
  "amazing",
  "crushing it",
  "nailed it",
  "incredible",
  "awesome",
  "killing it",
  "rockstar",
  "legend",
];

// --- input type ------------------------------------------------------------

export type SessionInsightInput = {
  events: readonly KeystrokeEvent[];
  splitMetrics: SplitMetricsSnapshot;
  beforeStats: ComputedStats;
  afterStats: ComputedStats;
  baseline: UserBaseline;
  phase: TransitionPhase;
  sessionAccuracyPct: number;
  sessionWpm: number;
  prevSessionAccuracyPct?: number;
  prevSessionWpm?: number;
};

// --- helpers ---------------------------------------------------------------

const unitName = (unit: CharacterStat | BigramStat): string =>
  "character" in unit ? unit.character : unit.bigram;

const safeRate = (errors: number, attempts: number): number =>
  attempts > 0 ? errors / attempts : 0;

const safeMeanTime = (sumTime: number, attempts: number): number =>
  attempts > 0 ? sumTime / attempts : 0;

function rankedWeakUnits(
  stats: ComputedStats,
  baseline: UserBaseline,
  phase: TransitionPhase,
  topN = 3,
): (CharacterStat | BigramStat)[] {
  const all: (CharacterStat | BigramStat)[] = [...stats.characters, ...stats.bigrams];
  const scored = all
    .filter((u) => !isLowConfidence(u))
    // Phase A: we don't have a frequency table wired in, so pass 0 — the
    // DELTA penalty term drops out and score reflects error/speed/hesitation
    // only. Downstream ranking is unaffected.
    .map((u) => ({ u, s: computeWeaknessScore(u, baseline, phase, 0) }))
    .filter(({ s }) => s > WEAKNESS_SCORE_THRESHOLD)
    .sort((a, b) => b.s - a.s);
  return scored.slice(0, topN).map(({ u }) => u);
}

function findUnit(stats: ComputedStats, name: string): CharacterStat | BigramStat | undefined {
  return (
    stats.characters.find((c) => c.character === name) ??
    stats.bigrams.find((b) => b.bigram === name)
  );
}

function buildImprovements(
  topBefore: (CharacterStat | BigramStat)[],
  afterStats: ComputedStats,
): UnitDelta[] {
  return topBefore.map((unit) => {
    const name = unitName(unit);
    const after = findUnit(afterStats, name);
    return {
      unit: name,
      errorRateBefore: safeRate(unit.errors, unit.attempts),
      errorRateAfter: after ? safeRate(after.errors, after.attempts) : 0,
      meanTimeBefore: safeMeanTime(unit.sumTime, unit.attempts),
      meanTimeAfter: after ? safeMeanTime(after.sumTime, after.attempts) : 0,
    };
  });
}

function buildNewWeaknesses(
  topBefore: (CharacterStat | BigramStat)[],
  topAfter: (CharacterStat | BigramStat)[],
): string[] {
  const beforeNames = new Set(topBefore.map(unitName));
  return topAfter.map(unitName).filter((n) => !beforeNames.has(n));
}

// --- pattern detection -----------------------------------------------------

function countPair(events: readonly KeystrokeEvent[], a: string, b: string): number {
  let n = 0;
  for (const e of events) {
    if (!e.isError) continue;
    const t = e.targetChar.toLowerCase();
    const ac = e.actualChar.toLowerCase();
    if ((t === a && ac === b) || (t === b && ac === a)) n++;
  }
  return n;
}

function detectPatterns(
  events: readonly KeystrokeEvent[],
  splitMetrics: SplitMetricsSnapshot,
): PatternDetection[] {
  const patterns: PatternDetection[] = [];

  const bn = countPair(events, "b", "n");
  if (bn >= SUBSTITUTION_PATTERN_THRESHOLD) {
    patterns.push({
      kind: "bn-confusion",
      count: bn,
      evidence: `${bn} B↔N substitutions this session — a common QWERTY-memory pattern.`,
    });
  }

  const bv = countPair(events, "b", "v");
  if (bv >= SUBSTITUTION_PATTERN_THRESHOLD) {
    patterns.push({
      kind: "bv-drift",
      count: bv,
      evidence: `${bv} B↔V substitutions this session — likely columnar drift on the left inner column.`,
    });
  }

  if (
    splitMetrics.thumbClusterCount > 0 &&
    splitMetrics.thumbClusterAvgMs > THUMB_HESITATION_THRESHOLD_MS
  ) {
    patterns.push({
      kind: "thumb-hesitation",
      count: splitMetrics.thumbClusterCount,
      evidence: `Thumb cluster averaged ${Math.round(
        splitMetrics.thumbClusterAvgMs,
      )}ms — slower than the rest of your keystrokes, so the thumb is still deciding.`,
    });
  }

  return patterns;
}

// --- trajectory ------------------------------------------------------------

function classifyTrajectory(
  accPct: number,
  wpm: number,
  prevAccPct?: number,
  prevWpm?: number,
): TrajectoryFrame {
  if (prevAccPct === undefined || prevWpm === undefined) return "neutral";
  const accDelta = accPct - prevAccPct;
  const wpmDelta = wpm - prevWpm;
  const accSignificant = Math.abs(accDelta) >= ACCURACY_MEANINGFUL_DELTA_PCT;
  if (!accSignificant) return "neutral";

  const accUp = accDelta > 0;
  const wpmUp = wpmDelta > 0;
  if (accUp && !wpmUp) return "right-trajectory";
  if (!accUp && wpmUp) return "concern";
  if (!accUp && !wpmUp) return "mixed";
  return "neutral"; // both up
}

// --- copy composition ------------------------------------------------------

function trajectoryOpener(frame: TrajectoryFrame, phase: TransitionPhase): string {
  switch (frame) {
    case "right-trajectory":
      return phase === "transitioning"
        ? "Slower, tighter, stronger. This is how muscle memory forms."
        : "Accuracy climbed and you eased off the throttle — that polishes flow.";
    case "concern":
      return "Speed ticked up, but accuracy dipped. Slowing down will pay off.";
    case "mixed":
      return "Both accuracy and speed dipped a bit. Consider a short break or a lighter session next.";
    case "neutral":
      return phase === "transitioning"
        ? "Another rep in the books. Muscle memory is built one careful session at a time."
        : "Steady session. Keep the flow loose and accurate.";
  }
}

function nextRecommendation(
  topAfter: (CharacterStat | BigramStat)[],
  phase: TransitionPhase,
): string {
  if (topAfter.length === 0) {
    return phase === "transitioning"
      ? "Next session will keep the same focus — accuracy first."
      : "Next session will lean into flow and speed while holding accuracy.";
  }
  // biome-ignore lint/style/noNonNullAssertion: empty topAfter branch returned above; topAfter[0] is defined here.
  const name = unitName(topAfter[0]!);
  return phase === "transitioning"
    ? `We'll keep ${name} in your next rotation, leaning on careful accuracy.`
    : `We'll keep ${name} in your next rotation, leaning into speed and flow.`;
}

function composePlainLanguageSummary(
  frame: TrajectoryFrame,
  phase: TransitionPhase,
  improvements: UnitDelta[],
  newWeaknesses: string[],
  patterns: PatternDetection[],
  nextRec: string,
): string {
  const parts: string[] = [trajectoryOpener(frame, phase)];

  // Accuracy-first: mention the accuracy movement on the improved units
  // before any speed framing.
  const shrank = improvements.filter((d) => d.errorRateAfter < d.errorRateBefore);
  if (shrank.length > 0) {
    const names = shrank.map((d) => d.unit).join(", ");
    parts.push(`Error rate shrank on ${names}.`);
  }

  for (const p of patterns) {
    parts.push(p.evidence);
  }

  if (newWeaknesses.length > 0) {
    parts.push(
      `${newWeaknesses.join(", ")} surfaced as new weak spots — we'll add ${newWeaknesses.length > 1 ? "them" : "it"} to your rotation.`,
    );
  }

  parts.push(nextRec);
  return parts.join(" ");
}

// --- main ------------------------------------------------------------------

export function generateSessionInsight(input: SessionInsightInput): SessionInsight {
  const {
    events,
    splitMetrics,
    beforeStats,
    afterStats,
    baseline,
    phase,
    sessionAccuracyPct,
    sessionWpm,
    prevSessionAccuracyPct,
    prevSessionWpm,
  } = input;

  const topBefore = rankedWeakUnits(beforeStats, baseline, phase);
  const topAfter = rankedWeakUnits(afterStats, baseline, phase);

  const improvements = buildImprovements(topBefore, afterStats);
  const newWeaknesses = buildNewWeaknesses(topBefore, topAfter);
  const patterns = detectPatterns(events, splitMetrics);
  const trajectoryFrame = classifyTrajectory(
    sessionAccuracyPct,
    sessionWpm,
    prevSessionAccuracyPct,
    prevSessionWpm,
  );
  const rec = nextRecommendation(topAfter, phase);
  const plainLanguageSummary = composePlainLanguageSummary(
    trajectoryFrame,
    phase,
    improvements,
    newWeaknesses,
    patterns,
    rec,
  );

  return {
    improvements,
    newWeaknesses,
    patterns,
    trajectoryFrame,
    nextRecommendation: rec,
    plainLanguageSummary,
  };
}
