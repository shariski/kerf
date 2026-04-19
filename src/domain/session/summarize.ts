import type { KeyboardLayout } from "#/domain/finger/types";
import { computeSplitMetrics } from "#/domain/metrics/computeSplitMetrics";
import { generateSessionInsight } from "#/domain/insight/sessionInsight";
import {
  HESITATION_MULTIPLIER,
  PHASE_BASELINES,
} from "#/domain/stats/baselines";
import { computeStats } from "#/domain/stats/computeStats";
import type {
  KeystrokeEvent,
  TransitionPhase,
} from "#/domain/stats/types";
import type { PatternDetection } from "#/domain/insight/types";

/**
 * Minimum elapsed time before reporting a non-zero WPM. Mirrors the
 * guard in the live WPM ticker — below ~2s, keystroke counts are too
 * noisy for a meaningful number.
 */
export const MIN_ELAPSED_MS_FOR_WPM = 2000;

/**
 * Standard WPM convention: 5 characters per "word". Kept as a named
 * constant so the formula reads as intent, not magic numbers.
 */
export const CHARS_PER_WORD = 5;

/** Min errors to surface a character as emergent. Below this it is
 * typically noise from a short session. */
const EMERGENT_MIN_ERRORS = 2;
/** Min attempts for an emergent-character claim to be well-founded. */
const EMERGENT_MIN_ATTEMPTS = 3;

export type ErrorPosition = {
  /** Zero-based index into the session target. */
  index: number;
  /** The character the user was supposed to type at that position. */
  expected: string;
  /** The first wrong character the user actually typed there. */
  typed: string;
};

export type EmergentWeakness = {
  /** The character (lowercased). */
  unit: string;
  /** Short human-readable reason, e.g. "3 errors in 8 attempts". */
  reason: string;
  errorCount: number;
  attempts: number;
};

export type SessionSummary = {
  /** 0–100, rounded to the nearest integer. */
  accuracyPct: number;
  /** Words per minute, rounded to the nearest integer. */
  wpm: number;
  elapsedMs: number;
  /** Formatted as "M:SS" (e.g. "2:14"). */
  elapsedLabel: string;
  /** Number of whitespace-separated words in the target. */
  wordCount: number;
  /** Total wrong keystrokes — used for accuracy math. A position the
   * user mistyped twice before getting right contributes 2 here. */
  totalErrors: number;
  /** Count of DISTINCT target positions that had at least one wrong
   * keystroke. This is what the summary UI shows as "N errors" — it
   * matches the number of red-highlighted characters in the review
   * text. Mistyping the same spot twice counts once. */
  uniqueErrorCount: number;
  /** Count of attempted keystrokes (events.length). */
  totalKeystrokes: number;
  /** Per-position error details, ordered by index ascending. */
  errorPositions: ErrorPosition[];
  /** B↔N, B↔V, thumb hesitation etc. — sourced from session insight. */
  patterns: PatternDetection[];
  /** Top 2 characters where this session exposed weak spots. */
  emergentWeaknesses: EmergentWeakness[];
  /** One-paragraph plain-language insight (from `generateSessionInsight`). */
  insightText: string;
  /** Name of the top emergent weakness, if any — used for the Drill CTA. */
  topWeaknessName: string | null;
};

export type SummarizeSessionInput = {
  target: string;
  events: readonly KeystrokeEvent[];
  keyboardType: KeyboardLayout;
  startedAt: number | null;
  completedAt: number | null;
  phase: TransitionPhase;
};

/**
 * Derive a post-session summary from raw session state.
 *
 * Phase 2 intentionally runs with no persisted history: the insight
 * generator is called with empty `beforeStats` and no prior session,
 * so its trajectory frame is always "neutral" and its improvements
 * list is always empty. The `newWeaknesses` output becomes the
 * session's emergent weaknesses for free.
 *
 * Once Phase 3 adds session persistence, this function gains a
 * `previousSession` input and the frame/improvements become real.
 */
export function summarizeSession(input: SummarizeSessionInput): SessionSummary {
  const { target, events, keyboardType, startedAt, completedAt, phase } = input;

  const correctCount = events.filter((e) => !e.isError).length;
  const errorCount = events.length - correctCount;
  const accuracyPct =
    events.length === 0
      ? 100
      : Math.round((correctCount / events.length) * 100);

  const elapsedMs =
    startedAt !== null && completedAt !== null
      ? Math.max(0, completedAt - startedAt)
      : 0;
  const wpm =
    elapsedMs < MIN_ELAPSED_MS_FOR_WPM
      ? 0
      : Math.round(correctCount / CHARS_PER_WORD / (elapsedMs / 60000));

  const wordCount = target.trim().length === 0
    ? 0
    : target.trim().split(/\s+/).length;

  const errorPositions = collectErrorPositions(events);

  const baseline = PHASE_BASELINES[phase];
  const afterStats = computeStats(events, {
    hesitationThresholdMs: HESITATION_MULTIPLIER * baseline.meanKeystrokeTime,
  });
  const splitMetrics = computeSplitMetrics(events, keyboardType);
  const insight = generateSessionInsight({
    events,
    splitMetrics,
    beforeStats: { characters: [], bigrams: [] },
    afterStats,
    baseline,
    phase,
    sessionAccuracyPct: accuracyPct,
    sessionWpm: wpm,
  });

  const emergentWeaknesses = pickEmergentWeaknesses(afterStats.characters);

  return {
    accuracyPct,
    wpm,
    elapsedMs,
    elapsedLabel: formatElapsed(elapsedMs),
    wordCount,
    totalErrors: errorCount,
    uniqueErrorCount: errorPositions.length,
    totalKeystrokes: events.length,
    errorPositions,
    patterns: insight.patterns,
    emergentWeaknesses,
    insightText: insight.plainLanguageSummary,
    topWeaknessName: emergentWeaknesses[0]?.unit ?? null,
  };
}

// --- helpers ---------------------------------------------------------------

function collectErrorPositions(
  events: readonly KeystrokeEvent[],
): ErrorPosition[] {
  // Mirror the reducer's position semantics: a correct keystroke advances
  // position, an error does not. The first error at each position wins.
  let position = 0;
  const byIndex = new Map<number, ErrorPosition>();
  for (const ev of events) {
    if (ev.isError) {
      if (!byIndex.has(position)) {
        byIndex.set(position, {
          index: position,
          expected: ev.targetChar,
          typed: ev.actualChar,
        });
      }
    } else {
      position++;
    }
  }
  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

function pickEmergentWeaknesses(
  chars: ReturnType<typeof computeStats>["characters"],
): EmergentWeakness[] {
  return chars
    .filter(
      (c) => c.errors >= EMERGENT_MIN_ERRORS && c.attempts >= EMERGENT_MIN_ATTEMPTS,
    )
    .map((c) => ({
      unit: c.character,
      // Keystroke-framed label: "mistyped 2 of 11 presses". The engine
      // scores weakness by error rate per keystroke (errors/attempts),
      // which counts every retry at the same position — struggle-to-
      // correct is weakness. The word "presses" makes the keystroke
      // framing explicit so it doesn't read as contradicting the
      // position-count in the error-review header.
      reason: `mistyped ${c.errors} of ${c.attempts} presses`,
      errorCount: c.errors,
      attempts: c.attempts,
    }))
    .sort((a, b) => {
      const rateA = a.errorCount / a.attempts;
      const rateB = b.errorCount / b.attempts;
      if (rateB !== rateA) return rateB - rateA;
      return b.errorCount - a.errorCount;
    })
    .slice(0, 2);
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
