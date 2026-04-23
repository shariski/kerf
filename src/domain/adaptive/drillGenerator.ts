import type { KeyboardLayout } from "../finger/types";
import { getFingerForKey } from "../finger/resolver";
import type { Corpus } from "../corpus/types";

/**
 * Targeted drills per 02-architecture.md §4.3 and product-spec §5.5.
 *
 * Output shape: a single space-separated string of tokens (synthetic
 * combos + real words). Contrast with the adaptive exercise generator,
 * which returns `string[]` — drills are a continuous practice run, not
 * a word-by-word loop, so we hand the UI a ready-to-render string.
 *
 * Phase A interpretation of the three presets from §169 of the task
 * breakdown:
 *
 * - **Inner column** — rotate synthetic slices for each of {b, g, h,
 *   n, t, y}, concatenate.
 * - **Cross-hand bigrams** — derive targets from the finger table (any
 *   bigram whose two chars are on different hands). The §169 example
 *   list (`th he in`) is imperfect — "in" is same-hand on QWERTY — so
 *   we avoid a hardcoded list and compute from data.
 * - **Thumb cluster** — Phase A alpha-only content has no way to
 *   practice modifier thumb keys, but it does have Space. A "thumb
 *   cluster drill" in this scope is short-words-only: the user presses
 *   Space more often than they press any single letter.
 */

export const VOWELS: readonly string[] = ["a", "e", "i", "o", "u"];

export const INNER_COLUMN_CHARS: readonly string[] = ["b", "g", "h", "n", "t", "y"];

export const DEFAULT_DRILL_LENGTH = 300;

export type DrillOptions = {
  corpus: Corpus;
  target: string;
  targetLength?: number;
  rng?: () => number;
};

/**
 * Build the synthetic tokens for a target. Deterministic (not
 * rng-dependent) — the same target always produces the same tokens in
 * the same order. The rng only drives real-word sampling downstream.
 */
function syntheticTokens(target: string): string[] {
  if (target.length === 1) {
    const c = target;
    const tokens: string[] = [];
    for (const v of VOWELS) tokens.push(`${c}${v}${c}`);
    for (const v of VOWELS) tokens.push(`${c}${c}${v}`);
    for (const v of VOWELS) tokens.push(`${v}${c}${c}`);
    return tokens;
  }
  if (target.length === 2) {
    const bg = target;
    const tokens: string[] = [];
    for (const v of VOWELS) tokens.push(`${bg}${v}`);
    for (const v of VOWELS) tokens.push(`${v}${bg}`);
    tokens.push(`${bg}${bg}`);
    return tokens;
  }
  throw new Error(`drill target must be a single char or bigram (got ${target.length} chars)`);
}

/**
 * Count how many times `target` appears in `word.word`. For single-char
 * targets this is a char count; for bigrams it counts OVERLAPPING
 * occurrences (so "bbb" contains "bb" twice), matching how the user
 * experiences repeated transitions.
 */
function countOccurrences(word: string, target: string): number {
  if (target.length === 0) return 0;
  let count = 0;
  let from = 0;
  while (from <= word.length - target.length) {
    const idx = word.indexOf(target, from);
    if (idx < 0) break;
    count++;
    from = idx + 1;
  }
  return count;
}

/**
 * Weighted sample WITH replacement — for drills, repetition is fine
 * (the whole point is heavy exposure to the target). Picks until the
 * accumulated length hits `remaining`, or until we've looped enough
 * times that the caller's budget is exhausted and we bail out.
 */
function sampleRealWords(
  candidates: { word: string; weight: number }[],
  remainingChars: number,
  rng: () => number,
): string[] {
  if (candidates.length === 0 || remainingChars <= 0) return [];

  const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
  if (totalWeight <= 0) return [];

  const result: string[] = [];
  let used = 0;
  // Hard iteration cap so a pathological corpus can't lock us up.
  const maxIters = 5000;
  for (let i = 0; i < maxIters && used < remainingChars; i++) {
    const r = rng() * totalWeight;
    let acc = 0;
    for (const c of candidates) {
      acc += c.weight;
      if (r <= acc) {
        result.push(c.word);
        used += c.word.length + 1; // +1 for the space between tokens
        break;
      }
    }
  }
  return result;
}

