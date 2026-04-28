import type {
  BigramStat,
  CharacterStat,
  ComputedStats,
  TransitionPhase,
  UserBaseline,
} from "../stats/types";
import type { JourneyCode } from "./journey";
import { mulberry32 } from "./rng";
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
 * Weights per ADR-003 §5 (transitioning) and ADR-005 (refining). Phase-keyed
 * because the two phases have categorically different goals:
 *
 * **Transitioning** — the user is still building split-specific motor patterns.
 * Column and thumb-cluster motions get boosted (1.3-1.8) so split-specific
 * targets surface often enough in adaptive selection to justify owning the
 * keyboard. Character/bigram weaknesses still compete; they just have to be
 * noticeably worse to win. Bigrams penalized to 0.8 because diffuse two-key
 * targets are less actionable than concrete single-key or motion targets
 * during the motor-pattern-building phase.
 *
 * **Refining** — the user has the motor patterns; what's left is per-letter
 * and per-bigram polish. All weights collapse to 1.0 so target type is no
 * longer biased — the strongest weakness wins on its own merits. Per ADR-005,
 * keeping column boosts in refining created a structural rotation trap:
 * common-letter weaknesses (t/i/o) got eaten by their containing columns
 * (inner-left, right-middle, right-ring) because the column's 1.5× weight
 * outranked the character's 1.0×, so the letter never surfaced as its own
 * target and the column's aggregate score couldn't drop until the letter
 * mastered through column-mode practice — a slow, indirect loop that the
 * user perceived as "the same 5 targets on rotation." Equal weights in
 * refining let characters and bigrams compete on equal footing with the
 * columns containing them, so practice surfaces match where the user
 * actually needs it.
 *
 * Hand-tuned. Revisit with beta feedback.
 */
export const TARGET_JOURNEY_WEIGHTS: Record<
  TransitionPhase,
  Record<JourneyCode, Record<TargetType, number>>
> = {
  transitioning: {
    conventional: {
      character: 1.0,
      bigram: 0.8,
      "vertical-column": 1.3,
      "inner-column": 1.5,
      "thumb-cluster": 1.8,
      "hand-isolation": 1.0,
      "cross-hand-bigram": 1.0,
      diagnostic: 0,
    },
    columnar: {
      character: 1.0,
      bigram: 0.8,
      "vertical-column": 1.3,
      "inner-column": 1.8,
      "thumb-cluster": 1.5,
      "hand-isolation": 1.0,
      "cross-hand-bigram": 1.0,
      diagnostic: 0,
    },
    unsure: {
      character: 1.0,
      bigram: 0.8,
      "vertical-column": 1.3,
      "inner-column": 1.5,
      "thumb-cluster": 1.8,
      "hand-isolation": 1.0,
      "cross-hand-bigram": 1.0,
      diagnostic: 0,
    },
  },
  refining: {
    conventional: {
      character: 1.0,
      bigram: 1.0,
      "vertical-column": 1.0,
      "inner-column": 1.0,
      "thumb-cluster": 1.0,
      "hand-isolation": 1.0,
      "cross-hand-bigram": 1.0,
      diagnostic: 0,
    },
    columnar: {
      character: 1.0,
      bigram: 1.0,
      "vertical-column": 1.0,
      "inner-column": 1.0,
      "thumb-cluster": 1.0,
      "hand-isolation": 1.0,
      "cross-hand-bigram": 1.0,
      diagnostic: 0,
    },
    unsure: {
      character: 1.0,
      bigram: 1.0,
      "vertical-column": 1.0,
      "inner-column": 1.0,
      "thumb-cluster": 1.0,
      "hand-isolation": 1.0,
      "cross-hand-bigram": 1.0,
      diagnostic: 0,
    },
  },
};

