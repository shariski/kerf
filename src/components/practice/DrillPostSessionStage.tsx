import type { ErrorPosition, SessionSummary } from "#/domain/session/summarize";
import type { DrillSummary } from "#/domain/session/drillSummary";
import type { PatternDetection } from "#/domain/insight/types";

/**
 * Post-drill summary — IA §4.3 "similar to practice summary but
 * specific to the drilled target".
 *
 * Reuses the Task 2.5 layout (badge, title, stats, error review,
 * insight callout) but swaps in a drill-specific before/after card
 * instead of weakness shifts, and offers drill-specific actions
 * ("Run again" / "Move to adaptive practice") instead of the three
 * Task 2.5 CTAs.
 *
 * Deliberate duplication: small presentational helpers (ErrorReviewText,
 * ErrorPatterns) are copied from PostSessionStage rather than extracted
 * to a shared module. Extraction gets paid for when a third call site
 * appears — until then, two self-contained files are easier to reason
 * about than a shared one tugged in two directions (CLAUDE.md §A2).
 */

type Props = {
  /** The drill label, e.g. "B", "er", "Inner column". */
  drillLabel: string;
  target: string;
  summary: SessionSummary;
  drillDelta: DrillSummary;
  onRunAgain: () => void;
  onMoveToAdaptive: () => void;
};