export function generateDrill(options: DrillOptions): string {
  const { corpus, target, targetLength = DEFAULT_DRILL_LENGTH, rng = Math.random } = options;

  const lowerTarget = target.toLowerCase();
  const synthetic = syntheticTokens(lowerTarget);
  const syntheticString = synthetic.join(" ");

  const candidates = corpus.words
    .map((w) => ({ word: w.word, weight: countOccurrences(w.word, lowerTarget) }))
    .filter((c) => c.weight > 0);

  const remaining = targetLength - syntheticString.length;
  const realWords = sampleRealWords(candidates, remaining, rng);

  if (realWords.length === 0) return syntheticString;
  return `${syntheticString} ${realWords.join(" ")}`;
}

// --- preset drills ---------------------------------------------------------

export type PresetDrillOptions = {
  corpus: Corpus;
  targetLength?: number;
  rng?: () => number;
};

export type CrossHandDrillOptions = PresetDrillOptions & {
  layout?: KeyboardLayout;
};

export type ThumbClusterDrillOptions = PresetDrillOptions & {
  maxWordLength?: number;
};

/**
 * Inner-column drill — rotate per-character slices through b/g/h/n/t/y.
 * Each character gets roughly `targetLength / 6` chars of drill content.
 */
export function generateInnerColumnDrill(options: PresetDrillOptions): string {
  const { corpus, targetLength = DEFAULT_DRILL_LENGTH, rng = Math.random } = options;

  const perChar = Math.max(30, Math.floor(targetLength / INNER_COLUMN_CHARS.length));
  const slices = INNER_COLUMN_CHARS.map((ch) =>
    generateDrill({ corpus, target: ch, targetLength: perChar, rng }),
  );
  return slices.join(" ");
}

/**
 * Cross-hand bigram drill — pick the top cross-hand bigrams from the
 * corpus (by total occurrences across all words), then generate drill
 * slices for each. A bigram is cross-hand if its two characters are
 * assigned to different hands in the finger table.
 */
export function generateCrossHandBigramDrill(options: CrossHandDrillOptions): string {
  const {
    corpus,
    targetLength = DEFAULT_DRILL_LENGTH,
    rng = Math.random,
    layout = "sofle",
  } = options;

  const bigramCounts = new Map<string, number>();
  for (const w of corpus.words) {
    for (const bg of w.bigrams) {
      if (bg.length !== 2) continue;
      const l = getFingerForKey(layout, bg[0]!);
      const r = getFingerForKey(layout, bg[1]!);
      if (!l || !r) continue;
      if (l.hand === r.hand) continue;
      bigramCounts.set(bg, (bigramCounts.get(bg) ?? 0) + 1);
    }
  }

  const topBigrams = [...bigramCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([bg]) => bg);

  if (topBigrams.length === 0) return "";

  const perBigram = Math.max(30, Math.floor(targetLength / topBigrams.length));
  const slices = topBigrams.map((bg) =>
    generateDrill({ corpus, target: bg, targetLength: perBigram, rng }),
  );
  return slices.join(" ");
}

/**
 * Thumb-cluster drill — short-words-only practice. Alpha-only Phase A
 * corpus can't drill modifier thumb keys, but short words make the
 * user press Space frequently, which is the practical thumb-cluster
 * workout. Default cutoff is 4 chars.
 */
export function generateThumbClusterDrill(options: ThumbClusterDrillOptions): string {
  const {
    corpus,
    targetLength = DEFAULT_DRILL_LENGTH,
    rng = Math.random,
    maxWordLength = 4,
  } = options;

  const short = corpus.words.filter((w) => w.length <= maxWordLength);
  if (short.length === 0) return "";

  const candidates = short.map((w) => ({ word: w.word, weight: 1 }));
  const words = sampleRealWords(candidates, targetLength, rng);
  return words.join(" ");
}
