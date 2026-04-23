import type { DashboardActivityData } from "#/server/dashboard";

/**
 * Section 2 of the dashboard — GitHub-style contribution grid for the
 * last 30 days plus a "Latest 5 sessions" list.
 *
 * 1:1 port of the `.activity-log` block in dashboard-wireframe.html:
 * same 30-column grid, same 5-level amber saturation scale, same
 * session-row layout (time / mode + description / wpm / acc /
 * duration). Uses `.kerf-*` class names to stay consistent with the
 * rest of the codebase.
 *
 * Empty state (no sessions yet) is handled at the route level — the
 * dashboard page renders its own empty CTA instead of this section.
 */

type Props = { data: DashboardActivityData };

export function ActivityLog({ data }: Props) {
  return (
    <div className="kerf-dash-activity">
      <ContributionGrid days={data.days} />
      <Legend />
      {data.recentSessions.length > 0 ? <LatestSessions sessions={data.recentSessions} /> : null}
    </div>
  );
}

// --- 30-day contribution grid ---------------------------------------------

function ContributionGrid({ days }: { days: DashboardActivityData["days"] }) {
  return (
    <div
      className="kerf-dash-activity-grid"
      role="img"
      aria-label={`${days.filter((d) => d.sessionCount > 0).length} practice days in the last ${days.length}`}
    >
      {days.map((d) => (
        <span
          key={d.date}
          className="kerf-dash-activity-cell"
          data-level={d.level}
          title={
            d.sessionCount === 0
              ? `${d.date} — no practice`
              : `${d.date} — ${d.sessionCount} session${d.sessionCount === 1 ? "" : "s"}`
          }
        />
      ))}
    </div>
  );
}

function Legend() {
  return (
    <div className="kerf-dash-activity-legend">
      <span>30 days ago</span>
      <div className="kerf-dash-activity-scale">
        <span>less</span>
        {[0, 1, 2, 3, 4].map((lvl) => (
          <span
            key={lvl}
            className="kerf-dash-activity-cell kerf-dash-activity-cell--scale"
            data-level={lvl}
            aria-hidden="true"
          />
        ))}
        <span>more</span>
      </div>
      <span>today</span>
    </div>
  );
}

// --- latest sessions list -------------------------------------------------

function LatestSessions({ sessions }: { sessions: DashboardActivityData["recentSessions"] }) {
  return (
    <div className="kerf-dash-latest">
      <div className="kerf-dash-latest-title">Latest {sessions.length} sessions</div>
      <div className="kerf-dash-latest-list" role="list">
        {sessions.map((s) => (
          <div key={s.id} className="kerf-dash-session-row" role="listitem">
            <span className="kerf-dash-session-time">{s.relativeTime}</span>
            <span className="kerf-dash-session-mode">
              <span className="kerf-dash-session-badge" data-mode={s.mode}>
                {s.mode === "targeted_drill" ? "drill" : "adaptive"}
              </span>{" "}
              <span className="kerf-dash-session-desc">{s.description}</span>
            </span>
            <span className="kerf-dash-session-stat">{s.wpm} wpm</span>
            <span className="kerf-dash-session-stat">{s.accuracyPct}%</span>
            <span className="kerf-dash-session-duration">{s.durationLabel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
