import type { Corpus, CorpusWord } from "../corpus/types";

/**
 * Adaptive word-picker per 02-architecture.md §4.2. Takes a loaded
 * corpus and a caller-supplied unit-weakness lookup; returns a
 * shuffled, de-duplicated list of words biased toward the user's
 * weak units.
 *
 * Design notes worth making explicit:
 *
 * 1. **`weaknessScoreFor` is a closure, not a `Record`.** It decouples
 *    the generator from the user's stats, baselines, and phase — the
 *    caller composes those upstream. A concrete caller will usually
 *    precompute scores for every char + bigram and close over a `Map`
 *    for O(1) lookups.
 *
 * 2. **Sampling is WITHOUT replacement.** §4.2 says "weighted random
 *    sampling" — ambiguous about replacement. Users don't want the
 *    same word twice in a single 50-word drill, and the corpus is
 *    large enough that we never run out. Implemented via the
 *    Efraimidis-Spirakis weighted reservoir trick: for each candidate,
 *    `key = rand^(1/weight)` — or equivalently `key = -log(rand)/weight`
 *    for numerical stability with large weights; take the `target`
 *    candidates with largest keys. O(n log target). No rejection
 *    sampling, no degenerate cases.
 *
 * 3. **Zero-weight candidates are dropped.** If all candidates have
 *    zero weight, we return `[]` — the caller should detect this and
 *    broaden filters or show an empty-state message. Throwing would
 *    force every caller to wrap in try/catch for a legitimate state.
 *
 * 4. **Match score sums chars AND bigrams in the word.** Bigrams are
 *    stored as the full adjacent-pair sequence (not deduped), so
 *    repeated transitions like "an" in "banana" contribute twice.
 *    Chars are stored deduped. See corpus/types.ts for the rationale.
 */

export type HandIsolation = "left" | "right" | "either";

export type ExerciseFilters = {
  handIsolation?: HandIsolation;
  maxLength?: number;
  maxInnerColumnCount?: number;
};

export type ExerciseOptions = {
  corpus: Corpus;
  weaknessScoreFor: (unitId: string) => number;
  filters?: ExerciseFilters;
  targetWordCount?: number;
  rng?: () => number;
};

export const DEFAULT_TARGET_WORD_COUNT = 50;

const passesFilters = (w: CorpusWord, filters: ExerciseFilters | undefined): boolean => {
  if (!filters) return true;
  if (filters.maxLength !== undefined && w.length > filters.maxLength) {
    return false;
  }
  if (
    filters.maxInnerColumnCount !== undefined &&
    w.innerColumnCount > filters.maxInnerColumnCount
  ) {
    return false;
  }
  switch (filters.handIsolation) {
    case "left":
      return w.rightKeystrokes === 0;
    case "right":
      return w.leftKeystrokes === 0;
    default:
      return true;
  }
};

const matchScore = (w: CorpusWord, weaknessScoreFor: (unitId: string) => number): number => {
  let sum = 0;
  for (const c of w.chars) sum += weaknessScoreFor(c);
  for (const bg of w.bigrams) sum += weaknessScoreFor(bg);
  return sum;
};

// Efraimidis-Spirakis weighted reservoir sampling. For each positive-weight
// candidate, draw u ~ Uniform(0,1) and compute key = -ln(u) / weight. The
// `target` candidates with the SMALLEST keys are the sample. (The classic
// formulation uses key = u^(1/weight) and takes the largest — numerically
// the same, but `-ln(u)/w` is more stable when weights span many orders
// of magnitude.) Without replacement; O(n log target) via a partial sort.
const weightedSampleWithoutReplacement = (
  candidates: { word: CorpusWord; weight: number }[],
  target: number,
  rng: () => number,
): CorpusWord[] => {
  if (target <= 0 || candidates.length === 0) return [];
  const take = Math.min(target, candidates.length);

  const keyed = candidates.map((c) => {
    const u = rng();
    // Avoid log(0). rng is [0, 1), so u could be 0 in pathological cases.
    const safeU = u > 0 ? u : Number.EPSILON;
    return { word: c.word, key: -Math.log(safeU) / c.weight };
  });
  keyed.sort((a, b) => a.key - b.key);
  return keyed.slice(0, take).map((k) => k.word);
};

// In-place Fisher-Yates using the provided rng. Returns the same array
// for ergonomic chaining; the array IS mutated.
const shuffleInPlace = <T>(arr: T[], rng: () => number): T[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
};

export function generateExercise(options: ExerciseOptions): string[] {
  const {
    corpus,
    weaknessScoreFor,
    filters,
    targetWordCount = DEFAULT_TARGET_WORD_COUNT,
    rng = Math.random,
  } = options;

  const candidates: { word: CorpusWord; weight: number }[] = [];
  for (const w of corpus.words) {
    if (!passesFilters(w, filters)) continue;
    const score = matchScore(w, weaknessScoreFor);
    if (score > 0) candidates.push({ word: w, weight: score });
  }

  const sampled = weightedSampleWithoutReplacement(candidates, targetWordCount, rng);
  const words = sampled.map((s) => s.word);
  return shuffleInPlace(words, rng);
}