/**
 * Base synthetic weakness score for corpus characters that don't
 * have enough confident attempts to compute a real weakness score
 * (i.e. fewer than `LOW_CONFIDENCE_THRESHOLD` attempts). Inverts the
 * default frequentist assumption "no data → not rankable" to the
 * Bayesian "no data → presume weak until proven otherwise."
 *
 * The actual injected score is `UNSEEN_CHARACTER_WEAKNESS_FLOOR ×
 * rarityFactor(char, corpusCharSupport)` — the floor is multiplied
 * by the same rarity weighting used in recency decay, so rare
 * unseen letters get a much higher prior than common ones. Without
 * the rarity factor, a uniform 0.5 prior is consistently outranked
 * by journey-weighted column candidates (1.3-1.8× boost) once a
 * single session of data exists, and the prior model becomes
 * effectively dead after session 1.
 *
 * Calibration with `RARE_MASTERY_BOOST = 3.0`:
 *   - `q` (support ~50, rarity ≈ 3): prior ≈ 0.5 × 3 = 1.5 — wins
 *     against typical column candidates around 0.9.
 *   - `g` (support ~1500, rarity ≈ 2.5): prior ≈ 1.25 — competitive.
 *   - `e` (support ~6500, rarity ≈ 1): prior ≈ 0.5 — low, but `e`
 *     graduates to measured fast anyway, so this doesn't matter.
 *
 * Once a letter accumulates `LOW_CONFIDENCE_THRESHOLD` attempts, the
 * computed weakness score takes over and the prior no longer
 * applies — so practice naturally moves a letter from "presumed
 * weak" to "measured" and the score reflects reality. For a fresh
 * account, expect the first 5-10 sessions to be dominated by rare-
 * letter targets as their priors clear; afterward the engine
 * settles into normal measured-weakness mode.
 *
 * Hand-tuned. Raise toward 1.0 for more aggressive surfacing of
 * unseen letters; lower toward 0.2 if real weaknesses are getting
 * crowded out by unmeasured ones.
 */
export const UNSEEN_CHARACTER_WEAKNESS_FLOOR = 0.5;

/**
 * Threshold below which a bigram's corpus support is considered "low."
 * A bigram with fewer than this many corpus words containing it as an
 * adjacent-pair can't produce a varied enough emphasis pool to be
 * worth practicing — the user would see the same 1-2 words every
 * session. At or above the threshold, the bigram is treated as a
 * normal practicable target.
 *
 * Shared with `generateExercise` (content widening): a single boundary
 * keeps adaptive-mode exclusion (ranking) and drill-mode widening
 * (content) in sync. Exclusion fires at < threshold so the adaptive
 * loop never picks these; widening fires at the same < threshold so
 * drill mode still has a content-substitution fallback when the user
 * explicitly picks a rare bigram.
 *
 * Hand-tuned starting value. Raise if "not-quite-rare" bigrams are
 * still creating stuck-loop symptoms; lower if practicable-but-low-
 * support bigrams are being excluded too aggressively.
 */
export const LOW_CORPUS_SUPPORT_THRESHOLD = 3;

export type RankTargetsOptions = {
  /** Precomputed `bigram → corpus word count` map. When present, bigram
   *  candidates whose support is below `LOW_CORPUS_SUPPORT_THRESHOLD`
   *  (including absent / zero) are **excluded** from ranking — not just
   *  down-ranked. Rationale: a low-support bigram can't produce enough
   *  real adjacent-pair occurrences in a session to move its own stat,
   *  so picking it as an adaptive target creates a stuck-loop failure
   *  mode. The widening fallback in `generateExercise` is still
   *  available for drill mode, where the user has explicitly chosen a
   *  rare bigram and accepts the "component-char practice" substitute. */
  corpusBigramSupport?: ReadonlyMap<string, number>;
  /** Precomputed `char → corpus word count` map. Two roles:
   *  1. Chars with support === 0 are **excluded** from ranking (cross-
   *     layer-leak guard against drill keys like `;`/`/`).
   *  2. Chars with support > 0 that the user hasn't yet practiced
   *     (attempts < `LOW_CONFIDENCE_THRESHOLD`) are **injected** with a
   *     synthetic `UNSEEN_CHARACTER_WEAKNESS_FLOOR` score, so unseen
   *     letters surface as targets instead of being invisible to the
   *     ranker — Path 1 prior-weakness model. Once a letter clears
   *     the confidence threshold the measured score takes over. */
  corpusCharSupport?: ReadonlyMap<string, number>;
  /** 1-indexed number of the session about to be generated. When set
   *  and divisible by `DIAGNOSTIC_PERIOD`, `selectTarget` short-circuits
   *  to `diagnosticTarget()` — a periodic re-baseline that surfaces
   *  coverage for letters that the argmax loop has left behind.
   *  Paired with the exercise-generator exploration blend; this is the
   *  "safety net every N sessions" half of that mechanism.
   *  When omitted, no periodic diagnostic fires (existing behavior). */
  upcomingSessionNumber?: number;
  /** Target values from the most recent sessions, newest first. When
   *  the last `COOLDOWN_RUN_LENGTH - 1` entries are all equal, that
   *  value is excluded from ranking this session — prevents a single
   *  target from winning more than `COOLDOWN_RUN_LENGTH` sessions in
   *  a row, forcing rotation even when the raw weakness score would
   *  keep it on top. Omitting disables the cooldown. */
  recentTargets?: readonly string[];
};

