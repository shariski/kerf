import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import type { DashboardTrajectoryData } from "#/server/dashboard";
import { useIsClient } from "#/hooks/useIsClient";

/**
 * Dashboard Section 5 — skill trajectory. Two area charts side by side:
 * **accuracy** (primary, amber — accuracy-first per product-spec §6.2)
 * and **speed** (secondary, info-blue).
 *
 * Divergence from the wireframe: the wireframe's second chart shows
 * "Mastery (% letters at < 5% error)" which would require replaying
 * per-session character stats to recover a time series we don't
 * store. Task-breakdown §3.2 itself lists "WPM and accuracy trend
 * charts" — the accuracy-per-session signal we already persist is
 * what this component draws.
 *
 * Recharts is used (per task spec) with its minimum possible surface:
 * no axes, no legend, no tooltip. The chart is a visual-only trend
 * line; the numeric current-value + baseline + delta sit around the
 * chart in their own text rows.
 */

type Props = { data: DashboardTrajectoryData };

export function TrajectoryCharts({ data }: Props) {
  if (data.points.length === 0) {
    return (
      <div className="kerf-dash-trajectory kerf-dash-trajectory--empty">
        <p className="kerf-dash-trajectory-empty-note">
          Charts appear after a few sessions land in your history. Keep
          practicing and the trend lines fill in.
        </p>
      </div>
    );
  }

  const first = data.points[0]!;
  const last = data.points[data.points.length - 1]!;

  return (
    <div className="kerf-dash-trajectory">
      <TrendCard
        title="Accuracy"
        color="amber"
        current={last.accuracyPct}
        currentLabel="%"
        baselineCaption={`${data.points.length} sessions ago: ${first.accuracyPct}%`}
        delta={data.accuracyDelta}
        deltaUnit="pts"
        series={data.points.map((p) => ({ index: p.index, value: p.accuracyPct }))}
      />
      <TrendCard
        title="Speed"
        color="info"
        current={last.wpm}
        currentLabel="wpm"
        baselineCaption={`${data.points.length} sessions ago: ${first.wpm} wpm`}
        delta={data.wpmDelta}
        deltaUnit="wpm"
        series={data.points.map((p) => ({ index: p.index, value: p.wpm }))}
      />
    </div>
  );
}

// --- trend card -----------------------------------------------------------

type TrendCardProps = {
  title: string;
  /** Maps to a CSS variable pair in styles.css: --color-kerf-amber-base
   * / --color-kerf-info-base, etc. Two colors is enough for two
   * charts. */
  color: "amber" | "info";
  current: number;
  currentLabel: string;
  baselineCaption: string;
  delta: number | null;
  deltaUnit: string;
  series: readonly { index: number; value: number }[];
};

function TrendCard({
  title,
  color,
  current,
  currentLabel,
  baselineCaption,
  delta,
  deltaUnit,
  series,
}: TrendCardProps) {
  const isClient = useIsClient();
  // SVG `stroke` / `fill` attributes don't resolve CSS custom
  // properties, so Recharts can't use `var(--color-kerf-amber-base)`
  // directly — the stroke silently becomes invalid and the line
  // disappears. Hardcode the hex values from the @theme block in
  // styles.css (`--color-kerf-amber-base: #F59E0B`, `--color-kerf-
  // info-base: #3B82F6`). Two colors and one theme — cheapest fix
  // that doesn't add a runtime CSS-var resolver.
  const colorHex = color === "amber" ? "#F59E0B" : "#3B82F6";
  const gradientId = `kerf-trend-grad-${title.toLowerCase()}`;

  return (
    <article className="kerf-dash-trend-card" data-accent={color}>
      <header className="kerf-dash-trend-header">
        <div className="kerf-dash-trend-title">{title}</div>
        <div className="kerf-dash-trend-value">
          {current}
          <span className="kerf-dash-trend-value-unit">{currentLabel}</span>
        </div>
      </header>

      <div className="kerf-dash-trend-chart" style={{ height: 120 }}>
        {isClient ? (
          <ResponsiveContainer width="100%" height={120} minWidth={0}>
            <AreaChart
              data={[...series]}
              margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colorHex} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={colorHex} stopOpacity={0} />
                </linearGradient>
              </defs>
              {/* Hidden axis — just sets the domain. */}
              <YAxis hide domain={["auto", "auto"]} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={colorHex}
                strokeWidth={1.5}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : null}
      </div>

      <footer className="kerf-dash-trend-meta">
        <span>{baselineCaption}</span>
        {delta !== null ? (
          <TrendDelta delta={delta} unit={deltaUnit} />
        ) : (
          <span className="kerf-dash-trend-delta kerf-dash-trend-delta--muted">
            trend needs more sessions
          </span>
        )}
      </footer>
    </article>
  );
}

function TrendDelta({ delta, unit }: { delta: number; unit: string }) {
  const dir = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
  return (
    <span className="kerf-dash-trend-delta" data-dir={dir}>
      {sign}
      {Math.abs(delta)} {unit} trend
    </span>
  );
}
