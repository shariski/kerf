/**
 * Curated first-session exercise — used when a profile has zero
 * history, in place of adaptive sampling. See Task 4.1 in
 * docs/03-task-breakdown.md.
 *
 * Why fixed, not sampled: the first session is a diagnostic baseline.
 * Its job is to populate `character_stats` / `bigram_stats` so the
 * second session has something for the adaptive engine to weight. A
 * random sample would hand each new user a different baseline, which
 * both obscures comparability and mixes in word-difficulty noise that
 * doesn't belong in a baseline signal.
 *
 * The word set is short, high-frequency English. It deliberately
 * exercises the inner-column stretch (t, h, n, r, b) — the dominant
 * transition friction for split-keyboard learners per architecture
 * §4.5. Without these letters the first session produces only
 * home-row data, which trains the engine for something that was
 * never the user's real problem.
 */
export const FIRST_SESSION_WORDS = [
  "the",
  "of",
  "and",
  "to",
  "in",
  "a",
  "is",
  "that",
  "it",
  "for",
  "on",
  "with",
  "as",
  "was",
  "he",
  "have",
  "be",
  "by",
  "at",
  "this",
  "but",
  "not",
  "from",
  "they",
  "all",
  "can",
  "make",
  "time",
  "like",
  "just",
] as const;

export function getFirstSessionTarget(): string {
  return FIRST_SESSION_WORDS.join(" ");
}
