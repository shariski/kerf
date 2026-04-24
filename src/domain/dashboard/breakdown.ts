import {
  COEFFICIENTS,
  INNER_COLUMN,
  INNER_COLUMN_BONUS,
  confidenceWeight,
} from "#/domain/adaptive/weaknessScore";
import type {
  BigramStat,
  CharacterStat,
  TransitionPhase,
  UserBaseline,
} from "#/domain/stats/types";

/**
 * Live breakdown of the weakness score formula for the dashboard's
 * transparency panel (Task 3.3). Reuses the same formula
 * `computeWeaknessScore` (src/domain/adaptive/weaknessScore.ts) uses,
 * but preserves the intermediate values — raw metric, baseline, the
 * normalized ratio, and the coefficient-weighted contribution — so the
 * UI can render "your value vs. baseline" rows next to the formula.
 *
 * Kept separate from `computeWeaknessRanking` on purpose: the ranking
 * path wants a single comparable scalar per unit; the transparency
 * path wants every intermediate number. Collapsing both into one
 * function would force every caller to pay for computing the
 * breakdown even when they only need the rank.
 */

export type ComponentBreakdown = {
  /** Raw metric value. For rates, a 0..1 fraction; for slowness, ms. */
  raw: number;
  /** Baseline the raw value is normalized against. */
  baseline: number;
  /** `raw / baseline` — how many times above (or below) baseline. */
  normalized: number;
  /** Phase coefficient this component carries in the formula. */
  coefficient: number;
  /** `coefficient * normalized` — the signed contribution to total. */
  contribution: number;
};

/**
 * Frequency contributes a raw corpus-frequency number (0..1-ish) that
 * is subtracted from score, so it doesn't have the "baseline" /
 * "normalized" shape of the other components. Surfaced separately to
 * avoid pretending it fits the same column layout.
 */
export type FrequencyBreakdown = {
  raw: number;
  coefficient: number;
  /** Always negative-or-zero contribution: `-coefficient * raw`. */
  contribution: number;
};

export type WeaknessBreakdown = {
  /** The unit being broken down — e.g. "b" or "er". Lowercase. */
  unit: string;
  /** True for single-character units. Bigrams have no hesitation
   * tracking in the schema, so `hesitation` is null for them. */
  isCharacter: boolean;
  /** Phase the breakdown was computed under — drives which coefficient
   * column is active and whether the inner-column bonus fires. */
  phase: TransitionPhase;
  /** Coefficients in effect for this phase. Surfaced so the UI can
   * render the formula with live numbers. */
  coefficients: (typeof COEFFICIENTS)[TransitionPhase];
  errorRate: ComponentBreakdown;
  /** null for bigrams (no hesitation count in BigramStat). */
  hesitation: ComponentBreakdown | null;
  slowness: ComponentBreakdown;
  frequency: FrequencyBreakdown;
  /** Inner-column transition bonus (0 when phase is refining or the
   * unit is not an inner-column char). */
  innerColumnBonus: number;
  /** Evidence-weight multiplier applied to the error/hesitation/
   *  slowness contributions — `attempts / (attempts + K)`. Surfaced so
   *  the UI can explain why a low-sample unit's contributions are
   *  smaller than the raw formula would suggest. Not applied to
   *  frequency or innerColumnBonus (structural priors). */
  confidenceWeight: number;
  /** Total — sum of component contributions plus bonus. Matches what
   * `computeWeaknessScore` would return for the same inputs. */
  total: number;
  /** Surfaced so the panel can show "n attempts observed" next to the
   * raw values (gives the user a sense of how trustworthy the numbers
   * are). */
  attempts: number;
};

const safeRatio = (n: number, d: number): number => (d > 0 ? n / d : 0);

const isCharacter = (unit: CharacterStat | BigramStat): unit is CharacterStat =>
  "character" in unit;

/**
 * Compute a full, value-preserving breakdown of the weakness score for
 * a single unit. The `total` returned here equals
 * `computeWeaknessScore(unit, baseline, phase, frequencyInLanguage)`
 * up to floating-point ordering — both functions apply the same
 * formula.
 *
 * Pass `frequencyInLanguage = 0` in the dashboard read path (corpus
 * isn't loaded server-side). The panel simply shows a zero
 * contribution for that row, which is honest: the engine does drop
 * that term when computing the ranking you're looking at.
 */
export function computeWeaknessBreakdown(
  unit: CharacterStat | BigramStat,
  baseline: UserBaseline,
  phase: TransitionPhase,
  frequencyInLanguage: number,
): WeaknessBreakdown {
  const denomAttempts = Math.max(unit.attempts, 1);

  const errorRateRaw = unit.errors / denomAttempts;
  const meanTimeRaw = unit.sumTime / denomAttempts;
  const unitIsChar = isCharacter(unit);
  const hesitationRaw = unitIsChar ? unit.hesitationCount / denomAttempts : 0;

  const c = COEFFICIENTS[phase];
  const w = confidenceWeight(unit.attempts);

  const errorRate: ComponentBreakdown = {
    raw: errorRateRaw,
    baseline: baseline.meanErrorRate,
    normalized: safeRatio(errorRateRaw, baseline.meanErrorRate),
    coefficient: c.ALPHA,
    // Contribution is evidence-weighted — raw rate stays visible above
    // for honest UX, but the contribution the engine actually adds to
    // the score is attenuated for low-sample units.
    contribution: w * c.ALPHA * safeRatio(errorRateRaw, baseline.meanErrorRate),
  };

  const hesitation: ComponentBreakdown | null = unitIsChar
    ? {
        raw: hesitationRaw,
        baseline: baseline.meanHesitationRate,
        normalized: safeRatio(hesitationRaw, baseline.meanHesitationRate),
        coefficient: c.BETA,
        contribution: w * c.BETA * safeRatio(hesitationRaw, baseline.meanHesitationRate),
      }
    : null;

  const slowness: ComponentBreakdown = {
    raw: meanTimeRaw,
    baseline: baseline.meanKeystrokeTime,
    normalized: safeRatio(meanTimeRaw, baseline.meanKeystrokeTime),
    coefficient: c.GAMMA,
    contribution: w * c.GAMMA * safeRatio(meanTimeRaw, baseline.meanKeystrokeTime),
  };

  const frequency: FrequencyBreakdown = {
    raw: frequencyInLanguage,
    coefficient: c.DELTA,
    contribution: -c.DELTA * frequencyInLanguage,
  };

  const innerColumnBonus =
    phase === "transitioning" && unitIsChar && INNER_COLUMN.has(unit.character.toLowerCase())
      ? INNER_COLUMN_BONUS
      : 0;

  const total =
    errorRate.contribution +
    (hesitation?.contribution ?? 0) +
    slowness.contribution +
    frequency.contribution +
    innerColumnBonus;

  return {
    unit: unitIsChar ? unit.character.toLowerCase() : unit.bigram.toLowerCase(),
    isCharacter: unitIsChar,
    phase,
    coefficients: c,
    errorRate,
    hesitation,
    slowness,
    frequency,
    innerColumnBonus,
    confidenceWeight: w,
    total,
    attempts: unit.attempts,
  };
}