export function DrillPostSessionStage({
  drillLabel,
  target,
  summary,
  drillDelta,
  onRunAgain,
  onMoveToAdaptive,
}: Props) {
  const {
    accuracyPct,
    wpm,
    elapsedLabel,
    wordCount,
    uniqueErrorCount,
    errorPositions,
    patterns,
    insightText,
  } = summary;

  return (
    <div className="kerf-post-session">
      <div className="kerf-post-complete-mark">
        <div className="kerf-post-complete-mark-badge">
          <span className="kerf-post-complete-mark-dot" aria-hidden="true" />
          drill complete
        </div>
      </div>

      <h1 className="kerf-post-title">
        Drill on <span className="kerf-post-title-target">{drillLabel}</span> finished.
      </h1>

      <div className="kerf-post-stats" role="list" aria-label="Drill results">
        <div className="kerf-post-stat" role="listitem">
          <div className="kerf-post-stat-label">accuracy</div>
          <div
            className="kerf-post-stat-value featured"
            aria-label={`Accuracy ${accuracyPct} percent`}
          >
            {accuracyPct}%
          </div>
          <div className="kerf-post-stat-delta neutral">
            {uniqueErrorCount === 0
              ? "clean run"
              : `${uniqueErrorCount} error${uniqueErrorCount === 1 ? "" : "s"}`}
          </div>
        </div>
        <div className="kerf-post-stat" role="listitem">
          <div className="kerf-post-stat-label">speed</div>
          <div className="kerf-post-stat-value" aria-label={`Speed ${wpm} words per minute`}>
            {wpm}
          </div>
          <div className="kerf-post-stat-delta neutral">wpm</div>
        </div>
        <div className="kerf-post-stat" role="listitem">
          <div className="kerf-post-stat-label">time</div>
          <div className="kerf-post-stat-value" aria-label={`Time ${elapsedLabel}`}>
            {elapsedLabel}
          </div>
          <div className="kerf-post-stat-delta neutral">
            {wordCount} word{wordCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="kerf-post-section-label">
        <span>Error review</span>
        <span className="kerf-error-review-stats">
          <span className="count">
            {uniqueErrorCount} error{uniqueErrorCount === 1 ? "" : "s"}
          </span>
          {uniqueErrorCount > 0 ? " · hover each marked character" : null}
        </span>
      </div>
      <div className="kerf-error-review">
        <div className="kerf-error-review-text">
          <ErrorReviewText target={target} errors={errorPositions} />
        </div>
        <ErrorPatterns patterns={patterns} uniqueErrorCount={uniqueErrorCount} />
      </div>

      <div className="kerf-post-section-label">Before vs. after — {drillLabel}</div>
      <BeforeAfterCard drillDelta={drillDelta} drillLabel={drillLabel} />

      <div className="kerf-insight">
        <div className="kerf-insight-label">What the engine noticed</div>
        <div className="kerf-insight-text">{insightText}</div>
      </div>

      <div className="kerf-post-actions">
        <button type="button" className="kerf-post-btn primary" onClick={onRunAgain} autoFocus>
          Run again
          <span className="kerf-post-btn-shortcut" aria-hidden="true">
            ⏎
          </span>
        </button>
        <button type="button" className="kerf-post-btn secondary" onClick={onMoveToAdaptive}>
          Move to adaptive practice
          <span className="kerf-post-btn-shortcut" aria-hidden="true">
            P
          </span>
        </button>
      </div>
    </div>
  );
}

// --- before/after card -----------------------------------------------------

function BeforeAfterCard({
  drillDelta,
  drillLabel,
}: {
  drillDelta: DrillSummary;
  drillLabel: string;
}) {
  if (drillDelta.insufficientData) {
    return (
      <div className="kerf-drill-delta-card kerf-drill-delta-card--muted">
        <p className="kerf-drill-delta-note">
          Too few reps on {drillLabel} to read a before/after shift. Run the drill once more to get
          a clearer picture.
        </p>
      </div>
    );
  }

  const { before, after, deltaPct } = drillDelta;
  const improved = deltaPct < 0;
  const regressed = deltaPct > 0;
  const modifier = improved
    ? "kerf-drill-delta-card--improved"
    : regressed
      ? "kerf-drill-delta-card--worse"
      : "kerf-drill-delta-card--flat";

  return (
    <div className={`kerf-drill-delta-card ${modifier}`}>
      <div className="kerf-drill-delta-halves">
        <div className="kerf-drill-delta-half">
          <div className="kerf-drill-delta-half-label">first half</div>
          <div className="kerf-drill-delta-half-value">{before.errorRatePct}%</div>
          <div className="kerf-drill-delta-half-meta">
            {before.errors} of {before.attempts} wrong
          </div>
        </div>
        <div className="kerf-drill-delta-arrow" aria-hidden="true">
          →
        </div>
        <div className="kerf-drill-delta-half">
          <div className="kerf-drill-delta-half-label">second half</div>
          <div className="kerf-drill-delta-half-value">{after.errorRatePct}%</div>
          <div className="kerf-drill-delta-half-meta">
            {after.errors} of {after.attempts} wrong
          </div>
        </div>
      </div>
      <p className="kerf-drill-delta-caption">
        {improved
          ? `Error rate dropped ${Math.abs(deltaPct)} percentage point${
              Math.abs(deltaPct) === 1 ? "" : "s"
            } — the drill is working.`
          : regressed
            ? `Error rate ticked up ${deltaPct} percentage point${
                deltaPct === 1 ? "" : "s"
              }. Consider a shorter next rep, or come back after a break.`
            : "Error rate held steady across both halves — solid baseline."}
      </p>
    </div>
  );
}

// --- shared presentational helpers (duplicated from PostSessionStage) ------

function ErrorReviewText({ target, errors }: { target: string; errors: readonly ErrorPosition[] }) {
  if (errors.length === 0) {
    return <>{target}</>;
  }

  const errorByIndex = new Map(errors.map((e) => [e.index, e]));
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < target.length; i++) {
    const ch = target[i]!;
    const err = errorByIndex.get(i);
    if (err) {
      nodes.push(
        <span
          key={i}
          className="kerf-error-char"
          data-expected={`typed '${err.typed}', expected '${err.expected}'`}
          tabIndex={0}
          aria-label={`Error at position ${i + 1}: typed ${err.typed}, expected ${err.expected}`}
        >
          {ch}
        </span>,
      );
    } else {
      nodes.push(ch);
    }
  }
  return <>{nodes}</>;
}

function ErrorPatterns({
  patterns,
  uniqueErrorCount,
}: {
  patterns: readonly PatternDetection[];
  uniqueErrorCount: number;
}) {
  if (patterns.length === 0) {
    return (
      <p className="kerf-error-patterns">
        {uniqueErrorCount === 0
          ? "No errors this drill — clean reps."
          : "No clear pattern yet. A few more drills will sharpen the picture."}
      </p>
    );
  }
  return (
    <p className="kerf-error-patterns">
      {patterns.map((p, i) => (
        <span key={p.kind}>
          {i > 0 ? " " : null}
          {p.evidence}
        </span>
      ))}
    </p>
  );
}
