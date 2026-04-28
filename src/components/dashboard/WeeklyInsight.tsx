import type { WeeklyInsight as WeeklyInsightData } from "#/domain/insight/types";

/**
 * Dashboard weekly-insight section (Task 3.4b).
 *
 * Renders the narrative + recommendations composed by
 * `generateWeeklyInsight`. The component is a thin view — all copy
 * decisions (phase-aware wording, stagnation framing, accuracy-first
 * ordering) live in the pure domain so the same logic can feed email
 * digests or other surfaces without duplication.
 *
 * Visual shape differs from the engine-insight card deliberately:
 * weekly insight is comparison-framed, with a compact
 * this-week-vs-last-week strip above the narrative. The engine
 * insight is moment-framed (what-the-engine-notices-now), so the two
 * cards don't look identical stacked side by side.
 */

type Props = {
  data: WeeklyInsightData | null;
};

export function WeeklyInsight({ data }: Props) {
  if (!data) {
    return (
      <p className="kerf-dash-weekly-empty">
        No sessions logged yet. The week-over-week read lands once there's data in both the current
        and prior 7-day windows.
      </p>
    );
  }

  return (
    <article className="kerf-dash-weekly">
      <ComparisonStrip data={data} />
      <p className="kerf-dash-weekly-narrative">{data.narrative}</p>
      {data.recommendations.length > 0 ? (
        <div className="kerf-dash-weekly-recs">
          <span className="kerf-dash-weekly-recs-label">What to try next</span>
          <ul className="kerf-dash-weekly-recs-list">
            {data.recommendations.map((rec) => (
              <li key={rec} className="kerf-dash-weekly-recs-item">
                {rec}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

// --- this-week vs last-week strip -----------------------------------------

function ComparisonStrip({ data }: { data: WeeklyInsightData }) {
  return (
    <div className="kerf-dash-weekly-strip" role="group" aria-label="Weekly comparison">
      <ComparisonCell
        label="This week"
        sessions={data.thisWeek.sessions}
        accuracy={data.thisWeek.accuracyPct}
        wpm={data.thisWeek.wpm}
        primary
      />
      <ComparisonCell
        label="Last week"
        sessions={data.lastWeek.sessions}
        accuracy={data.lastWeek.accuracyPct}
        wpm={data.lastWeek.wpm}
      />
    </div>
  );
}

type ComparisonCellProps = {
  label: string;
  sessions: number;
  accuracy: number | null;
  wpm: number | null;
  primary?: boolean;
};

function ComparisonCell({ label, sessions, accuracy, wpm, primary }: ComparisonCellProps) {
  const empty = sessions === 0;
  return (
    <div
      className="kerf-dash-weekly-cell"
      data-empty={empty ? "true" : undefined}
      data-primary={primary ? "true" : undefined}
    >
      <span className="kerf-dash-weekly-cell-label">{label}</span>
      {empty ? (
        <span className="kerf-dash-weekly-cell-empty">— no sessions —</span>
      ) : (
        <div className="kerf-dash-weekly-cell-stats">
          <Stat value={`${accuracy ?? 0}%`} label="accuracy" featured />
          <Stat value={`${wpm ?? 0}`} label="WPM" />
          <Stat value={`${sessions}`} label={sessions === 1 ? "session" : "sessions"} />
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, featured }: { value: string; label: string; featured?: boolean }) {
  return (
    <div className="kerf-dash-weekly-stat" data-featured={featured ? "true" : undefined}>
      <span className="kerf-dash-weekly-stat-value">{value}</span>
      <span className="kerf-dash-weekly-stat-label">{label}</span>
    </div>
  );
}
