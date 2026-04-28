import type { DashboardHeroData } from "#/server/dashboard";
import { SparklineSvg } from "./SparklineSvg";

/**
 * Hero grid for the dashboard — 4 stat cards.
 *
 * Accuracy-first per docs/01-product-spec.md §6.2 and CLAUDE.md §B3:
 * accuracy is the featured (big, amber, sparkline) stat; WPM is
 * demoted to secondary. This deliberately diverges from the
 * dashboard-wireframe.html layout, which predates the accuracy-first
 * lock-in. The visual treatment (amber featured color + sparkline)
 * still matches the wireframe — it's the slot assignment that flips.
 */

type Props = { data: DashboardHeroData };

export function HeroStats({ data }: Props) {
  return (
    <div className="kerf-dash-hero-grid">
      <FeaturedCard
        label="accuracy"
        value={<>{data.accuracyPct}%</>}
        trend={data.accuracyTrendPct !== null ? signedPct(data.accuracyTrendPct) : null}
        trendCaption={`vs first 7 sessions`}
        sparkline={data.accuracySparkline}
      />

      <SecondaryCard
        label="average wpm"
        value={data.avgWpm}
        trend={data.avgWpmTrend !== null ? signedWpm(data.avgWpmTrend) : null}
        trendCaption="vs first 7"
      />

      <SecondaryCard
        label="mastered"
        value={
          <>
            {data.mastered.count}
            <span className="kerf-dash-hero-denominator">/{data.mastered.total}</span>
          </>
        }
        caption="letters at < 5% error"
      />

      <SecondaryCard
        label="streak"
        value={
          <>
            {data.currentStreakDays}
            <span className="kerf-dash-hero-denominator">
              {" "}
              day{data.currentStreakDays === 1 ? "" : "s"}
            </span>
          </>
        }
        caption={
          data.longestStreakDays > 0
            ? `longest: ${data.longestStreakDays} day${data.longestStreakDays === 1 ? "" : "s"}`
            : "start your first streak"
        }
      />
    </div>
  );
}

// --- cards -----------------------------------------------------------------

function FeaturedCard({
  label,
  value,
  trend,
  trendCaption,
  sparkline,
}: {
  label: string;
  value: React.ReactNode;
  trend: SignedFormatted | null;
  trendCaption: string;
  sparkline: readonly number[];
}) {
  return (
    <article className="kerf-dash-hero-card kerf-dash-hero-card--featured">
      <div className="kerf-dash-hero-label">{label}</div>
      <div className="kerf-dash-hero-value">{value}</div>
      <div className="kerf-dash-hero-context">
        {trend ? (
          <>
            <span className="kerf-dash-hero-trend" data-dir={trend.dir}>
              {trend.text}
            </span>
            <span className="kerf-dash-hero-trend-caption">{trendCaption}</span>
          </>
        ) : (
          <span className="kerf-dash-hero-trend-caption">trend appears after 8 sessions</span>
        )}
      </div>
      <SparklineSvg
        className="kerf-dash-hero-sparkline"
        values={sparkline}
        ariaLabel="Accuracy trend over recent sessions"
      />
    </article>
  );
}

function SecondaryCard({
  label,
  value,
  trend,
  trendCaption,
  caption,
}: {
  label: string;
  value: React.ReactNode;
  trend?: SignedFormatted | null;
  trendCaption?: string;
  caption?: string;
}) {
  return (
    <article className="kerf-dash-hero-card kerf-dash-hero-card--secondary">
      <div className="kerf-dash-hero-label">{label}</div>
      <div className="kerf-dash-hero-value">{value}</div>
      <div className="kerf-dash-hero-context">
        {trend ? (
          <>
            <span className="kerf-dash-hero-trend" data-dir={trend.dir}>
              {trend.text}
            </span>
            {trendCaption ? (
              <span className="kerf-dash-hero-trend-caption">{trendCaption}</span>
            ) : null}
          </>
        ) : caption ? (
          <span className="kerf-dash-hero-trend-caption">{caption}</span>
        ) : null}
      </div>
    </article>
  );
}

// --- formatting ------------------------------------------------------------

type SignedFormatted = { text: string; dir: "up" | "down" | "flat" };

function signedPct(delta: number): SignedFormatted {
  const rounded = Math.round(delta * 10) / 10;
  const dir: SignedFormatted["dir"] = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "±";
  return { dir, text: `${sign}${Math.abs(rounded)} pts` };
}

function signedWpm(delta: number): SignedFormatted {
  const rounded = Math.round(delta);
  const dir: SignedFormatted["dir"] = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "±";
  return { dir, text: `${sign}${Math.abs(rounded)} wpm` };
}
