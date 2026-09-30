import { coachMechanismCopy } from "#/domain/coach/copy";
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
  const focus = coachMechanismCopy(targetMechanism);

  return (
    <section className="kerf-coach-pre" aria-label="Coach session briefing">
      <h2 className="kerf-coach-title">Coach</h2>
      <p className="kerf-coach-subtitle">
        A focused passage chosen for your current typing pattern.
      </p>

      {top ? (
        <div className="kerf-coach-brief">
          <p className="kerf-coach-mechanism">
            <strong>{focus.label}</strong> — {top.sharePct}% of your recent slips.
          </p>
          {top.topConfusions[0] && (
            <p className="kerf-coach-detail">
              Most common: typed <code>{top.topConfusions[0].typedAs}</code> instead of{" "}
              <code>{top.topConfusions[0].target}</code> ({top.topConfusions[0].count} times).
            </p>
          )}
          <p className="kerf-coach-notice">
            What to notice: <strong>{focus.tip}</strong>
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
          Start this passage
        </button>
      </footer>

      <p className="kerf-coach-quota">
        {quota.remaining > 0
          ? `Free beta · ${quota.remaining} more ${quota.remaining === 1 ? "session" : "sessions"} today`
          : "Free beta · repeat this passage whenever you like"}
      </p>
    </section>
  );
}
