import type {
  BigramStat,
  CharacterStat,
  ComputedStats,
  TransitionPhase,
  UserBaseline,
} from "../stats/types";
import { bayesianWeakness, type MasteryStat } from "./bayesianMastery";
import type { JourneyCode } from "./journey";
import {
  INNER_LEFT,
  INNER_RIGHT,
  VERTICAL_COLUMNS,
  VERTICAL_LABELS,
  type VerticalColumnId,
} from "./motionPatterns";

export type TargetType =
  | "character"
  | "bigram"
  | "vertical-column"
  | "inner-column"
  | "thumb-cluster"
  | "hand-isolation"
  | "cross-hand-bigram"
  | "diagnostic";

export type SessionTarget = {
  type: TargetType;
  value: string;
  keys: string[];
  label: string;
  /** Engine score × journey weight. null for user-picked (drill mode) and diagnostic. */
  score?: number;
};

/**
 * Weights per ADR-003 §5 — hand-tuned starting values. Transparency panel
 * must state this honestly; revisit with beta feedback.
 */
export const TARGET_JOURNEY_WEIGHTS: Record<JourneyCode, Record<TargetType, number>> = {
  conventional: {
    character: 1.0,
    bigram: 1.0,
    "vertical-column": 1.2,
    "inner-column": 0.6,
    "thumb-cluster": 1.0,
    "hand-isolation": 1.0,
    "cross-hand-bigram": 1.0,
    diagnostic: 0,
  },
  columnar: {
    character: 1.0,
    bigram: 1.0,
    "vertical-column": 0.8,
    "inner-column": 1.2,
    "thumb-cluster": 1.0,
    "hand-isolation": 1.0,
    "cross-hand-bigram": 1.0,
    diagnostic: 0,
  },
  unsure: {
    character: 1.0,
    bigram: 1.0,
    "vertical-column": 1.2,
    "inner-column": 0.6,
    "thumb-cluster": 1.0,
    "hand-isolation": 1.0,
    "cross-hand-bigram": 1.0,
    diagnostic: 0,
  },
};

/**
 * Threshold below which a bigram's corpus support is considered "low."
 * Path 2 still uses this to **exclude** untrainable bigrams from the
 * ranking (a bigram with <3 corpus words containing it can't be
 * meaningfully exercised by the word-picker, so picking it as an
 * adaptive target produces a stuck loop). The Bayesian prior would
 * happily rank such bigrams at high weakness; this filter keeps them
 * out so the engine doesn't get stuck on them.
 */
export const LOW_CORPUS_SUPPORT_THRESHOLD = 3;

/**
 * Maximum consecutive sessions a single target value can win.
 * Anti-fatigue mechanism — orthogonal to the Bayesian scoring. After
 * the cap is hit, the target is filtered from the next session's
 * ranking and the second-best candidate wins. Once history breaks the
 * run, the target becomes eligible again.
 */
export const COOLDOWN_RUN_LENGTH = 3;

/**
 * Every Nth session, `selectTarget` short-circuits to a diagnostic
 * target — a forced broad-coverage session that re-measures across
 * the full key/bigram space. Bayesian scoring already handles unseen
 * letters via the prior, but a periodic diagnostic gives a clean
 * snapshot of all-letter performance for dashboard analytics.
 */
export const DIAGNOSTIC_PERIOD = 10;

export type RankTargetsOptions = {
  /** Precomputed `bigram → corpus word count` map. When present:
   *  bigram candidates with support < LOW_CORPUS_SUPPORT_THRESHOLD
   *  are excluded from ranking (untrainable). When absent, all
   *  bigrams in the user's stats are eligible. */
  corpusBigramSupport?: ReadonlyMap<string, number>;
  /** Precomputed `char → corpus word count` map. Required for the
   *  Path 2 Bayesian engine to enumerate the rankable character
   *  universe — every corpus character becomes a candidate, scored
   *  at the prior if there's no measured stat. Characters with
   *  support 0 are excluded (drill-key cross-layer leak guard). */
  corpusCharSupport?: ReadonlyMap<string, number>;
  /** Target values from the most recent sessions, newest first.
   *  When the last `COOLDOWN_RUN_LENGTH - 1` entries are all equal,
   *  that value is excluded — anti-fatigue rotation. */
  recentTargets?: readonly string[];
  /** 1-indexed number of the session about to be generated. When
   *  set and divisible by `DIAGNOSTIC_PERIOD`, `selectTarget`
   *  short-circuits to `diagnosticTarget()`. */
  upcomingSessionNumber?: number;
};

export function diagnosticTarget(): SessionTarget {
  return {
    type: "diagnostic",
    value: "baseline",
    keys: [],
    label: "Baseline capture",
  };
}

const ZERO_STAT: MasteryStat = { attempts: 0, errors: 0 };

