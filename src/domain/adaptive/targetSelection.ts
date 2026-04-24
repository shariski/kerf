import type {
  BigramStat,
  CharacterStat,
  ComputedStats,
  TransitionPhase,
  UserBaseline,
} from "../stats/types";
import type { JourneyCode } from "./journey";
import { computeWeaknessScore, LOW_CONFIDENCE_THRESHOLD } from "./weaknessScore";
import {
  innerColumnCandidates,
  thumbClusterCandidate,
  verticalColumnCandidates,
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
 * A bigram with fewer than this many corpus words containing it as an
 * adjacent-pair can't produce a varied enough emphasis pool to be
 * worth practicing — the user would see the same 1-2 words every
 * session. At or above the threshold, the bigram is treated as a
 * normal practicable target.
 *
 * Shared with `generateExercise` (content widening): a single boundary
 * keeps decay (ranking) and widening (content) in sync. If decay fires
 * but widening doesn't (or vice versa), the loop degrades.
 *
 * Hand-tuned starting value. Raise if "not-quite-rare" bigrams are
 * leaking decay; lower if too many rare-but-practicable bigrams are
 * being pushed off the ranking.
 */
export const LOW_CORPUS_SUPPORT_THRESHOLD = 3;

/**
 * How much to discount the weighted weakness score of a bigram target
 * whose corpus support is below the threshold. Applied inside
 * `rankTargets` before sorting so un-practicable bigrams naturally
 * lose priority to practicable ones.
 *
 * Stateless: the condition is a property of the corpus, identical for
 * every user and every session. No persistence surface.
 *
 * Hand-tuned starting value — if low-corpus bigrams still dominate in
 * practice, lower this. If practicable alternatives lose priority too
 * aggressively, raise it.
 */
const LOW_CORPUS_BIGRAM_PENALTY = 0.5;

export type RankTargetsOptions = {
  /** Precomputed `bigram → corpus word count` map. When present, bigram
   *  candidates whose value is below `LOW_CORPUS_SUPPORT_THRESHOLD`
   *  (including absent / zero) get their weighted score multiplied by
   *  `LOW_CORPUS_BIGRAM_PENALTY` before sorting. */
  corpusBigramSupport?: ReadonlyMap<string, number>;
};

export function diagnosticTarget(): SessionTarget {
  return {
    type: "diagnostic",
    value: "baseline",
    keys: [],
    label: "Baseline capture",
  };
}

function characterCandidates(
  stats: CharacterStat[],
  baseline: UserBaseline,
  phase: TransitionPhase,
  frequencyInLanguage: (character: string) => number,
): SessionTarget[] {
  return stats
    .filter((s) => s.attempts >= LOW_CONFIDENCE_THRESHOLD)
    .map<SessionTarget>((s) => ({
      type: "character",
      value: s.character,
      keys: [s.character],
      label: `Your weakness: ${s.character.toUpperCase()}`,
      score: computeWeaknessScore(s, baseline, phase, frequencyInLanguage(s.character)),
    }));
}

function bigramCandidates(
  stats: BigramStat[],
  baseline: UserBaseline,
  phase: TransitionPhase,
  frequencyInLanguage: (bigram: string) => number,
): SessionTarget[] {
  return stats
    .filter((s) => s.attempts >= LOW_CONFIDENCE_THRESHOLD)
    .map<SessionTarget>((s) => ({
      type: "bigram",
      value: s.bigram,
      keys: s.bigram.split(""),
      label: `Bigram focus: ${s.bigram}`,
      score: computeWeaknessScore(s, baseline, phase, frequencyInLanguage(s.bigram)),
    }));
}

/**
 * Return every eligible candidate with its journey-weighted score, sorted
 * best-first. Powers both `selectTarget` (takes [0]) and diagnostic logs
 * (shows the top-N reasoning). Returns [] when no candidates pass the
 * confidence threshold — callers should fall back to `diagnosticTarget()`.
 */
export function rankTargets(
  stats: ComputedStats,
  baseline: UserBaseline,
  phase: TransitionPhase,
  frequencyInLanguage: (unit: string) => number,
  options?: RankTargetsOptions,
): SessionTarget[] {
  const hasConfidentData =
    stats.characters.some((s) => s.attempts >= LOW_CONFIDENCE_THRESHOLD) ||
    stats.bigrams.some((s) => s.attempts >= LOW_CONFIDENCE_THRESHOLD);
  if (!hasConfidentData) return [];

  const weights = TARGET_JOURNEY_WEIGHTS[baseline.journey];
  const candidates: SessionTarget[] = [
    ...characterCandidates(stats.characters, baseline, phase, frequencyInLanguage),
    ...bigramCandidates(stats.bigrams, baseline, phase, frequencyInLanguage),
    ...verticalColumnCandidates(stats.characters, baseline).map<SessionTarget>((c) => ({
      type: c.type,
      value: c.value,
      keys: c.keys,
      label: c.label,
      score: c.score,
    })),
    ...innerColumnCandidates(stats.characters, baseline).map<SessionTarget>((c) => ({
      type: c.type,
      value: c.value,
      keys: c.keys,
      label: c.label,
      score: c.score,
    })),
  ];
  const thumb = thumbClusterCandidate(stats.characters, baseline);
  if (thumb) {
    candidates.push({
      type: thumb.type,
      value: thumb.value,
      keys: thumb.keys,
      label: thumb.label,
      score: thumb.score,
    });
  }

  const support = options?.corpusBigramSupport;
  return candidates
    .map<SessionTarget>((c) => {
      const weighted = (c.score ?? 0) * weights[c.type];
      const penalize =
        support !== undefined &&
        c.type === "bigram" &&
        (support.get(c.value) ?? 0) < LOW_CORPUS_SUPPORT_THRESHOLD;
      return { ...c, score: penalize ? weighted * LOW_CORPUS_BIGRAM_PENALTY : weighted };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/**
 * Pick this session's target. Low-confidence → diagnostic. Otherwise
 * returns the (candidate × journey-weight)-argmax over character, bigram,
 * vertical-column, inner-column, and thumb-cluster candidates.
 *
 * Hand-isolation and cross-hand-bigram are drill-mode-only; not selected here.
 */
export function selectTarget(
  stats: ComputedStats,
  baseline: UserBaseline,
  phase: TransitionPhase,
  frequencyInLanguage: (unit: string) => number,
  options?: RankTargetsOptions,
): SessionTarget {
  const ranked = rankTargets(stats, baseline, phase, frequencyInLanguage, options);
  return ranked[0] ?? diagnosticTarget();
}
