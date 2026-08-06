import type { MechanismKey } from "#/domain/coach/mechanisms";
import type { WhyReport } from "#/domain/coach/whyReport";
import type { PassageRecord } from "#/server/coach/catalog";

type Props = {
  report: WhyReport;
  /** The mechanism the passage was generated for — may differ from the
      report's first row, which can be `non-alpha`. */
  targetMechanism: MechanismKey;
  quota: { usedToday: number; remaining: number };
  passage: PassageRecord;
  onStart: () => void;
};

/**
 * Coach briefing — Stage 1 of the deliberate-practice loop. Declares the
 * target (mechanism), the why (evidence), the attention directive, and the
 * exercise (passage title). Flat copy, no verdicts.
 */
export function CoachPreSessionStage({ report, targetMechanism, quota, passage, onStart }: Props) {
  const top = report.mechanisms.find((m) => m.mechanism === targetMechanism);

  return (
    <section className="kerf-coach-pre" aria-label="Coach session briefing">
      <h2 className="kerf-coach-title">Coach</h2>
      <p className="kerf-coach-subtitle">
        A passage generated for you personally, built around how you actually type.
      </p>

      {top ? (
        <div className="kerf-coach-brief">
          <p className="kerf-coach-mechanism">
            <strong>{top.mechanism}</strong> — {top.sharePct}% of your slips, averaging {top.avgMs}
            ms per keystroke.
          </p>
          {top.topConfusions[0] && (
            <p className="kerf-coach-detail">
              Most common: typed <code>{top.topConfusions[0].typedAs}</code> instead of{" "}
              <code>{top.topConfusions[0].target}</code> ({top.topConfusions[0].count} times).
            </p>
          )}
          <p className="kerf-coach-notice">
            What to notice: <strong>{top.mechanism}</strong> transitions as you type.
          </p>
          <p className="kerf-coach-passage">
            Today's passage: <strong>{passage.title}</strong> · {passage.wordCount} words
          </p>
        </div>
      ) : (
        <p className="kerf-coach-mechanism">Not enough data yet to diagnose your typing.</p>
      )}

      <footer className="kerf-coach-actions">
        {/* Never gated on remaining quota: reaching this stage means the
            passage below is already today's allocation. Genuine exhaustion
            fails earlier, in the route's fetch. */}
        <button type="button" className="kerf-coach-btn-primary" onClick={onStart}>
          Start coach session
        </button>
        <button type="button" className="kerf-coach-subscribe" disabled>
          <span>Subscribe</span>
          <span className="kerf-mode-card-tag">coming soon</span>
        </button>
      </footer>

      <p className="kerf-coach-quota">
        {quota.remaining > 0
          ? `Free: ${quota.remaining} more ${quota.remaining === 1 ? "session" : "sessions"} today · Subscribe for more`
          : "Free: this is today's session · Subscribe for more"}
      </p>
    </section>
  );
}
