import { useMemo } from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import type { DashboardTemporalPatternsData } from "#/server/dashboard";
import {
  computeTemporalPatterns,
  formatHourLabel,
  pickPeakBucket,
  type DayOfWeekBucket,
  type HourBucket,
} from "#/domain/dashboard/temporalPatterns";

/**
 * Dashboard "When you practice best" section (Task 3.4c).
 *
 * Two small bar charts — mean WPM by hour-of-day (24 bars) and by
 * day-of-week (7 bars) — built from the raw session window the
 * server returns. Bucketing runs client-side via `useMemo` so
 * `Date#getHours()` reads the user's local tz; see
 * `temporalPatterns.ts` for the tz rationale.
 *
 * The task-breakdown calls for a "WPM by hour/day" chart; we
 * deliberately split the two dimensions into separate small charts
 * rather than a 24×7 heatmap. At realistic Phase A session counts
 * (20-60 over 30 days) a heatmap would show 160+ empty cells and
 * draw attention to sparsity rather than pattern.
 *
 * A plain-language "you type fastest around …" caption does the
 * reading for the user so the bars don't have to carry that load on
 * their own — matches the dashboard's narrative-first bias.
 */

type Props = { data: DashboardTemporalPatternsData };

export function TemporalPatterns({ data }: Props) {
  const patterns = useMemo(() => {
    const sessions = data.sessions.map((s) => ({
      startedAt: new Date(s.startedAt),
      wpm: s.wpm,
    }));
    return computeTemporalPatterns({ sessions });
  }, [data.sessions]);

  if (!patterns.hasMeaningfulData) {
    return (
      <p className="kerf-dash-temporal-empty">
        Chart fills in after a few sessions repeat a time-of-day or
        day-of-week. With {patterns.totalSessions} session
        {patterns.totalSessions === 1 ? "" : "s"} in the last 30 days,
        no bucket has enough samples yet to read without noise.
      </p>
    );
  }

  const peakHour = pickPeakBucket(patterns.byHour);
  const peakDay = pickPeakBucket(patterns.byDayOfWeek);

  return (
    <div className="kerf-dash-temporal">
      <PeakCaption peakHour={peakHour} peakDay={peakDay} />
      <div className="kerf-dash-temporal-charts">
        <HourChart buckets={patterns.byHour} />
        <DayOfWeekChart buckets={patterns.byDayOfWeek} />
      </div>
      <p className="kerf-dash-temporal-meta">
        Based on {patterns.totalSessions} session
        {patterns.totalSessions === 1 ? "" : "s"} over the last 30 days.
      </p>
    </div>
  );
}

// --- peak-bucket caption --------------------------------------------------

function PeakCaption({
  peakHour,
  peakDay,
}: {
  peakHour: HourBucket | null;
  peakDay: DayOfWeekBucket | null;
}) {
  const parts: string[] = [];
  if (peakHour) {
    parts.push(
      `fastest around ${formatHourLabel(peakHour.hour)} (${peakHour.meanWpm} WPM)`,
    );
  }
  if (peakDay) {
    parts.push(`${peakDay.dayLabel} is your strongest day (${peakDay.meanWpm} WPM)`);
  }
  if (parts.length === 0) return null;
  return (
    <p className="kerf-dash-temporal-peak">
      <span className="kerf-dash-temporal-peak-label">Pattern</span>
      <span className="kerf-dash-temporal-peak-body">
        You type {parts.join(", and ")}.
      </span>
    </p>
  );
}

// --- hour-of-day chart ----------------------------------------------------

/** Chart height tuned so 24 narrow bars have room to read without the
 * section dominating the dashboard. Matches the trajectory card's
 * visual weight. */
const CHART_HEIGHT = 140;

function HourChart({ buckets }: { buckets: readonly HourBucket[] }) {
  // Sub-threshold buckets get meanWpm=null → 0 here → zero-height
  // (invisible) bar. Keeps the x-axis spacing uniform across 24 slots
  // while still hiding noise from buckets that don't have enough
  // samples to plot honestly.
  const chartData = buckets.map((b) => ({
    hour: b.hour,
    wpm: b.meanWpm ?? 0,
  }));

  return (
    <div className="kerf-dash-temporal-chart">
      <header className="kerf-dash-temporal-chart-head">
        <h3 className="kerf-dash-temporal-chart-title">By hour of day</h3>
        <span className="kerf-dash-temporal-chart-axis">WPM</span>
      </header>
      <div style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
            <Bar
              dataKey="wpm"
              fill="var(--color-kerf-info-base)"
              fillOpacity={0.75}
              isAnimationActive={false}
            />
            <XAxis
              dataKey="hour"
              tick={{
                fill: "var(--color-kerf-text-tertiary)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-kerf-border-subtle)" }}
              interval={5} // labels at 0, 6, 12, 18
              tickFormatter={(h: number) => (h < 10 ? `0${h}` : `${h}`)}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// --- day-of-week chart ----------------------------------------------------

function DayOfWeekChart({ buckets }: { buckets: readonly DayOfWeekBucket[] }) {
  const chartData = buckets.map((b) => ({
    day: b.dayLabel,
    wpm: b.meanWpm ?? 0,
  }));

  return (
    <div className="kerf-dash-temporal-chart">
      <header className="kerf-dash-temporal-chart-head">
        <h3 className="kerf-dash-temporal-chart-title">By day of week</h3>
        <span className="kerf-dash-temporal-chart-axis">WPM</span>
      </header>
      <div style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
            <Bar
              dataKey="wpm"
              fill="var(--color-kerf-info-base)"
              fillOpacity={0.75}
              isAnimationActive={false}
            />
            <XAxis
              dataKey="day"
              tick={{
                fill: "var(--color-kerf-text-tertiary)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-kerf-border-subtle)" }}
              interval={0} // show every day label
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
