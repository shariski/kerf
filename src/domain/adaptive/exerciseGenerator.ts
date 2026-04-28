import type { Corpus, CorpusWord } from "../corpus/types";
import { LOW_CORPUS_SUPPORT_THRESHOLD } from "./targetSelection";

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
  /**
   * Emphasis floor — when set alongside a positive `mustContainMinRatio`,
   * guarantees that fraction of the sampled words contain this unit
   * (char like "u" or bigram like "th"). Words are split into an emphasis
   * pool (those containing the unit) and a filler pool; ratio × target
   * words come from emphasis, the rest from filler. If the emphasis pool
   * is smaller than the ratio implies, we include all available emphasis
   * words and top up from filler — we never force repetition.
   *
   * Rationale: the default weighted-sum scoring is dominated by the 0.5
   * per-unit floor for long non-target words, so sessions can silently
   * end up with few target-containing words even when
   * `weaknessScoreFor(target) = 10`. The emphasis floor decouples
   * "how many words contain the target" from the scoring weights.
   */
  mustContainUnit?: string;
  /** Fraction of `targetWordCount` that must contain `mustContainUnit`.
   *  Clamped to [0, 1]; values <= 0 disable the floor and fall through
   *  to the legacy weighted sampler. */
  mustContainMinRatio?: number;
  /** Precomputed `bigram → corpus word count` map. If present and
   *  `mustContainUnit` is a 2-char bigram whose entry is below
   *  `LOW_CORPUS_SUPPORT_THRESHOLD` (including absent / zero), the
   *  emphasis pool widens to "words whose `chars` contains either
   *  component character" — so a bigram with too few direct corpus
   *  words still produces a session biased toward the letters that
   *  drive it. When the map is omitted or support is at/above the
   *  threshold, the literal `mustContainUnit` match is used
   *  (unchanged behavior). */
  corpusBigramSupport?: ReadonlyMap<string, number>;
  /** Per-word weighting for the **filler** pool only (the non-emphasis
   *  portion when `mustContainUnit` + `mustContainMinRatio` are set).
   *  When provided, filler candidates are scored with this function
   *  instead of `matchScore(w, weaknessScoreFor)`. Use `() => 1` for
   *  uniform-per-word sampling (exploration blend — surfaces rare
   *  corpus words that weakness-weighted scoring would drown out).
   *  When omitted, filler inherits the weakness-weighted score for
   *  backwards-compat with callers that want "emphasize target, fill
   *  with other weaknesses." */
  fillerWeightFor?: (word: CorpusWord) => number;
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
    // biome-ignore lint/style/noNonNullAssertion: Fisher-Yates — i and j are both bounded by arr.length, so arr[i] and arr[j] are defined.
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
    mustContainUnit,
    mustContainMinRatio,
    corpusBigramSupport,
    fillerWeightFor,
  } = options;

  const useFloor =
    mustContainUnit !== undefined && mustContainMinRatio !== undefined && mustContainMinRatio > 0;

  if (useFloor) {
    const ratio = Math.min(1, mustContainMinRatio);
    const emphasisTarget = Math.min(targetWordCount, Math.ceil(targetWordCount * ratio));

    // Widen to component-char match when the literal bigram has low
    // corpus support (below LOW_CORPUS_SUPPORT_THRESHOLD, including
    // 0). `unit` is `mustContainUnit` narrowed by useFloor.
    const unit = mustContainUnit;
    const widenToComponentChars =
      unit.length === 2 &&
      corpusBigramSupport !== undefined &&
      (corpusBigramSupport.get(unit) ?? 0) < LOW_CORPUS_SUPPORT_THRESHOLD;

    const matches = (w: CorpusWord): boolean => {
      if (widenToComponentChars) {
        // biome-ignore lint/style/noNonNullAssertion: widenToComponentChars requires unit.length === 2, so unit[0] and unit[1] are defined.
        return w.chars.includes(unit[0]!) || w.chars.includes(unit[1]!);
      }
      return w.chars.includes(unit) || w.bigrams.includes(unit);
    };

    const emphasisCandidates: { word: CorpusWord; weight: number }[] = [];
    const fillerCandidates: { word: CorpusWord; weight: number }[] = [];
    for (const w of corpus.words) {
      if (!passesFilters(w, filters)) continue;
      if (matches(w)) {
        const score = matchScore(w, weaknessScoreFor);
        if (score <= 0) continue;
        emphasisCandidates.push({ word: w, weight: score });
      } else {
        // Filler gets its own weighting when provided (exploration blend
        // uses uniform per-word weight so rare-letter words aren't
        // drowned out by corpus-frequency bias). Falls back to the
        // emphasis scorer otherwise.
        const fillerScore = fillerWeightFor ? fillerWeightFor(w) : matchScore(w, weaknessScoreFor);
        if (fillerScore <= 0) continue;
        fillerCandidates.push({ word: w, weight: fillerScore });
      }
    }

    const emphasisSample = weightedSampleWithoutReplacement(
      emphasisCandidates,
      emphasisTarget,
      rng,
    );
    const fillerNeeded = targetWordCount - emphasisSample.length;
    const fillerSample = weightedSampleWithoutReplacement(fillerCandidates, fillerNeeded, rng);

    const combined = [...emphasisSample, ...fillerSample].map((w) => w.word);
    return shuffleInPlace(combined, rng);
  }

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