/**
 * Build the character candidate list for the Bayesian engine.
 *
 * - When `corpusCharSupport` is provided: iterate every corpus
 *   character (the rankable universe), look up the user's stat if
 *   any, and score with `bayesianWeakness`. Characters with support
 *   0 are skipped (untrainable). Unseen characters score at the
 *   Bayesian prior (≈0.8), so they surface naturally.
 * - When `corpusCharSupport` is omitted: fall back to scoring only
 *   the user's measured characters. Same model, smaller universe.
 *   Used by tests/fixtures that don't load a corpus.
 */
function characterCandidates(
  stats: CharacterStat[],
  corpusCharSupport: ReadonlyMap<string, number> | undefined,
): SessionTarget[] {
  const statByChar = new Map(stats.map((s) => [s.character, s]));
  const universe: string[] = corpusCharSupport
    ? [...corpusCharSupport.keys()].filter((c) => (corpusCharSupport.get(c) ?? 0) > 0)
    : stats.map((s) => s.character);
  return universe.map<SessionTarget>((char) => {
    const stat = statByChar.get(char) ?? ZERO_STAT;
    const score = bayesianWeakness(stat);
    return {
      type: "character",
      value: char,
      keys: [char],
      label:
        stat.attempts >= 5
          ? `Your weakness: ${char.toUpperCase()}`
          : `Building familiarity: ${char.toUpperCase()}`,
      score,
    };
  });
}

/**
 * Sum (attempts, errors) across the keys in a column. Returns a
 * MasteryStat suitable for `bayesianWeakness`. If the user has no
 * stats on any key in the column, the aggregate is (0, 0) → prior
 * weakness 0.8, so unmeasured columns surface naturally just like
 * unmeasured single chars.
 */
function aggregateColumnStat(stats: CharacterStat[], columnKeys: readonly string[]): MasteryStat {
  const keySet = new Set(columnKeys.map((k) => k.toLowerCase()));
  let attempts = 0;
  let errors = 0;
  for (const s of stats) {
    if (keySet.has(s.character.toLowerCase())) {
      attempts += s.attempts;
      errors += s.errors;
    }
  }
  return { attempts, errors };
}

/**
 * Bayesian-scored motion candidates — replaces the legacy
 * `motionPatterns.ts` candidate functions whose unbounded
 * `errors/baseline.meanErrorRate` formula produced scores out of
 * scale with the [0, 1]-bounded character/bigram Bayesian scores.
 * Now everything is on the same scale so journey weights can do
 * their job correctly.
 */
function bayesianMotionCandidates(stats: CharacterStat[]): SessionTarget[] {
  const out: SessionTarget[] = [];
  // Motion candidates differ from character/bigram candidates: there's
  // no "corpus support map" to define their universe. So unlike
  // characters (where every corpus letter is a candidate, scored at
  // the prior if unmeasured), motion candidates only enter the
  // ranking when their aggregate has actual data — `attempts > 0`.
  // Otherwise 10 vertical columns + 2 inner columns + thumb-cluster
  // would all show up at the prior weakness, dominate the ranking
  // via journey weights, and crowd out everything else.
  // Vertical columns (10 — 5 columns × 2 hands).
  for (const id of Object.keys(VERTICAL_COLUMNS) as VerticalColumnId[]) {
    const keys = VERTICAL_COLUMNS[id];
    const stat = aggregateColumnStat(stats, keys);
    if (stat.attempts === 0) continue;
    out.push({
      type: "vertical-column",
      value: id,
      keys: [...keys],
      label: VERTICAL_LABELS[id],
      score: bayesianWeakness(stat),
    });
  }
  // Inner columns (2 — left B/G/T, right H/N/Y).
  const leftInner = aggregateColumnStat(stats, INNER_LEFT);
  if (leftInner.attempts > 0) {
    out.push({
      type: "inner-column",
      value: "inner-left",
      keys: [...INNER_LEFT],
      label: "Inner-column reach — B, G, T (left hand)",
      score: bayesianWeakness(leftInner),
    });
  }
  const rightInner = aggregateColumnStat(stats, INNER_RIGHT);
  if (rightInner.attempts > 0) {
    out.push({
      type: "inner-column",
      value: "inner-right",
      keys: [...INNER_RIGHT],
      label: "Inner-column reach — H, N, Y (right hand)",
      score: bayesianWeakness(rightInner),
    });
  }
  // Thumb cluster (space key only in Phase A).
  const space = stats.find((s) => s.character === " ");
  if (space && space.attempts > 0) {
    out.push({
      type: "thumb-cluster",
      value: "space",
      keys: [" "],
      label: "Thumb cluster — space activation",
      score: bayesianWeakness(space),
    });
  }
  return out;
}