/**
 * Maximum consecutive sessions a single target can win. On the next
 * session after hitting this cap the target is filtered out of
 * ranking and the second-best candidate is selected, breaking what
 * would otherwise be an unbounded "stuck on `tc`" feeling even when
 * the weakness score is genuinely the highest. The target remains
 * eligible on subsequent sessions once it's no longer in the recent
 * run — so if it's still the weakness, it returns in a 2-on / 1-off
 * rhythm. Hand-tuned; revisit with beta feedback.
 */
export const COOLDOWN_RUN_LENGTH = 3;

/**
 * Per-appearance score multiplier applied in `rankTargets` for
 * recently-practiced targets — the "soft cooldown" that sits below
 * the hard `COOLDOWN_RUN_LENGTH` cap. For each time a candidate's
 * value appears in the last `RECENCY_WINDOW` sessions, its weighted
 * weakness score is multiplied by `RECENCY_DECAY`, so the target
 * naturally drops in ranking as it accumulates practice — even if
 * the underlying stats haven't had time to reflect improvement yet.
 *
 * Addresses the gap where a new session's ~30 events don't visibly
 * move a stat aggregated over hundreds of historical events, leaving
 * the user feeling their practice wasn't acknowledged. With decay
 * = 0.7, one recent practice session applies a ×0.7 multiplier;
 * two applies ×0.49; three ×0.34. A genuinely-dominant weakness
 * that's 2× any competitor's raw score will return after one
 * practice cycle (0.7×2 = 1.4 > 1); one that's barely ahead will
 * drop and let a runner-up take its turn.
 *
 * 0.7 was chosen as a balance: aggressive enough to visibly rotate
 * practice (otherwise the whole mechanism is invisible), gentle
 * enough that real long-lived weaknesses still return after a
 * break. Raise toward 1.0 for less rotation, lower for more.
 */
export const RECENCY_DECAY = 0.7;

/**
 * Number of recent sessions considered for the recency decay. Five
 * is a principled middle: long enough that repeated practice on a
 * target can compound into a ×0.16 decay (0.7^5), short enough that
 * a target you dropped a week ago doesn't still feel "recent." Also
 * caps the query limit in the practice-route loader.
 *
 * The cooldown rule (above) only looks at the first
 * `COOLDOWN_RUN_LENGTH - 1` entries; recency decay reads the full
 * window. So a loader query with `limit: RECENCY_WINDOW` serves
 * both mechanisms — no need for two separate queries.
 */
export const RECENCY_WINDOW = 5;

