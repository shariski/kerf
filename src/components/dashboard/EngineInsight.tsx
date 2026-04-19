import { Link } from "@tanstack/react-router";
import type { TransitionPhase } from "#/domain/stats/types";
import type { WeaknessRankEntry } from "#/domain/dashboard/aggregates";
import type { DashboardInsight } from "#/domain/dashboard/insight";
import { PhaseBadge } from "#/components/practice/PhaseBadge";

/**
 * Dashboard Section 6 — Engine Insight.
 *
 * Renders the plain-language narrative + decision rationale composed
 * by `composeDashboardInsight`, alongside the active-phase badge
 * (which reuses the same `PhaseBadge` component the pre-session
 * screen uses) and a footer CTA that links to `/practice`.
 *
 * The deeper "how is this calculated?" formula breakdown — live
 * values per component for the top weakness — is deliberately left
 * for Task 3.3 (power-user transparency panel). This section covers
 * what a normal user needs to walk away with: "the engine sees these
 * patterns and will target X next."
 */

type Props = {
  insight: DashboardInsight;
  phase: TransitionPhase;
  /** Top weakness name (for the context-aware drill CTA). */
  topWeaknessName: string | null;
};

export function EngineInsight({ insight, phase, topWeaknessName }: Props) {
  return (
    <article className="kerf-dash-insight">
      <header className="kerf-dash-insight-head">
        <span className="kerf-dash-insight-label">What the engine notices</span>
        <PhaseBadge phase={phase} />
      </header>

      <p className="kerf-dash-insight-narrative">{insight.narrative}</p>

      <div className="kerf-dash-insight-rationale">
        <span className="kerf-dash-insight-rationale-label">
          Next exercise
        </span>
        {insight.nextFocus.length > 0 ? (
          <p className="kerf-dash-insight-rationale-text">
            will emphasize <FocusList units={insight.nextFocus} />.
          </p>
        ) : (
          <p className="kerf-dash-insight-rationale-text">
            {insight.rationale}
          </p>
        )}
      </div>

      <footer className="kerf-dash-insight-footer">
        <span className="kerf-dash-insight-footer-copy">
          Ready to keep going?
        </span>
        <div className="kerf-dash-insight-actions">
          <Link
            to="/practice"
            className="kerf-dash-insight-btn kerf-dash-insight-btn--primary"
          >
            Continue adaptive practice
          </Link>
          {topWeaknessName ? (
            <Link
              to="/practice/drill"
              search={{ target: topWeaknessName }}
              className="kerf-dash-insight-btn kerf-dash-insight-btn--secondary"
            >
              Drill <strong>{topWeaknessName}</strong> specifically
            </Link>
          ) : null}
        </div>
      </footer>
    </article>
  );
}

// --- inline focus list with scores ---------------------------------------

function FocusList({ units }: { units: readonly WeaknessRankEntry[] }) {
  return (
    <>
      {units.map((u, i) => (
        <span key={u.unit}>
          {i > 0 ? (i === units.length - 1 ? ", and " : ", ") : null}
          <strong className="kerf-dash-insight-focus">
            {u.unit}
          </strong>
          <span className="kerf-dash-insight-focus-score">
            {" "}
            (score {u.score.toFixed(1)})
          </span>
        </span>
      ))}
    </>
  );
}
