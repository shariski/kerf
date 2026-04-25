/**
 * Bayesian beta-binomial mastery model — Path 2 ADR-005.
 *
 * This file is the entire scoring philosophy of the Path 2 engine.
 * Replaces `computeWeaknessScore` (which is evidence-based: weakness
 * accumulates from observed error-rate-above-baseline) with a
 * **prior-biased** model: every character/bigram starts at a "presumed
 * weak" prior, and each successful keystroke is evidence that nudges
 * mastery toward 1.0. Score = 1 − mastery.
 *
 * Why the inversion: the frequentist approach has a structural blind
 * spot — letters with no data are invisible to the ranker, so the
 * engine never picks letters the user hasn't typed, so the user never
 * types them, so they stay invisible. Path 1 patched this with several
 * retrofits (prior-weakness floor, rarity weighting, exploration-blend
 * boost, rank exploration). Path 2 makes the prior a first-class
 * citizen of the scoring formula instead.
 *
 * --- Math ---
 *
 * Each unit (character or bigram) has a Beta-distributed mastery
 * belief, parameterized by `(α, β)`:
 *
 *   - α (alpha)     — pseudo-count of successes. Higher α → more
 *                     evidence the user is good at this unit.
 *   - β (beta)      — pseudo-count of failures (errors). Higher β →
 *                     more evidence the user struggles.
 *   - mastery       — α / (α + β). The expected mastery probability
 *                     under the Beta belief.
 *   - weakness      — β / (α + β). What the engine ranks on.
 *
 * Prior parameters (before any data):
 *
 *   α₀ = PRIOR_MASTERY × PRIOR_STRENGTH       = 0.2 × 5 = 1
 *   β₀ = (1 - PRIOR_MASTERY) × PRIOR_STRENGTH = 0.8 × 5 = 4
 *   prior weakness = β₀ / (α₀ + β₀) = 4/5 = 0.8
 *
 * Update with N attempts and K errors:
 *
 *   α' = α₀ + (N - K) = 1 + successes
 *   β' = β₀ + K       = 4 + errors
 *   weakness = β' / (α' + β')
 *
 * --- Calibration table ---
 *
 *   |       Stat            |  α'   |  β'   | weakness |
 *   |-----------------------|-------|-------|----------|
 *   | 0 attempts            |  1    |  4    |  0.800   | unseen letter, presumed weak
 *   | 5 attempts, 0 errors  |  6    |  4    |  0.400   | one good session — big drop
 *   | 5 attempts, 5 errors  |  1    |  9    |  0.900   | one bad session — locks in
 *   | 50 attempts, 5 errors |  46   |  9    |  0.164   | well-practiced, mostly good
 *   | 100 attempts, 20 err  |  81   | 24    |  0.229   | persistent moderate weakness
 *   | 500 attempts, 50 err  | 451   | 54    |  0.107   | mastered with rare slips
 *
 * --- Why these prior values ---
 *
 * The prior plays a single role in Path 2's ranker now:
 * **shrinkage on small-sample measurements.** A letter typed once
 * with no errors gets weakness ≈ 0.667 instead of 0.0; a letter
 * typed once with one error gets ≈ 0.833 instead of 1.0. This
 * keeps fresh measurements from immediately winning or losing on
 * coin-flip noise.
 *
 * Exploration of *unseen* letters is **not** the prior's job —
 * `targetSelection.ts` excludes attempts=0 candidates from the
 * ranker entirely. Coverage of the unseen surface is delegated to
 * `DIAGNOSTIC_PERIOD`. (Earlier iterations of this file enumerated
 * priors as ranker candidates; with ~676 corpus bigrams, the
 * resulting swarm of 0.8-scored unmeasured candidates drowned the
 * argmax. See PR series for ADR-005 if you're tempted to revert.)
 *
 * `PRIOR_MASTERY = 0.2` (i.e. weakness pull toward 0.8) is the
 * shrinkage target — fresh measurements get pulled toward "weak,
 * keep practicing" rather than "perfect, ignore." `PRIOR_STRENGTH
 * = 5` aligns with `LOW_CONFIDENCE_THRESHOLD` from the legacy
 * weakness-score module: at 5 attempts, observed data weight
 * equals prior weight (each contributes 5 to the denominator).
 *
 * --- What this model does NOT include ---
 *
 * - No phase awareness. Phase coefficient could multiply final
 *   weakness, but for a clean comparison vs Path 1 we skip it.
 * - No journey bonus. Journey weights are still applied in
 *   `rankTargets` as a post-hoc multiplier (separable concern).
 * - No language-frequency penalty. Same — could add as a multiplier
 *   if needed.
 * - No hesitation/slowness signals. Pure error-rate model. If timing
 *   data turns out to be load-bearing, extend the formula.
 */

export const PRIOR_MASTERY = 0.2;
export const PRIOR_STRENGTH = 5;

const PRIOR_ALPHA = PRIOR_MASTERY * PRIOR_STRENGTH;
const PRIOR_BETA = (1 - PRIOR_MASTERY) * PRIOR_STRENGTH;

export type MasteryStat = { attempts: number; errors: number };

export function bayesianWeakness(stat: MasteryStat): number {
  // Clamp failures to [0, attempts] so successes can't go negative or
  // exceed attempts even when callers pass malformed stats.
  const attempts = Math.max(0, stat.attempts);
  const failures = Math.max(0, Math.min(stat.errors, attempts));
  const successes = attempts - failures;
  const alpha = PRIOR_ALPHA + successes;
  const beta = PRIOR_BETA + failures;
  return beta / (alpha + beta);
}

/** Convenience — the prior weakness for a unit with no data. */
export const PRIOR_WEAKNESS = bayesianWeakness({ attempts: 0, errors: 0 });
