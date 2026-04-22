import type {
  BigramStat,
  CharacterStat,
  ComputedStats,
  TransitionPhase,
  UserBaseline,
} from "../stats/types";
import type { JourneyCode } from "./journey";
import {
  computeWeaknessScore,
  LOW_CONFIDENCE_THRESHOLD,
} from "./weaknessScore";
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
export const TARGET_JOURNEY_WEIGHTS: Record<
  JourneyCode,
  Record<TargetType, number>
> = {
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
): SessionTarget {
  const hasConfidentData =
    stats.characters.some((s) => s.attempts >= LOW_CONFIDENCE_THRESHOLD) ||
    stats.bigrams.some((s) => s.attempts >= LOW_CONFIDENCE_THRESHOLD);
  if (!hasConfidentData) return diagnosticTarget();

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

  if (candidates.length === 0) return diagnosticTarget();

  return candidates.reduce((best, c) =>
    (c.score ?? 0) * weights[c.type] > (best.score ?? 0) * weights[best.type] ? c : best,
  );
}
