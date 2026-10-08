import { useEffect, useRef, useState } from "react";
import { formatRelativeDay } from "#/domain/dashboard/aggregates";
import { codeLanguageLabel } from "#/domain/codePractice/languages";
import type { DashboardActivityData } from "#/server/dashboard";
import type { PracticeHistoryData, PracticeHistoryItem } from "#/server/practiceHistory";

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

type Props = { data: DashboardActivityData; history: PracticeHistoryData };

export function ActivityLog({ data, history }: Props) {
  const [filter, setFilter] = useState<"all" | "keyboard" | "coding">("all");
  const sectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.location.hash !== "#code-practice-history") return;
    setFilter("coding");
    sectionRef.current?.scrollIntoView({ block: "start" });
  }, []);
  const days =
    filter === "all" ? history.allDays : filter === "coding" ? history.codeDays : data.days;
  const items = history.items
    .filter((item) => filter === "all" || item.track === filter)
    .slice(0, 5);
  return (
    <div id="code-practice-history" ref={sectionRef} className="kerf-dash-activity">
      <fieldset className="kerf-dash-activity-filters">
        <legend className="sr-only">Filter recent activity</legend>
        {(["all", "keyboard", "coding"] as const).map((choice) => (
          <button
            key={choice}
            type="button"
            aria-pressed={filter === choice}
            data-active={filter === choice || undefined}
            onClick={() => setFilter(choice)}
          >
            {choice === "all" ? "All" : choice === "keyboard" ? "Keyboard" : "Code"}
          </button>
        ))}
      </fieldset>
      <ContributionGrid days={days} />
      <Legend />
      {filter === "keyboard" && data.recentSessions.length > 0 ? (
        <LatestSessions sessions={data.recentSessions} />
      ) : items.length > 0 ? (
        <CombinedSessions items={items} keyboardSessions={data.recentSessions} />
      ) : (
        <p className="kerf-dash-activity-empty">
          No {filter === "coding" ? "Code" : "practice"} sessions yet.
        </p>
      )}
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

function CombinedSessions({
  items,
  keyboardSessions,
}: {
  items: readonly PracticeHistoryItem[];
  keyboardSessions: DashboardActivityData["recentSessions"];
}) {
  const now = new Date();
  const keyboardById = new Map(keyboardSessions.map((session) => [session.id, session]));
  return (
    <div className="kerf-dash-latest">
      <div className="kerf-dash-latest-title">Latest {items.length} sessions</div>
      <ul className="kerf-dash-latest-list">
        {items.map((item) => {
          if (item.track === "coding") {
            return (
              <li
                key={`code:${item.id}`}
                className="kerf-dash-session-row kerf-dash-session-row--mixed"
              >
                <span className="kerf-dash-session-time">
                  {formatRelativeDay(new Date(item.startedAt), now)}
                </span>
                <span className="kerf-dash-session-mode">
                  <span className="kerf-dash-session-badge" data-mode="code">
                    code
                  </span>
                  <span className="kerf-dash-session-copy">
                    <span className="kerf-dash-session-desc">
                      {codeLanguageLabel(item.language)} · {item.title}
                    </span>
                    <span className="kerf-dash-session-detail">
                      {item.symbolAccuracyPct === null ? "—" : `${item.symbolAccuracyPct}%`} symbol
                      accuracy
                    </span>
                  </span>
                </span>
                <span className="kerf-dash-session-stat">{item.wpm} wpm</span>
                <span className="kerf-dash-session-stat">{item.accuracyPct}%</span>
                <span className="kerf-dash-session-duration">{item.durationLabel}</span>
              </li>
            );
          }
          const original = keyboardById.get(item.id);
          const mode =
            original?.mode ?? (item.focusLabel === "Focused drill" ? "targeted_drill" : "adaptive");
          return (
            <li
              key={`keyboard:${item.id}`}
              className="kerf-dash-session-row kerf-dash-session-row--mixed"
            >
              <span className="kerf-dash-session-time">
                {original?.relativeTime ?? formatRelativeDay(new Date(item.startedAt), now)}
              </span>
              <span className="kerf-dash-session-mode">
                <span className="kerf-dash-session-badge" data-mode={mode}>
                  {mode === "targeted_drill" ? "drill" : "adaptive"}
                </span>
                <span className="kerf-dash-session-desc">
                  {original?.description ?? item.focusLabel}
                </span>
              </span>
              <span className="kerf-dash-session-stat">{original?.wpm ?? item.wpm ?? "—"} wpm</span>
              <span className="kerf-dash-session-stat">
                {original?.accuracyPct ?? item.accuracyPct ?? "—"}
                {original?.accuracyPct !== undefined || item.accuracyPct !== null ? "%" : ""}
              </span>
              <span className="kerf-dash-session-duration">
                {original?.durationLabel ?? item.durationLabel}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// --- latest sessions list -------------------------------------------------

function LatestSessions({ sessions }: { sessions: DashboardActivityData["recentSessions"] }) {
  return (
    <div className="kerf-dash-latest">
      <div className="kerf-dash-latest-title">Latest {sessions.length} sessions</div>
      <ul className="kerf-dash-latest-list">
        {sessions.map((s) => (
          <li key={s.id} className="kerf-dash-session-row">
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
          </li>
        ))}
      </ul>
    </div>
  );
}
