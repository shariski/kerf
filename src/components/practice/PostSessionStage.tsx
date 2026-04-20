import { Link } from "@tanstack/react-router";
import type {
  EmergentWeakness,
  ErrorPosition,
  SessionSummary,
} from "#/domain/session/summarize";
import type { PatternDetection } from "#/domain/insight/types";

/**
 * Post-session summary stage — 1:1 port of the `.post-session` block in
 * design/practice-page-wireframe.html.
 *
 * This component is purely presentational. All derivation happens in
 * `summarizeSession` (pure domain) and `pickSummaryTitle` (pure copy).
 * The route passes in ready-to-render values.
 *
 * Phase 2 constraint still active: session history lands in Phase 3, so
 * the "improved" column in weakness shifts shows a muted placeholder
 * instead of real deltas.
 */

type Props = {
  target: string;
  title: string;
  summary: SessionSummary;
  onPracticeAgain: () => void;
};

export function PostSessionStage({
  target,
  title,
  summary,
  onPracticeAgain,
}: Props) {
  const {
    accuracyPct,
    wpm,
    elapsedLabel,
    wordCount,
    uniqueErrorCount,
    errorPositions,
    patterns,
    emergentWeaknesses,
    insightText,
    topWeaknessName,
  } = summary;

  return (
    <div className="kerf-post-session">
      <div className="kerf-post-complete-mark">
        <div className="kerf-post-complete-mark-badge">
          <span className="kerf-post-complete-mark-dot" aria-hidden="true" />
          session complete
        </div>
      </div>

      <h1 className="kerf-post-title">{title}</h1>

      <div
        className="kerf-post-stats"
        role="list"
        aria-label="Session results"
      >
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
          <div
            className="kerf-post-stat-value"
            aria-label={`Speed ${wpm} words per minute`}
          >
            {wpm}
          </div>
          <div className="kerf-post-stat-delta neutral">wpm</div>
        </div>
        <div className="kerf-post-stat" role="listitem">
          <div className="kerf-post-stat-label">time</div>
          <div
            className="kerf-post-stat-value"
            aria-label={`Time ${elapsedLabel}`}
          >
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
        <ErrorPatterns
          patterns={patterns}
          uniqueErrorCount={uniqueErrorCount}
        />
      </div>

      <div className="kerf-post-section-label">Weakness shifts this session</div>
      <div className="kerf-weakness-shifts">
        <div className="kerf-shift-group improved">
          <div className="kerf-shift-group-title">
            <span aria-hidden="true">✓</span>
            <span>improved</span>
          </div>
          <p className="kerf-shift-empty">
            Session history arrives in a future update — improvements
            will surface once this isn't your first rep on record.
          </p>
        </div>
        <div className="kerf-shift-group emergent">
          <div className="kerf-shift-group-title">
            <span aria-hidden="true">⚠</span>
            <span>watch this</span>
          </div>
          <EmergentList items={emergentWeaknesses} />
        </div>
      </div>

      <div className="kerf-insight">
        <div className="kerf-insight-label">What the engine noticed</div>
        <div className="kerf-insight-text">{insightText}</div>
      </div>

      <div className="kerf-post-actions">
        <button
          type="button"
          className="kerf-post-btn primary"
          onClick={onPracticeAgain}
          autoFocus
        >
          Practice again
          <span className="kerf-post-btn-shortcut" aria-hidden="true">⏎</span>
        </button>
        <Link
          to="/practice/drill"
          search={topWeaknessName ? { target: topWeaknessName } : undefined}
          className="kerf-post-btn secondary"
        >
          {topWeaknessName
            ? `Drill ${topWeaknessName.toUpperCase()} specifically`
            : "Drill a weakness"}
          <span className="kerf-post-btn-shortcut" aria-hidden="true">D</span>
        </Link>
        <Link to="/dashboard" className="kerf-post-btn secondary">
          View dashboard
          <span className="kerf-post-btn-shortcut" aria-hidden="true">⌘D</span>
        </Link>
      </div>
    </div>
  );
}

// --- subcomponents ---------------------------------------------------------

function ErrorReviewText({
  target,
  errors,
}: {
  target: string;
  errors: readonly ErrorPosition[];
}) {
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
          ? "No errors this session — clean rep."
          : "No clear pattern yet. A few more sessions will sharpen the picture."}
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

function EmergentList({ items }: { items: readonly EmergentWeakness[] }) {
  if (items.length === 0) {
    return (
      <p className="kerf-shift-empty">
        Nothing noteworthy surfaced this session.
      </p>
    );
  }
  return (
    <>
      {items.map((w) => (
        <div key={w.unit} className="kerf-shift-row">
          <span className="kerf-shift-pill">{w.unit}</span>
          <span>{w.reason}</span>
          <span className="kerf-shift-delta worse">
            {Math.round((w.errorCount / w.attempts) * 100)}%
          </span>
        </div>
      ))}
    </>
  );
}
