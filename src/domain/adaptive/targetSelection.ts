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
  /** Precomputed `char → corpus word count` map. Used as a corpus-
   *  membership filter on measured character stats — drops chars
   *  with support 0 (drill-key cross-layer leak guard, e.g. `;`
   *  from drill mode that's not part of the alpha corpus). When
   *  omitted, all measured chars are eligible. The map is no
   *  longer used to enumerate unmeasured candidates — those are
   *  explored via `DIAGNOSTIC_PERIOD` instead. */
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

/**
 * Build the character candidate list for the Bayesian engine.
 *
 * Only **measured** characters (`attempts > 0`) become candidates.
 * Unmeasured corpus characters are deliberately excluded: enumerating
 * them at the prior (~0.8) caused the swarm-effect bug where every
 * top-N slot was a different unmeasured letter, drowning out the
 * user's real weaknesses. Coverage of unmeasured letters is now the
 * sole responsibility of `DIAGNOSTIC_PERIOD`.
 *
 * The `corpusCharSupport` map, when provided, acts as a membership
 * filter — measured chars whose support is 0 (e.g. `;` from drill
 * mode that's not in the alpha corpus) are dropped to avoid
 * cross-layer leak.
 */
function characterCandidates(
  stats: CharacterStat[],
  corpusCharSupport: ReadonlyMap<string, number> | undefined,
): SessionTarget[] {
  return stats
    .filter((s) => s.attempts > 0)
    .filter((s) => corpusCharSupport === undefined || (corpusCharSupport.get(s.character) ?? 0) > 0)
    .map<SessionTarget>((stat) => {
      const score = bayesianWeakness(stat);
      return {
        type: "character",
        value: stat.character,
        keys: [stat.character],
        label:
          stat.attempts >= 5
            ? `Your weakness: ${stat.character.toUpperCase()}`
            : `Building familiarity: ${stat.character.toUpperCase()}`,
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

/**
 * Same measured-only Bayesian rule as `characterCandidates`. Bigrams
 * below `LOW_CORPUS_SUPPORT_THRESHOLD` are also excluded — even if
 * the user has typed them, they're untrainable by the word-picker
 * (would produce a stuck loop).
 */
function bigramCandidates(
  stats: BigramStat[],
  corpusBigramSupport: ReadonlyMap<string, number> | undefined,
): SessionTarget[] {
  return stats
    .filter((s) => s.attempts > 0)
    .filter((s) => {
      if (corpusBigramSupport === undefined) return true;
      return (corpusBigramSupport.get(s.bigram) ?? 0) >= LOW_CORPUS_SUPPORT_THRESHOLD;
    })
    .map<SessionTarget>((stat) => {
      const score = bayesianWeakness(stat);
      return {
        type: "bigram",
        value: stat.bigram,
        keys: stat.bigram.split(""),
        label: `Bigram focus: ${stat.bigram}`,
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
 * Bayesian-engine candidate ranking. Only **measured** characters,
 * bigrams, and motion-aggregates participate (`attempts > 0`).
 * Unmeasured units are deliberately excluded from the ranker —
 * exploration of the unseen surface is handled by the periodic
 * diagnostic, not by enumerating priors. Final order: candidate
 * score × journey weight, descending.
 *
 * Filters applied before scoring:
 *  - Char/bigram corpus exclusion (untrainable targets — kept
 *    because a measured `;` from drill mode shouldn't surface in
 *    the alpha-corpus ranker).
 *  - Cooldown: a value that's won the last N-1 consecutive
 *    sessions is excluded for one cycle.
 *
 * Returns `[]` whenever the user has no measured stats. The caller
 * (`selectTarget`) handles this by falling back to a diagnostic.
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
 *  2. Bayesian argmax — pick the highest-scoring measured candidate.
 *  3. Empty-ranking fallback — diagnostic. Triggers whenever the
 *     user has no measured stats yet (true cold start, or every
 *     measured candidate is currently in cooldown). The diagnostic
 *     is also Path 2's only mechanism for surfacing letters the
 *     user has never typed, so this fallback is structurally
 *     important — not just an edge-case guard.
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
  // Empty-ranker fallback: with measured-only ranking, this fires
  // whenever the user has no stats yet. Returning a diagnostic both
  // captures the baseline and seeds the next session's ranking.
  const top = ranked[0];
  if (!top || (top.score ?? 0) === 0) return diagnosticTarget();
  return top;
}
