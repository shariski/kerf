/**
 * Word corpus types — see 02-architecture.md §4.2 and §word_corpus schema.
 *
 * The corpus is a pre-built English wordlist with precomputed metadata,
 * consumed by the exercise generator (task 1.3c) and drill generator
 * (task 1.3d) for weighted random sampling.
 *
 * Phase A is alpha-only (a-z). Because Sofle and Lily58 share identical
 * QWERTY alpha positions (validated in task 1.1), the hand-balance and
 * inner-column metadata are layout-agnostic. If V2 adds punctuation
 * drills where thumb-cluster placements diverge, introduce per-layout
 * metadata sidecars — don't recompute at read time.
 */

export type CorpusWord = {
  /** Lowercase word. */
  word: string;
  /** Number of characters. */
  length: number;
  /** Unique characters in the word, sorted. Matches the SQL schema's
   * `characters text[] -- array of unique chars`. Use `length` or the
   * raw word when you need per-character repeat counts. */
  chars: string[];
  /** Adjacent character pairs in order, NOT deduped. Typing "banana"
   * yields ["ba", "an", "na", "an", "na"] so match-scoring weights the
   * "an" transition twice, reflecting that it's executed twice. */
  bigrams: string[];
  /** Rank in the source frequency list (0 = most common). Used for the
   * DELTA frequency penalty in the weakness score and for caller filters
   * like "common words only". */
  freqRank: number;
  /** Number of keystrokes executed on the left hand when typing this
   * word, per the finger assignment table. Layout-agnostic in Phase A
   * (alpha-only) since Sofle and Lily58 share the alpha layer. */
  leftKeystrokes: number;
  /** Number of keystrokes on the right hand. `leftKeystrokes +
   * rightKeystrokes === length` for all alpha-only words. */
  rightKeystrokes: number;
  /** Count of inner-column characters (b, g, h, n, t, y) in the word.
   * Used by the drill generator to pick words heavy on columnar pain
   * points. */
  innerColumnCount: number;
};

export type Corpus = {
  /** Bumped when the corpus shape or build pipeline changes, so the
   * loader can detect stale cached blobs in the browser. */
  version: number;
  /** Scope of the corpus. "alpha-only" means a-z exclusively — no
   * digits, no punctuation. */
  scope: "alpha-only";
  /** Source attribution (e.g. "google-10000-english"). */
  source: string;
  words: CorpusWord[];
};
