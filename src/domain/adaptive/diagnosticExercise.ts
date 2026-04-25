import type { Corpus, CorpusWord } from "../corpus/types";
import type { ComputedStats } from "../stats/types";
import { bayesianWeakness, type MasteryStat } from "./bayesianMastery";
import { shuffleInPlace, weightedSampleWithoutReplacement } from "./exerciseGenerator";
import { LOW_CORPUS_SUPPORT_THRESHOLD } from "./targetSelection";

/**
 * Coverage-guided diagnostic exercise (Path 2 ADR-005).
 *
 * The Path 2 ranker excludes unmeasured chars/bigrams from argmax
 * (see `targetSelection.ts`). That makes the diagnostic the **only**
 * mechanism for surfacing units the user has never typed — so the
 * diagnostic must actually deliver coverage. The original
 * uniform-weight diagnostic didn't: with `weaknessScoreFor: () => 1`,
 * the sampler just biased toward longer words, leaving rare letters
 * (`j`, `q`, `x`, `z`) and most unmeasured bigrams to chance.
 *
 * This generator runs three phases:
 *
 * 1. **Char coverage (unconditional priority).** Greedy-pick words
 *    that maximize the count of uncovered chars, until the
 *    user-uncovered alphabet is fully hit (or the corpus runs out
 *    of words containing the missing letters). Capped only by
 *    `targetWordCount` itself — chars are cheap (~7-10 words for a
 *    full alphabet sweep) and full coverage is the whole point.
 *
 * 2. **Bigram coverage (capped by `coverageBudget`).** Same greedy
 *    rule on uncovered bigrams. There can be ~600 unmeasured bigrams
 *    at cold start, so this phase is bounded — we cover what fits.
 *    Subsequent diagnostics chip away at the remainder.
 *
 * 3. **Weighted fill (Bayesian weakness).** Remaining slots sample
 *    by `Σ bayesianWeakness(unit)` per word, so the diagnostic also
 *    re-tests the user's measured weak units. Final output is a
 *    snapshot of *both* gaps and current weak spots — true "overall
 *    mastery snapshot," not just gap-filling.
 */

export type DiagnosticExerciseOptions = {
  corpus: Corpus;
  stats: ComputedStats;
  /** `char → corpus word count`. Defines the coverable character
   *  universe — only chars with positive support are eligible
   *  (filters `;` and other drill-key cross-layer leaks). */
  corpusCharSupport: ReadonlyMap<string, number>;
  /** `bigram → corpus word count`. Defines the coverable bigram
   *  universe — only bigrams with support >=
   *  `LOW_CORPUS_SUPPORT_THRESHOLD` are eligible (untrainable
   *  bigrams excluded for the same reason as the ranker). */
  corpusBigramSupport: ReadonlyMap<string, number>;
  targetWordCount?: number;
  /** Fraction of `targetWordCount` reserved for greedy coverage
   *  (phase 1 + phase 2). Phase 3 (fill) gets the rest. Default
   *  0.5 — half the diagnostic is gap-filling, half is
   *  weakness re-test. */
  coverageBudgetRatio?: number;
  rng?: () => number;
};

export const DEFAULT_DIAGNOSTIC_WORD_COUNT = 50;
export const DEFAULT_COVERAGE_BUDGET_RATIO = 0.5;

const ZERO_STAT: MasteryStat = { attempts: 0, errors: 0 };

