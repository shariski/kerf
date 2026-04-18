import type {
  BigramStat,
  CharacterStat,
  ComputedStats,
  KeystrokeEvent,
  WeightedKeystrokeEvent,
} from "./types";

type ComputeStatsOptions = {
  hesitationThresholdMs: number;
};

type AnyEvent = KeystrokeEvent | WeightedKeystrokeEvent;

const weightOf = (e: AnyEvent): number =>
  "weight" in e && typeof e.weight === "number" ? e.weight : 1;

/**
 * Pure aggregation over a session's keystrokes. Returns per-character
 * and per-bigram totals. Hesitation count uses the supplied threshold;
 * the caller decides the threshold (typically
 * `HESITATION_MULTIPLIER × baseline.meanKeystrokeTime`).
 *
 * Accepts plain or weighted events. Weight 0 events are dropped.
 * Characters and bigrams are normalized to lowercase before grouping.
 */
export function computeStats(
  events: readonly AnyEvent[],
  options: ComputeStatsOptions,
): ComputedStats {
  const characters = new Map<string, CharacterStat>();
  const bigrams = new Map<string, BigramStat>();

  for (const e of events) {
    const w = weightOf(e);
    if (w === 0) continue;

    const ch = e.targetChar.toLowerCase();
    const charStat =
      characters.get(ch) ??
      { character: ch, attempts: 0, errors: 0, sumTime: 0, hesitationCount: 0 };

    charStat.attempts += w;
    charStat.sumTime += w * e.keystrokeMs;
    if (e.isError) charStat.errors += w;
    if (e.keystrokeMs > options.hesitationThresholdMs) {
      charStat.hesitationCount += w;
    }
    characters.set(ch, charStat);

    if (e.prevChar !== undefined) {
      const bg = (e.prevChar + e.targetChar).toLowerCase();
      const bigramStat =
        bigrams.get(bg) ??
        { bigram: bg, attempts: 0, errors: 0, sumTime: 0 };
      bigramStat.attempts += w;
      bigramStat.sumTime += w * e.keystrokeMs;
      if (e.isError) bigramStat.errors += w;
      bigrams.set(bg, bigramStat);
    }
  }

  return {
    characters: [...characters.values()],
    bigrams: [...bigrams.values()],
  };
}
