import { coachMechanismCopy } from "#/domain/coach/copy";
import type { CoachPreview } from "#/server/coach";

type Props = {
  /** null while the preview is loading or unavailable. */
  preview: CoachPreview | null;
  unavailable?: boolean;
  onStart: () => void;
};

/**
 * Highlighted Coach entry on the practice pre-session screen. Distinct from
 * the mode cards: the feature is explicitly visible (name, difference,
 * free-beta quota) but starting it just navigates into the
 * normal session flow — nothing about typing changes.
 */
export function CoachPanel({ preview, unavailable = false, onStart }: Props) {
  // `dominantMechanism` — not `report.mechanisms[0]` — is what a coach
  // session would actually target: the report's first row can be `non-alpha`,
  // which the session pipeline filters out.
  const top = preview?.report.mechanisms.find((m) => m.mechanism === preview.dominantMechanism);
  const exhausted = preview !== null && preview.quota.remaining <= 0;
  const ready = preview !== null && (preview.repeatAvailable || (!exhausted && top !== undefined));

  return (
    <section className="kerf-coach-panel" aria-label="Coach">
      <header className="kerf-coach-panel-head">
        <span className="kerf-coach-panel-name">Coach</span>
        {preview && !exhausted && <span className="kerf-mode-card-tag">free beta</span>}
      </header>

      <p className="kerf-coach-panel-desc">
        A focused passage chosen for the typing patterns you want to improve.
      </p>

      {preview === null && !unavailable && (
        <p className="kerf-coach-panel-teaser" role="status" aria-live="polite">
          Checking today's session…
        </p>
      )}
      {unavailable && (
        <p className="kerf-coach-panel-teaser" role="status">
          Coach is unavailable right now. Your other practice modes still work.
        </p>
      )}
      {preview && top && (
        <p className="kerf-coach-panel-teaser">
          Today: <strong>{coachMechanismCopy(top.mechanism).label}</strong> — {top.sharePct}% of
          your slips
          {top.topConfusions[0] && (
            <>
              , most often typing <code>{top.topConfusions[0].typedAs}</code> instead of{" "}
              <code>{top.topConfusions[0].target}</code>
            </>
          )}
        </p>
      )}
      {preview && !top && preview.repeatAvailable && (
        <p className="kerf-coach-panel-teaser">Your last Coach passage is ready to repeat.</p>
      )}
      {preview && !top && !preview.repeatAvailable && (
        <p className="kerf-coach-panel-teaser">
          Coach needs more typing data. Complete a regular practice session first.
        </p>
      )}

      <footer className="kerf-coach-actions">
        <button
          type="button"
          className="kerf-coach-btn-primary"
          onClick={onStart}
          disabled={!ready}
        >
          {exhausted && preview?.repeatAvailable ? "Repeat last passage" : "Try Coach"}
        </button>
      </footer>

      {preview && (
        <p className="kerf-coach-quota">
          {exhausted
            ? preview.repeatAvailable
              ? "Today's new sessions are used. Repeating your last passage is free."
              : "Today's new Coach sessions are used. Come back tomorrow."
            : `${preview.quota.remaining} free Coach ${preview.quota.remaining === 1 ? "session" : "sessions"} left today`}
        </p>
      )}
      <p className="kerf-coach-privacy">
        Coach sends summarized typing patterns to DeepSeek to prepare passages. No raw keystroke
        stream is sent. <a href="/privacy">Privacy details</a>
      </p>
    </section>
  );
}
