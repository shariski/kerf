import { PostSessionStage } from "#/components/practice";
import type { SessionSummary } from "#/domain/session/summarize";
import type { MechanismPerformance } from "#/domain/coach/mechanismPerformance";
import type { MechanismKey } from "#/domain/coach/mechanisms";

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
}: Props) {
  const targeted = mechanismPerformance.find((p) => p.mechanism === targetedMechanism);
  const top = mechanismPerformance[0];

  return (
    <div className="kerf-coach-post">
      {targetedMechanism && (
        <section className="kerf-coach-post-intent" aria-label="Session target echo">
          <p className="kerf-coach-post-intent-line">
            Targeted: <strong>{targetedMechanism}</strong> transitions
          </p>
          {targeted && (
            <p className="kerf-coach-post-intent-result">
              {targeted.errors} of {targeted.attempts} {targetedMechanism} transitions had errors (
              {Math.round(targeted.errorRate * 100)}%).
            </p>
          )}
          {top && top.mechanism !== targetedMechanism && (
            <p className="kerf-coach-post-intent-other">
              Also this session: {top.mechanism} — {top.errors} errors in {top.attempts}{" "}
              transitions.
            </p>
          )}
        </section>
      )}

      <PostSessionStage
        target={target}
        title="Session complete."
        summary={summary}
        onPracticeAgain={onAgain}
      />

      <footer className="kerf-coach-actions">
        <button type="button" className="kerf-coach-subscribe" disabled>
          <span>Subscribe</span>
          <span className="kerf-mode-card-tag">coming soon</span>
        </button>
      </footer>
      <p className="kerf-coach-quota">
        {quota.remaining > 0
          ? `Free: ${quota.remaining} more ${quota.remaining === 1 ? "session" : "sessions"} today · Subscribe for more`
          : "Free: today's session used · Subscribe for more"}
      </p>
    </div>
  );
}