/**
 * Multiplier on the recency-decay exponent for the rarest character
 * or bigram in the corpus. Equivalent intuition: each correct
 * practice on a low-occurrence letter is worth this many times the
 * "mastery credit" of a high-occurrence letter, so rare letters
 * cycle out of argmax in roughly `1 / RARE_MASTERY_BOOST` as many
 * sessions. Compensates for the unbalanced opportunity baked into
 * any English corpus (`e` shows up in 50%+ of words; `q` in <1%) —
 * without this, rare letters can win argmax indefinitely because
 * they can't accumulate enough recency hits to fall below
 * competing measured weaknesses.
 *
 * Calibration at 3.0:
 *   - `e` (most-common, normalized support = 1): factor = 1.0; decay
 *     per practice = `RECENCY_DECAY` (unchanged from non-weighted).
 *   - `g` (mid-frequency, normalized ≈ 0.23): factor ≈ 2.5; decay
 *     per practice = `0.7^2.5` ≈ 0.41 (≈40% steeper).
 *   - `q` (rare, normalized ≈ 0.008): factor ≈ 2.98; decay per
 *     practice = `0.7^3` ≈ 0.34 (≈50% steeper).
 *
 * Hand-tuned. Raise toward 5.0 if rare letters still feel sticky;
 * lower toward 2.0 if the engine starts feeling like it abandons
 * rare letters before you've actually nailed them. Motion targets
 * (column / thumb-cluster) bypass this — they have no corpus-
 * frequency analog and stay at factor 1.
 */
export const RARE_MASTERY_BOOST = 3.0;

/**
 * Every Nth session returns a diagnostic target instead of argmax,
 * forcing a broad-coverage session that re-measures the full key/bigram
 * space. Pure argmax selection narrows scope over time (practice words
 * only contain letters already ranked; unranked letters stay invisible);
 * the periodic diagnostic breaks that feedback loop.
 *
 * 10 was chosen to balance "ceremony tax" (~10% of sessions feel like
 * baseline captures instead of targeted practice) against "refresh
 * latency" (how long a stuck-in-scope user waits before the engine
 * re-discovers rare letters). Revisit with beta feedback.
 */
export const DIAGNOSTIC_PERIOD = 10;

/**
 * Every Nth session (that isn't already a diagnostic) picks a
 * non-argmax target rank from the weakness ranking. Cooldown handles
 * "don't repeat the same value 3× in a row," but ranks 3+ in the
 * weakness distribution can still go untouched indefinitely when
 * ranks 0-1 trade off under cooldown. Rank exploration reaches into
 * the tail — session count modulo this period, seeded geometric draw
 * over ranked positions, biased toward rank 1 but capable of
 * surfacing rank 5+ occasionally.
 *
 * 3 gives ~30% of sessions exploration. Close to the user-requested
 * 70/30 argmax/exploration split. Raise to 4 or 5 for less variety,
 * lower to 2 for more aggressive tail-mining. When both this and
 * `DIAGNOSTIC_PERIOD` match (every 30th session at the current
 * values), diagnostic wins — its check runs first.
 */
export const RANK_EXPLORATION_PERIOD = 4;

/**
 * Seeded geometric draw of a non-argmax rank. Returns a value in
 * [1, rankedLength - 1], weighted toward 1 (≈50% chance), 2 (≈25%),
 * 3 (≈12.5%), etc. Deterministic per seed so the engine picks the
 * same rank every time for a given session number — stable across
 * re-renders and route invalidations. Must only be called when
 * `rankedLength >= 2` (caller's responsibility; a one-item list
 * has no non-argmax to return).
 */
