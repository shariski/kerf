import { useState } from "react";
import { PostSessionStage } from "#/components/practice";
import { coachMechanismCopy } from "#/domain/coach/copy";
import type { MechanismPerformance } from "#/domain/coach/mechanismPerformance";
import type { MechanismKey } from "#/domain/coach/mechanisms";
import type { SessionSummary } from "#/domain/session/summarize";

type Props = {
  target: string;
  summary: SessionSummary;
  /** Per-mechanism error rates measured on this session's events. */
  mechanismPerformance: MechanismPerformance[];
  /** The mechanism this passage targeted (Stage 1 echo). Null when the
      session was resumed without a briefing. */
  targetedMechanism: MechanismKey | null;
  quota: { usedToday: number; remaining: number };
  onAgain: () => void;
  onFeedback: (useful: boolean) => Promise<void>;
};

/**
 * Coach evaluation — Stage 3 of the deliberate-practice loop. Echoes the
 * declared target (mechanism), shows how the passage performed on it, and
 * states the daily-session state. No verdicts: numbers only.
 */
export function CoachPostSessionStage({
  target,
  summary,
  mechanismPerformance,
  targetedMechanism,
  quota,
  onAgain,
  onFeedback,
}: Props) {
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [feedbackError, setFeedbackError] = useState(false);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const targeted = mechanismPerformance.find((p) => p.mechanism === targetedMechanism);
  const top = mechanismPerformance[0];
  const focus = targetedMechanism ? coachMechanismCopy(targetedMechanism) : null;

  return (
    <div className="kerf-coach-post">
      {targetedMechanism && (
        <section className="kerf-coach-post-intent" aria-label="Session target echo">
          <p className="kerf-coach-post-intent-line">
            Focus: <strong>{focus?.label}</strong>
          </p>
          {targeted && (
            <p className="kerf-coach-post-intent-result">
              {targeted.errors} of {targeted.attempts} focused transitions had errors (
              {Math.round(targeted.errorRate * 100)}%).
            </p>
          )}
          {focus && <p className="kerf-coach-post-intent-other">Next cue: {focus.tip}</p>}
          {top && top.mechanism !== targetedMechanism && (
            <p className="kerf-coach-post-intent-other">
              Also this session: {coachMechanismCopy(top.mechanism).label} — {top.errors} errors in{" "}
              {top.attempts} transitions.
            </p>
          )}
        </section>
      )}

      <PostSessionStage
        target={target}
        title="Session complete."
        summary={summary}
        onPracticeAgain={onAgain}
        practiceAgainLabel={quota.remaining > 0 ? "Next Coach passage" : "Repeat this passage"}
        showWeaknessShifts={false}
      />

      <section className="kerf-coach-feedback" aria-label="Coach feedback">
        <p>Was this passage useful for your practice?</p>
        {feedback === null ? (
          <div className="kerf-coach-actions">
            {[true, false].map((useful) => (
              <button
                key={String(useful)}
                type="button"
                className="kerf-coach-btn-primary"
                disabled={feedbackSaving}
                onClick={async () => {
                  setFeedbackSaving(true);
                  setFeedbackError(false);
                  try {
                    await onFeedback(useful);
                    setFeedback(useful);
                  } catch {
                    setFeedbackError(true);
                  } finally {
                    setFeedbackSaving(false);
                  }
                }}
              >
                {useful ? "Yes" : "Not yet"}
              </button>
            ))}
          </div>
        ) : (
          <p role="status">Thanks — your feedback is saved.</p>
        )}
        {feedbackError && <p role="alert">Feedback could not be saved. Please try again.</p>}
      </section>

      <p className="kerf-coach-quota">
        {quota.remaining > 0
          ? `Free beta · ${quota.remaining} more ${quota.remaining === 1 ? "session" : "sessions"} today`
          : "Free beta · new sessions reset tomorrow (UTC)"}
      </p>
    </div>
  );
}
