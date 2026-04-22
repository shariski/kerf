import type {
  BigramStat,
  CharacterStat,
  TransitionPhase,
  UserBaseline,
} from "../stats/types";
import type { JourneyCode } from "./journey";

/**
 * Weakness scoring per 02-architecture.md §4.1. Two branching axes:
 *
 *   - phase (transitioning | refining) — controls ALPHA/BETA/GAMMA mix.
 *     Errors dominate in transitioning; hesitation/slowness take over in refining.
 *   - journey (conventional | columnar | unsure) — controls which character
 *     classes get a bonus. conventional: vertical-reach (off-home-row) chars.
 *     columnar: inner-column (B/G/T, H/N/Y) chars. unsure: same as conventional.
 *
 * Both bonuses apply only in 'transitioning' phase. In 'refining' the pure
 * weakness profile takes over. ADR-003 §2 & §5.
 */

export const COEFFICIENTS: Record<
  TransitionPhase,
  { ALPHA: number; BETA: number; GAMMA: number; DELTA: number }
> = {
  transitioning: { ALPHA: 0.6, BETA: 0.2, GAMMA: 0.1, DELTA: 0.1 },
  refining: { ALPHA: 0.3, BETA: 0.35, GAMMA: 0.25, DELTA: 0.1 },
};

export const JOURNEY_BONUSES: Record<
  JourneyCode,
  { INNER_COLUMN_BONUS: number; VERTICAL_REACH_BONUS: number }
> = {
  conventional: { INNER_COLUMN_BONUS: 0, VERTICAL_REACH_BONUS: 0.3 },
  columnar: { INNER_COLUMN_BONUS: 0.3, VERTICAL_REACH_BONUS: 0 },
  unsure: { INNER_COLUMN_BONUS: 0, VERTICAL_REACH_BONUS: 0.3 },
};

/** Backward-compat: former single-journey constant. Equals conventional default. */
export const INNER_COLUMN_BONUS = 0.3;

export const INNER_COLUMN: ReadonlySet<string> = new Set([
  "b",
  "g",
  "h",
  "n",
  "t",
  "y",
]);

/**
 * Home-row membership per the base layer (Sofle + Lily58 share home-row keys).
 * Keys off home row (row 1 top, row 3 bottom) are eligible for the
 * VERTICAL_REACH_BONUS under the conventional journey. Thumb cluster (row 4)
 * is not "vertical reach" — thumbs get their own drill category.
 */
const HOME_ROW_KEYS: ReadonlySet<string> = new Set([
  "a", "s", "d", "f", "g",
  "h", "j", "k", "l", ";",
]);

function isOffHomeRow(unit: CharacterStat | BigramStat): boolean {
  if (!isCharacter(unit)) return false;
  const ch = unit.character.toLowerCase();
  if (!/^[a-z]$/.test(ch)) return false; // letters only
  return !HOME_ROW_KEYS.has(ch);
}

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
  const j = JOURNEY_BONUSES[baseline.journey];

  // Journey bonus applies in transitioning phase only, and only to single
  // characters (bigrams are diffuse — they don't belong to one column).
  const journeyBonus =
    phase === "transitioning" && isCharacter(unit)
      ? (INNER_COLUMN.has(unit.character.toLowerCase())
          ? j.INNER_COLUMN_BONUS
          : 0) +
        (isOffHomeRow(unit) ? j.VERTICAL_REACH_BONUS : 0)
      : 0;

  return (
    c.ALPHA * normalizedError +
    c.BETA * normalizedHesitation +
    c.GAMMA * normalizedSlowness -
    c.DELTA * frequencyInLanguage +
    journeyBonus
  );
}

export function isLowConfidence(unit: CharacterStat | BigramStat): boolean {
  return unit.attempts < LOW_CONFIDENCE_THRESHOLD;
}
