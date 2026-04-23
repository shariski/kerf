/**
 * Pure aggregation helpers that turn the raw rows the server function
 * fetched (sessions, character stats, split-metrics snapshots) into
 * the shape the hero stats + split-metrics UI consumes.
 *
 * All functions are deterministic and framework-free so they can be
 * unit-tested in isolation. The server function wires them to Drizzle
 * queries; tests call them with plain arrays.
 */

import { computeWeaknessScore, isLowConfidence } from "#/domain/adaptive/weaknessScore";
import type {
  BigramStat,
  CharacterStat,
  TransitionPhase,
  UserBaseline,
} from "#/domain/stats/types";

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
export function computeTrendDelta(values: readonly number[], baselineN: number): number | null {
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
export function buildSparklineValues(values: readonly number[], maxPoints: number): number[] {
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
export function averageSplitMetrics(snapshots: readonly SplitSnapshot[]): AveragedSplitMetrics {
  // Inner-col error rate: weight by attempts, not by snapshot count.
  // A 100-attempt session carries more signal than a 4-attempt one.
  let innerAttempts = 0;
  let innerErrors = 0;
  for (const s of snapshots) {
    innerAttempts += s.innerColAttempts;
    innerErrors += s.innerColErrors;
  }
  const innerColumnErrorRatePct = innerAttempts > 0 ? (innerErrors / innerAttempts) * 100 : null;

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
  const columnarStabilityPct = totalClass > 0 ? (stable / totalClass) * 100 : null;

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

// --- activity log helpers (Task 3.2b) -------------------------------------

/** Cell saturation for a single day's cell in the 30-day contribution
 * grid. Conventions mirror GitHub's graph — gray (0) through four
 * escalating amber tints. Thresholds are session-count based because
 * it matches the "did you show up?" narrative better than total chars
 * (a single long session vs several short ones is the same intent). */
export type ActivityLevel = 0 | 1 | 2 | 3 | 4;

export function activityLevel(sessionCount: number): ActivityLevel {
  if (sessionCount <= 0) return 0;
  if (sessionCount === 1) return 1;
  if (sessionCount <= 3) return 2;
  if (sessionCount <= 5) return 3;
  return 4;
}

export type ActivityDay = {
  /** YYYY-MM-DD (local). */
  date: string;
  sessionCount: number;
  level: ActivityLevel;
};

/**
 * Build an ordered (oldest → newest) `days`-length array of activity
 * buckets ending at `today`. Each bucket has its session count and
 * a 0–4 level for the UI. Days with no sessions still appear — they
 * render as empty cells, which is the whole point of a contribution
 * grid (seeing the gaps matters).
 */
export function bucketActivityByDay(
  sessionStartedAt: readonly Date[],
  today: Date,
  days = 30,
): ActivityDay[] {
  const counts = new Map<string, number>();
  for (const d of sessionStartedAt) {
    const k = dayKey(d);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const out: ActivityDay[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const d = addDays(today, -offset);
    const key = dayKey(d);
    const count = counts.get(key) ?? 0;
    out.push({ date: key, sessionCount: count, level: activityLevel(count) });
  }
  return out;
}

/**
 * Relative time label for a session row. Buckets:
 *   - same calendar day → "today" or "Nh ago" if < 12h
 *   - yesterday         → "yesterday"
 *   - within a week     → "Nd ago"
 *   - older             → "YYYY-MM-DD"
 *
 * `now` is a parameter so the function stays pure.
 */
export function formatRelativeDay(from: Date, now: Date): string {
  const fromKey = dayKey(from);
  const nowKey = dayKey(now);
  if (fromKey === nowKey) {
    const diffMs = now.getTime() - from.getTime();
    const hours = Math.floor(diffMs / 3_600_000);
    if (hours <= 0) return "just now";
    if (hours < 12) return `${hours}h ago`;
    return "today";
  }
  const yesterday = dayKey(addDays(now, -1));
  if (fromKey === yesterday) return "yesterday";

  // Scan back up to 7 days for "Nd ago".
  for (let i = 2; i <= 7; i++) {
    if (fromKey === dayKey(addDays(now, -i))) return `${i}d ago`;
  }
  return fromKey;
}

/**
 * Format elapsed ms as "M:SS". Used by the latest-sessions list's
 * duration column. Same shape as the post-session summary's elapsed
 * label, duplicated here to avoid reaching into the domain/session
 * layer from the dashboard layer.
 */
export function formatDurationLabel(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// --- heatmap levels (Task 3.2c) -------------------------------------------

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export type HeatOptions = {
  /** Min attempts before a character gets a heat level above 0.
   * Below this it stays level-0 (treated as "no signal yet"). */
  minAttempts: number;
};

export type HeatEntry = {
  character: string;
  attempts: number;
  errors: number;
  /** 0–1. NaN-safe (0 when attempts is 0). */
  errorRate: number;
  level: HeatLevel;
};

/**
 * Absolute-threshold error-rate buckets for the per-key dashboard
 * heatmap. The amber→red ramp mirrors the wireframe's design tokens:
 * faint amber for "noticed", deeper amber for "watch this", red for
 * "practice target".
 *
 * Thresholds are absolute (not relative to the series' max) because
 * a 10% error rate on a single key has standalone meaning regardless
 * of how much better other keys are. Relative ramping would hide a
 * genuinely weak keyboard by stretching its best keys to look "good".
 */
const HEAT_THRESHOLDS: readonly { lt: number; level: HeatLevel }[] = [
  { lt: 0.03, level: 1 }, // < 3% → faint amber ("fine")
  { lt: 0.07, level: 2 }, // 3–7% → amber ("watch this")
  { lt: 0.15, level: 3 }, // 7–15% → red-amber ("work on it")
  { lt: Infinity, level: 4 }, // ≥ 15% → strong red ("big weakness")
];

// --- weakness ranking (Task 3.2d) -----------------------------------------

export type WeaknessRankEntry = {
  /** "b" for a character, "er" for a bigram. Already lowercase. */
  unit: string;
  /** UI cue for formatting (characters render uppercase, bigrams
   * render as-is). */
  isCharacter: boolean;
  /** Weakness score as computed by the adaptive engine, rounded to
   * one decimal to match the wireframe's stat column. */
  score: number;
  /** Error rate as a 0–100 integer for display. */
  errorRatePct: number;
  /** Average keystroke time in ms, rounded. */
  avgTimeMs: number;
  /** Total attempts across the user's history for this unit. Surfaced
   * so tooltips or later extensions can show "n attempts" — not in the
   * current visual. */
  attempts: number;
  /** Self-normalized to the list's top score: the #1 entry is always
   * 100, others proportional. Matches the wireframe's
   * .weakness-bar-fill widths and gives an at-a-glance sense of
   * ordering without forcing an absolute scale the user can't read. */
  relativeWeightPct: number;
};

/**
 * Rank the user's weakest typing units for the dashboard.
 *
 * Mixes characters and bigrams into a single list per the wireframe
 * (B / er / T / ; / th / G / Y). Filters low-confidence units (per
 * adaptive engine's `isLowConfidence`) so early-session noise doesn't
 * surface fake rankings. Sorts by score desc, takes the top N.
 *
 * Uses `computeWeaknessScore` — the same function the exercise
 * generator ranks by — so the dashboard's ranking matches what the
 * engine will pick next. Pass frequencyInLanguage=0 because the
 * corpus isn't loaded in the server/dashboard read path; that term
 * drops out and score reflects error/slowness/hesitation only, which
 * is still the majority of the signal.
 */
export function computeWeaknessRanking(input: {
  chars: readonly CharacterStat[];
  bigrams: readonly BigramStat[];
  baseline: UserBaseline;
  phase: TransitionPhase;
  topN: number;
}): WeaknessRankEntry[] {
  const { chars, bigrams, baseline, phase, topN } = input;

  type Candidate = {
    entry: WeaknessRankEntry;
    rawScore: number;
  };
  const candidates: Candidate[] = [];

  for (const c of chars) {
    if (isLowConfidence(c)) continue;
    const score = computeWeaknessScore(c, baseline, phase, 0);
    candidates.push({
      entry: {
        unit: c.character.toLowerCase(),
        isCharacter: true,
        score: roundTo(score, 1),
        errorRatePct: Math.round((c.errors / Math.max(1, c.attempts)) * 100),
        avgTimeMs: Math.round(c.sumTime / Math.max(1, c.attempts)),
        attempts: c.attempts,
        relativeWeightPct: 0, // filled in after we know max score
      },
      rawScore: score,
    });
  }

  for (const b of bigrams) {
    if (isLowConfidence(b)) continue;
    // Defensive: the persist pipeline records `prev_char + target_char`
    // which includes "n " (n + space) at word boundaries and empty
    // leak-throughs on first keystrokes. The dashboard ranking is
    // about letter-letter patterns only — anything containing a space
    // or non-alpha reads as a lone letter once rendered, confusing
    // the table next to real character-stats entries.
    if (!/^[a-z]{2}$/i.test(b.bigram)) continue;
    const score = computeWeaknessScore(b, baseline, phase, 0);
    candidates.push({
      entry: {
        unit: b.bigram.toLowerCase(),
        isCharacter: false,
        score: roundTo(score, 1),
        errorRatePct: Math.round((b.errors / Math.max(1, b.attempts)) * 100),
        avgTimeMs: Math.round(b.sumTime / Math.max(1, b.attempts)),
        attempts: b.attempts,
        relativeWeightPct: 0,
      },
      rawScore: score,
    });
  }

  candidates.sort((a, b) => b.rawScore - a.rawScore);
  const top = candidates.slice(0, topN);

  const maxRaw = top.length > 0 ? top[0]!.rawScore : 0;
  return top.map(({ entry, rawScore }) => ({
    ...entry,
    relativeWeightPct: maxRaw > 0 ? Math.max(0, Math.round((rawScore / maxRaw) * 100)) : 0,
  }));
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Bucket character_stats rows into dashboard heatmap entries. Only
 * alphabetic characters (a–z) are returned — the keyboard SVG has
 * no slots for space/punctuation, so there's nothing to color.
 */
export function computeHeatLevels(
  chars: readonly { character: string; attempts: number; errors: number }[],
  options: HeatOptions,
): HeatEntry[] {
  const out: HeatEntry[] = [];
  for (const c of chars) {
    const ch = c.character.toLowerCase();
    if (!/^[a-z]$/.test(ch)) continue;

    const attempts = c.attempts;
    const errors = c.errors;
    const errorRate = attempts > 0 ? errors / attempts : 0;

    let level: HeatLevel = 0;
    if (attempts >= options.minAttempts && errorRate > 0) {
      for (const t of HEAT_THRESHOLDS) {
        if (errorRate < t.lt) {
          level = t.level;
          break;
        }
      }
    }

    out.push({ character: ch, attempts, errors, errorRate, level });
  }
  return out;
}
