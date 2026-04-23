/**
 * Temporal-patterns aggregation (Task 3.4c).
 *
 * Pure function that buckets sessions by hour-of-day (0-23) and by
 * day-of-week (0=Sunday … 6=Saturday), producing two parallel
 * aggregates of mean WPM per bucket with a per-bucket sample count.
 *
 * Timezone note — this fn uses `Date#getHours()` / `Date#getDay()`,
 * which read the caller's local timezone. That means **it should
 * run client-side**, so the buckets reflect the user's wall-clock
 * time rather than the server process's (which in a deployed setup
 * is typically UTC). The `TemporalPatterns` component applies this
 * fn inside a `useMemo` on the raw session window returned by the
 * server; the server itself never calls it.
 *
 * Product intent: "when do I practice best?" The chart only reads
 * WPM because the dashboard's hero-stats section already leads with
 * accuracy; adding a second accuracy-over-hour chart would double
 * the cognitive load without adding value at typical sample sizes.
 */

export type HourBucket = {
  /** 0-23 in the user's local tz. */
  hour: number;
  /** Rounded mean WPM, or `null` when this bucket has fewer than
   * `MIN_SAMPLES_PER_BUCKET` sessions. Null means "don't draw a bar"
   * — a single 60 WPM session in the 3am bucket should not claim
   * "your 3am performance". */
  meanWpm: number | null;
  sampleCount: number;
};

export type DayOfWeekBucket = {
  /** 0=Sunday … 6=Saturday — matches `Date#getDay()`. */
  dayOfWeek: number;
  /** 3-letter abbreviated label ready for the chart's x-axis.
   * Baking this into the domain keeps the UI from re-deriving it in
   * every render. */
  dayLabel: string;
  meanWpm: number | null;
  sampleCount: number;
};

export type TemporalPatterns = {
  /** Always length 24, one entry per hour even when a bucket is empty
   * — downstream charts draw 24 slots so the shape of the x-axis
   * doesn't shift when one hour happens to be empty. */
  byHour: readonly HourBucket[];
  /** Always length 7, one entry per day-of-week. */
  byDayOfWeek: readonly DayOfWeekBucket[];
  totalSessions: number;
  /** True when ≥1 bucket in either dimension has a non-null mean.
   * Drives the UI's "meaningful data vs placeholder" branch so the
   * chart doesn't render 31 empty bars. */
  hasMeaningfulData: boolean;
};

export type TemporalPatternsInput = {
  sessions: readonly { startedAt: Date; wpm: number }[];
};

/** A bucket needs at least this many sessions before we'll show a
 * mean. Smaller and a single outlier skews the number. Larger and
 * the chart goes dark too long for early users. Revisit after beta. */
export const MIN_SAMPLES_PER_BUCKET = 2;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function computeTemporalPatterns(input: TemporalPatternsInput): TemporalPatterns {
  const hourSums = new Array<number>(24).fill(0);
  const hourCounts = new Array<number>(24).fill(0);
  const daySums = new Array<number>(7).fill(0);
  const dayCounts = new Array<number>(7).fill(0);

  for (const s of input.sessions) {
    const h = s.startedAt.getHours();
    const d = s.startedAt.getDay();
    hourSums[h] = (hourSums[h] ?? 0) + s.wpm;
    hourCounts[h] = (hourCounts[h] ?? 0) + 1;
    daySums[d] = (daySums[d] ?? 0) + s.wpm;
    dayCounts[d] = (dayCounts[d] ?? 0) + 1;
  }

  const byHour: HourBucket[] = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    sampleCount: hourCounts[i]!,
    meanWpm:
      hourCounts[i]! >= MIN_SAMPLES_PER_BUCKET ? Math.round(hourSums[i]! / hourCounts[i]!) : null,
  }));

  const byDayOfWeek: DayOfWeekBucket[] = DAY_LABELS.map((label, i) => ({
    dayOfWeek: i,
    dayLabel: label,
    sampleCount: dayCounts[i]!,
    meanWpm:
      dayCounts[i]! >= MIN_SAMPLES_PER_BUCKET ? Math.round(daySums[i]! / dayCounts[i]!) : null,
  }));

  const hasMeaningfulData =
    byHour.some((h) => h.meanWpm !== null) || byDayOfWeek.some((d) => d.meanWpm !== null);

  return {
    byHour,
    byDayOfWeek,
    totalSessions: input.sessions.length,
    hasMeaningfulData,
  };
}

/**
 * Pick the "best" bucket from a hour or day-of-week series — the
 * highest mean WPM among buckets that cleared the minimum-samples
 * gate. `null` when no bucket has enough data. The UI uses this for
 * a caption like "You type fastest around 9am" — a single sentence
 * that does the reading for the user instead of making them squint
 * at bars.
 */
export function pickPeakBucket<T extends { meanWpm: number | null }>(
  buckets: readonly T[],
): T | null {
  let peak: T | null = null;
  for (const b of buckets) {
    if (b.meanWpm === null) continue;
    if (peak === null || b.meanWpm > (peak.meanWpm ?? 0)) peak = b;
  }
  return peak;
}

/** Format an hour-of-day integer (0-23) as a short human label used
 * on the chart's x-axis and in peak-bucket captions. 24h style —
 * shorter than 12h with AM/PM, and consistent with the rest of the
 * dashboard's numeric display. */
export function formatHourLabel(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}
