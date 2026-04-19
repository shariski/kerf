/**
 * Pure aggregation helpers that turn the raw rows the server function
 * fetched (sessions, character stats, split-metrics snapshots) into
 * the shape the hero stats + split-metrics UI consumes.
 *
 * All functions are deterministic and framework-free so they can be
 * unit-tested in isolation. The server function wires them to Drizzle
 * queries; tests call them with plain arrays.
 */

import type { CharacterStat } from "#/domain/stats/types";

// --- streak math -----------------------------------------------------------

/**
 * Compute current + longest daily streaks from a set of session
 * timestamps.
 *
 * "Current streak" = number of days ending at `today` (inclusive)
 * where at least one session happened every day. If the user didn't
 * practice today or yesterday, the current streak is 0.
 *
 * "Longest streak" = the max consecutive-days window anywhere in the
 * history.
 *
 * `today` is passed in rather than read from `Date.now()` so the
 * function stays pure and tests can pin the date.
 */
export function computeStreakDays(
  sessionStartedAt: readonly Date[],
  today: Date,
): { current: number; longest: number } {
  if (sessionStartedAt.length === 0) return { current: 0, longest: 0 };

  // Normalize each session date to the start of its day (UTC-stable
  // via toDateString — cheap and good enough for a single-user local
  // DB; timezone-sophisticated streak math is out of scope for MVP).
  const dayKeys = new Set<string>();
  for (const d of sessionStartedAt) dayKeys.add(dayKey(d));

  // Longest: walk sorted unique keys, count consecutive.
  const sortedKeys = [...dayKeys].sort();
  let longest = 0;
  let run = 0;
  let prevKey: string | null = null;
  for (const k of sortedKeys) {
    if (prevKey === null || isNextDay(prevKey, k)) {
      run = prevKey === null ? 1 : run + 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prevKey = k;
  }

  // Current: walk backward from today while each day has a session.
  // A one-day grace (i.e., practice yesterday but not today) resets
  // to 0 — intentional. If you missed today, your streak is broken
  // for today. Matches most streak-feature conventions.
  let current = 0;
  let cursor = new Date(today);
  while (dayKeys.has(dayKey(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }

  return { current, longest };
}

function dayKey(d: Date): string {
  // YYYY-MM-DD in local time. toISOString() would be UTC — wrong for
  // day-level boundaries. Use local year/month/date.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isNextDay(prevKey: string, currentKey: string): boolean {
  const prev = new Date(prevKey + "T00:00:00");
  const curr = new Date(currentKey + "T00:00:00");
  const diffMs = curr.getTime() - prev.getTime();
  // 24h ± 1h window to tolerate DST transitions.
  return diffMs >= 23 * 3_600_000 && diffMs <= 25 * 3_600_000;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

// --- mastered letters ------------------------------------------------------

export type MasteredOptions = {
  /** Minimum attempts for a character to be considered "measured". */
  minAttempts: number;
  /** Max error rate (0–1) for a character to count as mastered. */
  maxErrorRate: number;
};

/**
 * Count how many distinct lowercase letters the user has "mastered"
 * per the thresholds. Returns both the count and the alphabet size
 * (26 a-z) so the UI can render "X/26".
 *
 * Characters not in a-z (space, punctuation) are excluded — the
 * denominator is specifically the typing alphabet.
 */
export function computeMasteredCount(
  chars: readonly CharacterStat[],
  options: MasteredOptions,
): { mastered: number; total: number } {
  const TOTAL = 26;
  const alpha = new Set<string>();
  for (let i = 0; i < TOTAL; i++) {
    alpha.add(String.fromCharCode("a".charCodeAt(0) + i));
  }

  let mastered = 0;
  for (const c of chars) {
    const ch = c.character.toLowerCase();
    if (!alpha.has(ch)) continue;
    if (c.attempts < options.minAttempts) continue;
    const errorRate = c.errors / c.attempts;
    if (errorRate < options.maxErrorRate) mastered++;
  }
  return { mastered, total: TOTAL };
}

// --- trend delta -----------------------------------------------------------

/**
 * Compute a "you've improved by X vs your baseline" number.
 *
 * `values` is a chronological series (oldest → newest). The baseline
 * is the average of the first `baselineN` entries; the current mean
 * is the average of all. Returns `null` when there's not enough
 * history to give a meaningful trend (i.e. fewer than `baselineN + 1`
 * values), so the UI can render an empty state instead of a fake "+0".
 */
export function computeTrendDelta(
  values: readonly number[],
  baselineN: number,
): number | null {
  if (values.length < baselineN + 1) return null;
  const baseline = mean(values.slice(0, baselineN));
  const current = mean(values);
  return current - baseline;
}

function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

// --- sparkline -------------------------------------------------------------

/**
 * Down-sample a chronological value series to at most `maxPoints`
 * points so the tiny inline SVG stays readable. If the series already
 * fits, returns it unchanged. Preserves first and last points so the
 * trend shape is honest.
 */
export function buildSparklineValues(
  values: readonly number[],
  maxPoints: number,
): number[] {
  if (values.length <= maxPoints) return [...values];
  const step = (values.length - 1) / (maxPoints - 1);
  const out: number[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round(i * step);
    out.push(values[idx]!);
  }
  return out;
}

// --- split-metrics average -------------------------------------------------

export type SplitSnapshot = {
  innerColAttempts: number;
  innerColErrors: number;
  innerColErrorRate: number | null;
  thumbClusterCount: number;
  thumbClusterAvgMs: number | null;
  crossHandBigramCount: number;
  crossHandBigramAvgMs: number | null;
  columnarStableCount: number;
  columnarDriftCount: number;
  columnarStabilityPct: number | null;
};

export type AveragedSplitMetrics = {
  innerColumnErrorRatePct: number | null;
  thumbClusterAvgMs: number | null;
  crossHandBigramAvgMs: number | null;
  columnarStabilityPct: number | null;
};

/**
 * Average the per-session split-metrics snapshots into one dashboard
 * summary. Each metric is weighted by its attempt/count column so a
 * short session doesn't drag the average the way an unweighted mean
 * would.
 */
export function averageSplitMetrics(
  snapshots: readonly SplitSnapshot[],
): AveragedSplitMetrics {
  // Inner-col error rate: weight by attempts, not by snapshot count.
  // A 100-attempt session carries more signal than a 4-attempt one.
  let innerAttempts = 0;
  let innerErrors = 0;
  for (const s of snapshots) {
    innerAttempts += s.innerColAttempts;
    innerErrors += s.innerColErrors;
  }
  const innerColumnErrorRatePct =
    innerAttempts > 0 ? (innerErrors / innerAttempts) * 100 : null;

  // Thumb cluster avg ms: weight by count. We don't have sumMs here
  // (not exposed in the snapshot shape), so we reconstruct from
  // avg × count per snapshot.
  const thumbClusterAvgMs = weightedAvgOfAvg(
    snapshots,
    (s) => s.thumbClusterAvgMs,
    (s) => s.thumbClusterCount,
  );

  const crossHandBigramAvgMs = weightedAvgOfAvg(
    snapshots,
    (s) => s.crossHandBigramAvgMs,
    (s) => s.crossHandBigramCount,
  );

  // Columnar stability: weight by (stable + drift) total classifications.
  let stable = 0;
  let drift = 0;
  for (const s of snapshots) {
    stable += s.columnarStableCount;
    drift += s.columnarDriftCount;
  }
  const totalClass = stable + drift;
  const columnarStabilityPct =
    totalClass > 0 ? (stable / totalClass) * 100 : null;

  return {
    innerColumnErrorRatePct,
    thumbClusterAvgMs,
    crossHandBigramAvgMs,
    columnarStabilityPct,
  };
}

function weightedAvgOfAvg<T>(
  items: readonly T[],
  getAvg: (t: T) => number | null,
  getCount: (t: T) => number,
): number | null {
  let totalCount = 0;
  let weightedSum = 0;
  for (const item of items) {
    const avg = getAvg(item);
    const count = getCount(item);
    if (avg === null || count <= 0) continue;
    weightedSum += avg * count;
    totalCount += count;
  }
  return totalCount > 0 ? weightedSum / totalCount : null;
}
