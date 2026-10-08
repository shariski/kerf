import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { CodeSessionSummary } from "#/domain/codePractice/session";
import type { ErrorPosition } from "#/domain/session/summarize";

type FocusEvidence = { attempts: number; errors: number; accuracyPct: number | null };

type Props = {
  target: string;
  languageLabel: string;
  focusLabel: string;
  summary: CodeSessionSummary;
  evidence: FocusEvidence;
  errors: readonly ErrorPosition[];
  tabCount: number;
  saveStatus: "idle" | "saving" | "saved" | "error";
  onRetrySave: () => void;
  onContinue: () => void;
  onDrillFocus: () => void;
  onViewDashboard: () => void;
};

/** Coding data in the same review frame and keyboard interaction as Keyboard practice. */
export function CodePostSessionStage({
  target,
  languageLabel,
  focusLabel,
  summary,
  evidence,
  errors,
  tabCount,
  saveStatus,
  onRetrySave,
  onContinue,
  onDrillFocus,
  onViewDashboard,
}: Props) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    primaryRef.current?.focus({ preventScroll: true });
  }, []);

  const [showScrollHint, setShowScrollHint] = useState(false);
  const canLeave = saveStatus === "saved" || saveStatus === "error";
  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max < 40) {
        setShowScrollHint(false);
        return;
      }
      const threshold = Math.min(Math.round(window.innerHeight * 0.5), Math.round(max * 0.5));
      setShowScrollHint(scrolled < threshold);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let gPending = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;
    const clearGPending = () => {
      gPending = false;
      if (gTimer) {
        clearTimeout(gTimer);
        gTimer = null;
      }
    };
    const onKey = (event: KeyboardEvent) => {
      const targetEl = event.target as HTMLElement | null;
      const tag = targetEl?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA" || targetEl?.isContentEditable === true;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
        if (event.altKey || event.shiftKey) return;
        clearGPending();
        event.preventDefault();
        if (canLeave) onViewDashboard();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || inField) return;
      const isKeyG = event.code === "KeyG";
      if (!isKeyG) clearGPending();
      if (event.key === "Enter") {
        event.preventDefault();
        if (canLeave) onContinue();
        return;
      }
      if (event.code === "KeyD") {
        event.preventDefault();
        if (canLeave) onDrillFocus();
        return;
      }
      if (isKeyG && event.shiftKey) {
        event.preventDefault();
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
        return;
      }
      if (isKeyG && !event.shiftKey) {
        if (gPending) {
          clearGPending();
          event.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          gPending = true;
          gTimer = setTimeout(() => {
            gPending = false;
            gTimer = null;
          }, 600);
        }
        return;
      }
      if (event.shiftKey) return;
      const step = Math.round(window.innerHeight * 0.4);
      if (event.code === "KeyJ") {
        event.preventDefault();
        window.scrollBy({ top: step, behavior: "smooth" });
      } else if (event.code === "KeyK") {
        event.preventDefault();
        window.scrollBy({ top: -step, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [canLeave, onContinue, onDrillFocus, onViewDashboard]);

  const uniqueErrorCount = errors.length;
  const elapsedSeconds = Math.round(summary.elapsedMs / 1000);
  const elapsedLabel = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}`;
  const insight =
    summary.totalErrors === 0
      ? "No corrections were needed in this example. Keep the same careful pace in the next run."
      : evidence.errors > 0
        ? evidence.errors +
          " of " +
          evidence.attempts +
          " focused keypresses needed correction. Review the marked code before another focused run."
        : "The corrections in this run were outside your chosen focus. Review the marked code before moving on.";

  return (
    <div className="kerf-post-session">
      <div className="kerf-post-complete-mark">
        <div className="kerf-post-complete-mark-badge">
          <span className="kerf-post-complete-mark-dot" aria-hidden="true" />
          session complete
        </div>
      </div>

      <h1 className="kerf-post-title">See what this session revealed.</h1>

      <section className="kerf-intent-echo" aria-label="Intent recap">
        <div className="kerf-intent-echo-block">
          <div className="kerf-intent-echo-eyebrow">you targeted</div>
          <div className="kerf-intent-echo-target">
            {focusLabel} · {languageLabel}
          </div>
        </div>
        {evidence.accuracyPct !== null && (
          <div className="kerf-intent-echo-block">
            <div className="kerf-intent-echo-eyebrow">how it went on that focus</div>
            <div className="kerf-intent-echo-target">
              {evidence.accuracyPct}% across {evidence.attempts} focused keypresses
            </div>
          </div>
        )}
      </section>

      <ul className="kerf-post-stats" aria-label="Coding session results">
        <li className="kerf-post-stat">
          <div className="kerf-post-stat-label">accuracy</div>
          <div className="kerf-post-stat-value featured">{summary.accuracyPct}%</div>
          <div className="kerf-post-stat-delta neutral">
            {uniqueErrorCount === 0
              ? "clean run"
              : `${uniqueErrorCount} error${uniqueErrorCount === 1 ? "" : "s"}`}
          </div>
        </li>
        <li className="kerf-post-stat">
          <div className="kerf-post-stat-label">symbol accuracy</div>
          <div className="kerf-post-stat-value">
            {summary.symbolAccuracyPct === null ? "—" : `${summary.symbolAccuracyPct}%`}
          </div>
          <div className="kerf-post-stat-delta neutral">{summary.wpm} Coding WPM</div>
        </li>
        <li className="kerf-post-stat">
          <div className="kerf-post-stat-label">time</div>
          <div className="kerf-post-stat-value">{elapsedLabel}</div>
          <div className="kerf-post-stat-delta neutral">
            {tabCount} Tab indentation{tabCount === 1 ? "" : "s"}
          </div>
        </li>
      </ul>

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
        <div className="kerf-error-review-text kerf-code-error-review-text">
          <CodeErrorReviewText target={target} errors={errors} />
        </div>
        <p className="kerf-error-patterns">
          {uniqueErrorCount === 0
            ? "No errors this session — clean rep."
            : "No clear pattern yet. A few more sessions will sharpen the picture."}
        </p>
      </div>

      <div className="kerf-insight">
        <div className="kerf-insight-label">What the engine noticed</div>
        <div className="kerf-insight-text">{insight}</div>
      </div>

      {saveStatus === "saving" && (
        <span className="sr-only" role="status">
          Saving this session…
        </span>
      )}
      {saveStatus === "error" && (
        <div className="kerf-code-review-error" role="alert">
          <span>Could not save this session.</span>
          <button type="button" className="kerf-code-review-retry" onClick={onRetrySave}>
            Retry save
          </button>
        </div>
      )}

      <div className="kerf-post-actions">
        <button
          type="button"
          className="kerf-post-btn primary"
          disabled={!canLeave}
          onClick={onContinue}
          ref={primaryRef}
        >
          {saveStatus === "saving" ? "Saving session…" : "Continue practice"}
          <span className="kerf-post-btn-shortcut" aria-hidden="true">
            ⏎
          </span>
        </button>
        <button
          type="button"
          className="kerf-post-btn secondary"
          disabled={!canLeave}
          onClick={onDrillFocus}
        >
          Practice {focusLabel} specifically
          <span className="kerf-post-btn-shortcut" aria-hidden="true">
            D
          </span>
        </button>
        <Link
          to="/dashboard"
          className="kerf-post-btn secondary"
          aria-disabled={!canLeave}
          onClick={(event) => {
            if (!canLeave) event.preventDefault();
          }}
        >
          View dashboard
          <span className="kerf-post-btn-shortcut" aria-hidden="true">
            ⌘D
          </span>
        </Link>
      </div>

      <div
        className="kerf-post-floating-scroll-hint"
        data-visible={showScrollHint || undefined}
        aria-hidden="true"
      >
        <span className="kerf-post-floating-scroll-hint-chevron">↓</span>
      </div>

      <div className="kerf-post-hint-strip" aria-hidden="true">
        <div className="kerf-post-hint-item">
          <kbd>j</kbd>
          <span>scroll down</span>
        </div>
        <div className="kerf-post-hint-item">
          <kbd>k</kbd>
          <span>scroll up</span>
        </div>
        <div className="kerf-post-hint-item">
          <kbd>gg</kbd>
          <span>top</span>
        </div>
        <div className="kerf-post-hint-item">
          <kbd>G</kbd>
          <span>bottom</span>
        </div>
        <div className="kerf-post-hint-divider" />
        <div className="kerf-post-hint-item">
          <kbd>↵</kbd>
          <span>continue practice</span>
        </div>
        <div className="kerf-post-hint-item">
          <kbd>D</kbd>
          <span>focus</span>
        </div>
        <div className="kerf-post-hint-item">
          <kbd>⌘</kbd>
          <span className="sep">+</span>
          <kbd>D</kbd>
          <span>dashboard</span>
        </div>
      </div>
    </div>
  );
}

function CodeErrorReviewText({
  target,
  errors,
}: {
  target: string;
  errors: readonly ErrorPosition[];
}) {
  if (errors.length === 0) return <>{target}</>;
  const errorByIndex = new Map(errors.map((error) => [error.index, error]));
  const nodes: React.ReactNode[] = [];
  for (let index = 0; index < target.length; index++) {
    const char = target[index];
    if (char === undefined) continue;
    const error = errorByIndex.get(index);
    if (error) {
      const shown = char === " " ? "␣" : char === "\n" ? "↵\n" : char;
      nodes.push(
        <button
          type="button"
          key={index}
          className="kerf-error-char"
          data-expected={`typed '${error.typed}', expected '${error.expected}'`}
          aria-label={
            "Error at position " +
            (index + 1) +
            ": typed " +
            error.typed +
            ", expected " +
            error.expected
          }
        >
          {shown}
        </button>,
      );
    } else {
      nodes.push(char);
    }
  }
  return <>{nodes}</>;
}