function pickExplorationRank(seed: number, rankedLength: number): number {
  const rng = mulberry32(seed);
  let rank = 1;
  while (rank < rankedLength - 1 && rng() > 0.5) rank++;
  return rank;
}

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
  corpusCharSupport: ReadonlyMap<string, number> | undefined,
): SessionTarget[] {
  const measured = stats
    .filter((s) => s.attempts >= LOW_CONFIDENCE_THRESHOLD)
    .map<SessionTarget>((s) => ({
      type: "character",
      value: s.character,
      keys: [s.character],
      label: `Your weakness: ${s.character.toUpperCase()}`,
      score: computeWeaknessScore(s, baseline, phase, frequencyInLanguage(s.character)),
    }));

  if (corpusCharSupport === undefined) return measured;

  // Prior-weakness candidates (Path 1 — see UNSEEN_CHARACTER_WEAKNESS_FLOOR).
  // Any corpus-practicable letter the user hasn't measured yet enters the
  // ranking with a synthetic score, so unseen letters surface as targets
  // instead of staying invisible. As soon as a letter clears the
  // confidence threshold, the `measured` branch takes over and the prior
  // is no longer applied to it.
  const measuredChars = new Set(
    stats.filter((s) => s.attempts >= LOW_CONFIDENCE_THRESHOLD).map((s) => s.character),
  );
  const priors: SessionTarget[] = [];
  for (const [char, support] of corpusCharSupport) {
    if (support === 0) continue; // can't be practiced; would be excluded by char-support filter anyway
    if (measuredChars.has(char)) continue; // measured beats prior
    // Rarity-weighted prior — same shape as the recency-decay rarity
    // weighting. A uniform 0.5 prior loses to journey-weighted column
    // candidates after even one session of data, so rare unseen letters
    // never surface; multiplying by `rarityFactor` lifts their prior to
    // ~1.5 (for the rarest), which beats typical column scores and
    // gives them a real chance to argmax until they accumulate
    // measurement attempts. Common unseen letters (factor ≈ 1) stay
    // near the base 0.5 — they don't sit in priors long anyway.
    const rarity = rarityFactor("character", char, corpusCharSupport, undefined);
    priors.push({
      type: "character",
      value: char,
      keys: [char],
      label: `Building familiarity: ${char.toUpperCase()}`,
      score: UNSEEN_CHARACTER_WEAKNESS_FLOOR * rarity,
    });
  }
  return [...measured, ...priors];
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
  const charSupport = options?.corpusCharSupport;
  const hasConfidentData =
    stats.characters.some((s) => s.attempts >= LOW_CONFIDENCE_THRESHOLD) ||
    stats.bigrams.some((s) => s.attempts >= LOW_CONFIDENCE_THRESHOLD);
  // Prior-weakness candidates extend the "rankable population" even when
  // measured data is empty — they're the cold-start fix that lets unseen
  // letters surface as targets. Only kick in when the caller provides a
  // corpus support map (opt-in).
  const hasPriorCandidates = charSupport !== undefined && charSupport.size > 0;
  if (!hasConfidentData && !hasPriorCandidates) return [];

  const weights = TARGET_JOURNEY_WEIGHTS[phase][baseline.journey];
  const candidates: SessionTarget[] = [
    ...characterCandidates(stats.characters, baseline, phase, frequencyInLanguage, charSupport),
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

  const bigramSupport = options?.corpusBigramSupport;
  const cooldownExcluded = computeCooldownExcludedValue(options?.recentTargets);
  const recentWindow = options?.recentTargets?.slice(0, RECENCY_WINDOW);

  return candidates
    .filter((c) => {
      // Bigram exclusion: support < threshold → untrainable in adaptive
      // mode (can't generate enough real adjacent-pair occurrences per
      // session to move the stat). Stuck-loop guard; see `zs` failure.
      if (c.type === "bigram" && bigramSupport !== undefined) {
        if ((bigramSupport.get(c.value) ?? 0) < LOW_CORPUS_SUPPORT_THRESHOLD) {
          return false;
        }
      }
      // Character exclusion: support === 0 → the word-picker can't
      // produce any practice text for this char. Guards against the
      // cross-layer leak where drill mode logs keystrokes on keys
      // (`;`, `/`) that aren't in the corpus.
      if (c.type === "character" && charSupport !== undefined) {
        if ((charSupport.get(c.value) ?? 0) === 0) {
          return false;
        }
      }
      // Cooldown: if this candidate's value just won `COOLDOWN_RUN_LENGTH
      // - 1` sessions in a row, skip it so a different target gets a
      // turn. The target remains eligible on subsequent sessions.
      if (cooldownExcluded !== null && c.value === cooldownExcluded) {
        return false;
      }
      return true;
    })
    .map<SessionTarget>((c) => {
      const weighted = (c.score ?? 0) * weights[c.type];
      // Soft cooldown — score compounds down by `RECENCY_DECAY` per
      // appearance in the last `RECENCY_WINDOW` sessions, so a target
      // that keeps winning gradually falls behind even when the raw
      // weakness signal hasn't caught up to the user's practice yet.
      // Independent of the hard cooldown above (which excludes); this
      // adjusts the score for the non-excluded remainder. The exponent
      // is scaled by a per-target rarity factor (motion targets stay
      // at 1.0; characters and bigrams scale up to RARE_MASTERY_BOOST
      // for the rarest entries in their respective corpus support
      // maps), so each rare-letter practice "counts more" toward
      // dropping the target out of contention.
      const recentCount = recentWindow?.filter((t) => t === c.value).length ?? 0;
      const factor = rarityFactor(c.type, c.value, charSupport, bigramSupport);
      const decayed = weighted * RECENCY_DECAY ** (recentCount * factor);
      return { ...c, score: decayed };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/**
 * Per-candidate scaler for the recency-decay exponent. Returns 1.0
 * for the most-common unit in the relevant support map (so its decay
 * matches the unweighted base) and `RARE_MASTERY_BOOST` for a unit
 * with support 0 (extreme rarity). Linearly interpolated in between.
 *
 * Motion targets (column / thumb-cluster) and any candidate whose
 * support map isn't provided fall back to factor 1 — they have no
 * corpus-frequency analog and use the unweighted decay.
 */
function rarityFactor(
  type: TargetType,
  value: string,
  charSupport: ReadonlyMap<string, number> | undefined,
  bigramSupport: ReadonlyMap<string, number> | undefined,
): number {
  const support =
    type === "character" ? charSupport : type === "bigram" ? bigramSupport : undefined;
  if (support === undefined || support.size === 0) return 1;
  const myCount = support.get(value) ?? 0;
  let maxCount = 0;
  for (const v of support.values()) if (v > maxCount) maxCount = v;
  if (maxCount === 0) return 1;
  const normalized = Math.min(myCount / maxCount, 1);
  return 1 + (1 - normalized) * (RARE_MASTERY_BOOST - 1);
}

/**
 * Returns the target value to exclude this session, or `null` if no
 * cooldown applies. The rule: if the last `COOLDOWN_RUN_LENGTH - 1`
 * entries in `recentTargets` (newest-first) are all equal to the same
 * value, that value is in cooldown.
 *
 * Pure and defensive: accepts `undefined`, short lists, and mixed
 * values. Exported only for test ergonomics.
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
  // Periodic re-baseline — every DIAGNOSTIC_PERIOD sessions, force a
  // diagnostic regardless of argmax. Sits above rankTargets so the
  // transparency panel can still render the ranked-candidates view via
  // `rankTargets` directly (the diagnostic overrides the *choice*, not
  // the *ranking*).
  const n = options?.upcomingSessionNumber;
  if (n !== undefined && n > 0 && n % DIAGNOSTIC_PERIOD === 0) {
    return diagnosticTarget();
  }
  const ranked = rankTargets(stats, baseline, phase, frequencyInLanguage, options);
  if (ranked.length === 0) return diagnosticTarget();

  // Rank exploration — every RANK_EXPLORATION_PERIOD sessions that
  // isn't already a diagnostic, reach past argmax into the weakness
  // tail. Seeded geometric draw means rank 1 is modal but deeper
  // ranks surface occasionally — addresses a gap cooldown can't:
  // cooldown only sees consecutive-value patterns, so mid-tier
  // weaknesses (ranks 3+) never get practiced as long as ranks 0-1
  // trade off. This fires purely on session count, independent of
  // history. No-op when the ranking has fewer than 2 candidates.
  if (n !== undefined && n > 0 && n % RANK_EXPLORATION_PERIOD === 0 && ranked.length > 1) {
    const rank = pickExplorationRank(n, ranked.length);
    return ranked[rank] ?? ranked[0] ?? diagnosticTarget();
  }
  return ranked[0] ?? diagnosticTarget();
}
