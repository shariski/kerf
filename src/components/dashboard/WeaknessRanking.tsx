import type { DashboardWeaknessRankingData } from "#/server/dashboard";

/**
 * Dashboard Section 4 — top-10 weakness ranking.
 *
 * 1:1 port of the `.weakness-row` block in dashboard-wireframe.html.
 * Seven columns: rank, unit, relative-weight bar, error %, avg time,
 * score. Characters render uppercase for legibility (B, T); bigrams
 * stay lowercase (er, th).
 *
 * The bar width is self-normalized to the current list — the #1
 * entry is always 100% filled, others proportional. This matches the
 * wireframe's intent and communicates *ordering* well, but the
 * absolute score number to its right is what the adaptive engine
 * actually consumes.
 */

type Props = { data: DashboardWeaknessRankingData };

export function WeaknessRanking({ data }: Props) {
  if (data.entries.length === 0) {
    return (
      <div className="kerf-dash-weakness kerf-dash-weakness--empty">
        <p className="kerf-dash-weakness-empty-note">
          Not enough signal yet — every letter needs at least a handful of
          attempts before it earns a rank here. Keep practicing and the
          list will fill in.
        </p>
      </div>
    );
  }

  return (
    <div className="kerf-dash-weakness">
      <header className="kerf-dash-weakness-head">
        <span>rank</span>
        <span>unit</span>
        <span>relative weight</span>
        <span className="kerf-dash-weakness-num">error</span>
        <span className="kerf-dash-weakness-num">avg time</span>
        <span className="kerf-dash-weakness-num">score</span>
      </header>

      {data.entries.map((entry, i) => (
        <div key={entry.unit} className="kerf-dash-weakness-row" role="listitem">
          <span className="kerf-dash-weakness-rank">
            {(i + 1).toString().padStart(2, "0")}
          </span>
          <span className="kerf-dash-weakness-key">
            {entry.isCharacter ? entry.unit.toUpperCase() : entry.unit}
          </span>
          <div
            className="kerf-dash-weakness-bar"
            role="progressbar"
            aria-valuenow={entry.relativeWeightPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Relative weakness: ${entry.relativeWeightPct}%`}
          >
            <div
              className="kerf-dash-weakness-bar-fill"
              style={{ width: `${entry.relativeWeightPct}%` }}
            />
          </div>
          <span className="kerf-dash-weakness-stat">{entry.errorRatePct}%</span>
          <span className="kerf-dash-weakness-stat">{entry.avgTimeMs}ms</span>
          <span className="kerf-dash-weakness-score">
            {entry.score.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}
