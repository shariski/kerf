import type {
  BigramStat,
  CharacterStat,
  TransitionPhase,
  UserBaseline,
} from "../stats/types";

/**
 * Weakness scoring per 02-architecture.md §4.1. Phase-aware coefficients
 * shift weight from errors (transitioning — "can't find the key") to
 * hesitation and slowness (refining — "know it, not fluent yet").
 *
 * Two design choices the doc leaves implicit:
 *
 * 1. The doc snippet's `unit.character?.toLowerCase()` returns undefined
 *    for bigrams (which carry `bigram`, not `character`), so the
 *    inner-column transition bonus naturally applies only to single
 *    characters. We preserve that behavior — bigrams never get the bonus.
 *
 * 2. The doc references `unit.frequencyInLanguage`, but stat records
 *    don't carry corpus frequency. The caller (typically the exercise
 *    generator with the corpus loaded) supplies it as a separate arg.
 */

const COEFFICIENTS: Record<
  TransitionPhase,
  { ALPHA: number; BETA: number; GAMMA: number; DELTA: number }
> = {
  transitioning: { ALPHA: 0.6, BETA: 0.2, GAMMA: 0.1, DELTA: 0.1 },
  refining: { ALPHA: 0.3, BETA: 0.35, GAMMA: 0.25, DELTA: 0.1 },
};

const INNER_COLUMN: ReadonlySet<string> = new Set([
  "b",
  "g",
  "h",
  "n",
  "t",
  "y",
]);

export const INNER_COLUMN_BONUS = 0.3;

/** Per 02-architecture.md §4.1 edge cases: units with fewer than this
 * many attempts are low-confidence and should be excluded from ranking
 * by callers (the score function itself still produces a value). */
export const LOW_CONFIDENCE_THRESHOLD = 5;

const isCharacter = (
  unit: CharacterStat | BigramStat,
): unit is CharacterStat => "character" in unit;

const safeRatio = (n: number, d: number): number => (d > 0 ? n / d : 0);

export function computeWeaknessScore(
  unit: CharacterStat | BigramStat,
  baseline: UserBaseline,
  phase: TransitionPhase,
  frequencyInLanguage: number,
): number {
  const denomAttempts = Math.max(unit.attempts, 1);
  const errorRate = unit.errors / denomAttempts;
  const meanTime = unit.sumTime / denomAttempts;
  const hesitationRate = isCharacter(unit)
    ? unit.hesitationCount / denomAttempts
    : 0;

  const normalizedError = safeRatio(errorRate, baseline.meanErrorRate);
  const normalizedSlowness = safeRatio(meanTime, baseline.meanKeystrokeTime);
  const normalizedHesitation = safeRatio(
    hesitationRate,
    baseline.meanHesitationRate,
  );

  const c = COEFFICIENTS[phase];

  const transitionBonus =
    phase === "transitioning" &&
    isCharacter(unit) &&
    INNER_COLUMN.has(unit.character.toLowerCase())
      ? INNER_COLUMN_BONUS
      : 0;

  return (
    c.ALPHA * normalizedError +
    c.BETA * normalizedHesitation +
    c.GAMMA * normalizedSlowness -
    c.DELTA * frequencyInLanguage +
    transitionBonus
  );
}

export function isLowConfidence(unit: CharacterStat | BigramStat): boolean {
  return unit.attempts < LOW_CONFIDENCE_THRESHOLD;
}
