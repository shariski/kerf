import type { CoachPreview } from "#/server/coach";

type Props = {
  /** null while the preview is loading or unavailable. */
  preview: CoachPreview | null;
  onStart: () => void;
};

/**
 * Highlighted Coach entry on the practice pre-session screen. Distinct from
 * the mode cards: the feature is explicitly visible (name, difference,
 * quota state, subscribe path) but starting it just navigates into the
 * normal session flow — nothing about typing changes.
 */
export function CoachPanel({ preview, onStart }: Props) {
  // `dominantMechanism` — not `report.mechanisms[0]` — is what a coach
  // session would actually target: the report's first row can be `non-alpha`,
  // which the session pipeline filters out.
  const top = preview?.report.mechanisms.find((m) => m.mechanism === preview.dominantMechanism);
  const exhausted = preview !== null && preview.quota.remaining <= 0;

  return (
    <section className="kerf-coach-panel" aria-label="Coach">
      <header className="kerf-coach-panel-head">
        <span className="kerf-coach-panel-name">Coach</span>
        {preview && !exhausted && <span className="kerf-mode-card-tag">free session</span>}
      </header>

      <p className="kerf-coach-panel-desc">
        A passage generated for you personally, built around how you actually type.
      </p>

      {preview === null && (
        <p className="kerf-coach-panel-teaser" role="status" aria-live="polite">
          Checking today's session…
        </p>
      )}
      {preview && top && (
        <p className="kerf-coach-panel-teaser">
          Today: <strong>{top.mechanism}</strong> — {top.sharePct}% of your slips
          {top.topConfusions[0] && (
            <>
              , most often typing <code>{top.topConfusions[0].typedAs}</code> instead of{" "}
              <code>{top.topConfusions[0].target}</code>
            </>
          )}
        </p>
      )}
      {preview && !top && (
        <p className="kerf-coach-panel-teaser">Not enough data yet to diagnose your typing.</p>
      )}

      <footer className="kerf-coach-actions">
        <button
          type="button"
          className="kerf-coach-btn-primary"
          onClick={onStart}
          disabled={exhausted}
        >
          Start coach session
        </button>
        <button type="button" className="kerf-coach-subscribe" disabled>
          <span>Subscribe</span>
          <span className="kerf-mode-card-tag">coming soon</span>
        </button>
      </footer>

      {preview && (
        <p className="kerf-coach-quota">
          {exhausted
            ? "Free: today's session used · Subscribe for more"
            : `Free: ${preview.quota.remaining} ${preview.quota.remaining === 1 ? "session" : "sessions"} available today · Subscribe for more`}
        </p>
      )}
    </section>
  );
}
