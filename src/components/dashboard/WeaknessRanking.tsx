import type { DashboardWeaknessRankingData } from "#/server/dashboard";

/**
 * Dashboard Section 4 — top-10 weakness ranking.
 *
 * 1:1 port of the `.weakness-row` block in dashboard-wireframe.html,
 * with one deliberate departure: we render every unit lowercase
 * regardless of whether it's a character or a bigram. The wireframe
 * uppercases single chars (B, T) for typographic distinction, but
 * users read that as "I typed capitals" even though the DB only
 * stores lowercase — confusing. The monospace font's built-in width
 * difference between a 1-char and 2-char unit is distinction enough.
 *
 * The bar width is self-normalized to the current list — the #1
 * entry is always 100% filled, others proportional. Ordering signal,
 * not absolute-scale; the score number beside it carries the
 * engine's actual input.
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
          <span className="kerf-dash-weakness-key">{entry.unit}</span>
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