/** Same Bayesian iteration for bigrams. Bigrams below
 * `LOW_CORPUS_SUPPORT_THRESHOLD` are excluded — the prior would
 * surface them otherwise, but they're untrainable in adaptive mode. */
function bigramCandidates(
  stats: BigramStat[],
  corpusBigramSupport: ReadonlyMap<string, number> | undefined,
): SessionTarget[] {
  const statByBigram = new Map(stats.map((s) => [s.bigram, s]));
  const universe: string[] = corpusBigramSupport
    ? [...corpusBigramSupport.keys()].filter(
        (bg) => (corpusBigramSupport.get(bg) ?? 0) >= LOW_CORPUS_SUPPORT_THRESHOLD,
      )
    : stats.map((s) => s.bigram);
  return universe.map<SessionTarget>((bigram) => {
    const stat = statByBigram.get(bigram) ?? ZERO_STAT;
    const score = bayesianWeakness(stat);
    return {
      type: "bigram",
      value: bigram,
      keys: bigram.split(""),
      label: `Bigram focus: ${bigram}`,
      score,
    };
  });
}

/**
 * Compute the cooldown-excluded value, or null if no cooldown applies.
 * Rule: if the last `COOLDOWN_RUN_LENGTH - 1` entries in
 * `recentTargets` are all equal to the same value, that value is
 * excluded from this session's ranking.
 */
function computeCooldownExcludedValue(recentTargets: readonly string[] | undefined): string | null {
  if (recentTargets === undefined) return null;
  const runThreshold = COOLDOWN_RUN_LENGTH - 1;
  if (recentTargets.length < runThreshold) return null;
  const head = recentTargets[0];
  if (head === undefined) return null;
  for (let i = 1; i < runThreshold; i++) {
    if (recentTargets[i] !== head) return null;
  }
  return head;
}

/**
 * Bayesian-engine candidate ranking. Every corpus character/bigram is a
 * candidate (scored at prior or posterior). Motion targets (column,
 * thumb-cluster) compute their own scores via `motionPatterns`. Final
 * order: candidate score × journey weight, descending.
 *
 * Three filters apply before scoring:
 *  - Char/bigram corpus exclusion (untrainable targets — separate
 *    concern from Bayesian, kept because the prior would otherwise
 *    rank a non-corpus character at the high prior weakness).
 *  - Cooldown: a value that's won the last N-1 consecutive sessions
 *    is excluded for one cycle.
 *
 * Returns `[]` only if the corpus is missing AND the user has no
 * stats — in normal use the prior guarantees a non-empty ranking.
 */
export function rankTargets(
  stats: ComputedStats,
  baseline: UserBaseline,
  _phase: TransitionPhase,
  _frequencyInLanguage: (unit: string) => number,
  options?: RankTargetsOptions,
): SessionTarget[] {
  const cooldownExcluded = computeCooldownExcludedValue(options?.recentTargets);

  const candidates: SessionTarget[] = [
    ...characterCandidates(stats.characters, options?.corpusCharSupport),
    ...bigramCandidates(stats.bigrams, options?.corpusBigramSupport),
    ...bayesianMotionCandidates(stats.characters),
  ];

  const weights = TARGET_JOURNEY_WEIGHTS[baseline.journey];
  return candidates
    .filter((c) => {
      if (cooldownExcluded !== null && c.value === cooldownExcluded) return false;
      return true;
    })
    .map<SessionTarget>((c) => ({ ...c, score: (c.score ?? 0) * weights[c.type] }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/**
 * Pick this session's target.
 *
 * Order of checks:
 *  1. Periodic diagnostic — every `DIAGNOSTIC_PERIOD` sessions,
 *     short-circuit to a diagnostic regardless of argmax.
 *  2. Bayesian argmax — pick the highest-scoring rankable candidate.
 *  3. Empty-ranking fallback — diagnostic. Only triggers if the
 *     corpus is missing AND the user has zero stats.
 */
export function selectTarget(
  stats: ComputedStats,
  baseline: UserBaseline,
  phase: TransitionPhase,
  frequencyInLanguage: (unit: string) => number,
  options?: RankTargetsOptions,
): SessionTarget {
  const n = options?.upcomingSessionNumber;
  if (n !== undefined && n > 0 && n % DIAGNOSTIC_PERIOD === 0) {
    return diagnosticTarget();
  }
  const ranked = rankTargets(stats, baseline, phase, frequencyInLanguage, options);
  // Cold-start fallback: if the engine has no real signal (no corpus +
  // no stats means motion candidates with score 0 are all that's left),
  // return the diagnostic target instead of arbitrarily picking one.
  // The Bayesian prior produces non-zero scores when a corpus is loaded,
  // so this only fires in the truly-empty case.
  const top = ranked[0];
  if (!top || (top.score ?? 0) === 0) return diagnosticTarget();
  return top;
}