export function generateDiagnosticExercise(options: DiagnosticExerciseOptions): string[] {
  const {
    corpus,
    stats,
    corpusCharSupport,
    corpusBigramSupport,
    targetWordCount = DEFAULT_DIAGNOSTIC_WORD_COUNT,
    coverageBudgetRatio = DEFAULT_COVERAGE_BUDGET_RATIO,
    rng = Math.random,
  } = options;

  if (targetWordCount <= 0 || corpus.words.length === 0) return [];

  const measuredChars = new Set(
    stats.characters.filter((s) => s.attempts > 0).map((s) => s.character),
  );
  const measuredBigrams = new Set(stats.bigrams.filter((s) => s.attempts > 0).map((s) => s.bigram));

  const uncoveredChars = new Set<string>();
  for (const [c, support] of corpusCharSupport) {
    if (support > 0 && !measuredChars.has(c)) uncoveredChars.add(c);
  }
  const uncoveredBigrams = new Set<string>();
  for (const [bg, support] of corpusBigramSupport) {
    if (support >= LOW_CORPUS_SUPPORT_THRESHOLD && !measuredBigrams.has(bg)) {
      uncoveredBigrams.add(bg);
    }
  }

  const coverageBudget = Math.floor(targetWordCount * coverageBudgetRatio);
  const selected: CorpusWord[] = [];
  const usedWords = new Set<string>();

  // Phase 1: char coverage (unconditional priority).
  while (uncoveredChars.size > 0 && selected.length < targetWordCount) {
    const best = pickBestCoverageWord(corpus.words, usedWords, uncoveredChars, "chars");
    if (best === null) break;
    selected.push(best);
    usedWords.add(best.word);
    for (const c of best.chars) uncoveredChars.delete(c);
    for (const bg of best.bigrams) uncoveredBigrams.delete(bg);
  }

  // Phase 2: bigram coverage (capped by budget).
  while (uncoveredBigrams.size > 0 && selected.length < coverageBudget) {
    const best = pickBestCoverageWord(corpus.words, usedWords, uncoveredBigrams, "bigrams");
    if (best === null) break;
    selected.push(best);
    usedWords.add(best.word);
    for (const bg of best.bigrams) uncoveredBigrams.delete(bg);
  }

  // Phase 3: weighted fill by Bayesian weakness of measured units.
  const fillNeeded = Math.max(0, targetWordCount - selected.length);
  if (fillNeeded > 0) {
    const charStat = new Map<string, MasteryStat>(
      stats.characters.map((s) => [s.character, { attempts: s.attempts, errors: s.errors }]),
    );
    const bigramStat = new Map<string, MasteryStat>(
      stats.bigrams.map((s) => [s.bigram, { attempts: s.attempts, errors: s.errors }]),
    );

    const fillCandidates: { word: CorpusWord; weight: number }[] = [];
    for (const w of corpus.words) {
      if (usedWords.has(w.word)) continue;
      let weight = 0;
      for (const c of w.chars) weight += bayesianWeakness(charStat.get(c) ?? ZERO_STAT);
      for (const bg of w.bigrams) weight += bayesianWeakness(bigramStat.get(bg) ?? ZERO_STAT);
      if (weight > 0) fillCandidates.push({ word: w, weight });
    }

    const filled = weightedSampleWithoutReplacement(fillCandidates, fillNeeded, rng);
    for (const w of filled) {
      selected.push(w);
      usedWords.add(w.word);
    }
  }

  return shuffleInPlace(
    selected.map((w) => w.word),
    rng,
  );
}

/**
 * Greedy: among unused corpus words, return the one whose
 * `chars` (or deduped `bigrams`) has the largest intersection with
 * the still-uncovered set. Ties broken by corpus iteration order
 * (typically frequency rank), so output is deterministic given
 * fixed corpus + uncovered set.
 *
 * Returns `null` when no unused word can add coverage — the caller
 * uses this to break out of the loop early.
 */
function pickBestCoverageWord(
  candidates: readonly CorpusWord[],
  used: Set<string>,
  uncovered: Set<string>,
  axis: "chars" | "bigrams",
): CorpusWord | null {
  let bestWord: CorpusWord | null = null;
  let bestScore = 0;
  for (const w of candidates) {
    if (used.has(w.word)) continue;
    let score = 0;
    if (axis === "chars") {
      for (const c of w.chars) if (uncovered.has(c)) score++;
    } else {
      // Word.bigrams is NOT deduped (per corpus types.ts); count each
      // unique uncovered bigram once.
      const seen = new Set<string>();
      for (const bg of w.bigrams) {
        if (uncovered.has(bg) && !seen.has(bg)) {
          score++;
          seen.add(bg);
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestWord = w;
    }
  }
  return bestWord;
}
