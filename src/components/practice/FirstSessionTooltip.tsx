/**
 * One-shot hint pinned above the typing area on the first-ever session
 * for a profile. Task 4.1 — "onboarding tooltip in typing area".
 *
 * Auto-dismisses after the user has typed a handful of characters — at
 * that point they've got the hang of the typing flow and the tooltip
 * is in the way. A close button is also offered for users who want it
 * gone immediately.
 *
 * Copy honors CLAUDE.md §B3: accuracy-first framing, no hype, no
 * exclamation marks. Mentions backspace explicitly because the typing
 * area does NOT auto-advance on error — a beginner who hasn't read
 * docs can easily be stuck wondering why they can't move forward
 * after a typo.
 */

import { useState } from "react";
import { useSessionStore } from "#/stores/sessionStore";

const AUTO_DISMISS_AT_POSITION = 6;

export function FirstSessionTooltip() {
  const position = useSessionStore((s) => s.position);
  const [manuallyDismissed, setManuallyDismissed] = useState(false);

  const hidden = manuallyDismissed || position >= AUTO_DISMISS_AT_POSITION;

  return (
    <div
      className="kerf-first-session-tip"
      data-hidden={hidden || undefined}
      role="note"
      aria-live="polite"
    >
      <span className="kerf-first-session-tip-icon" aria-hidden>
        ◷
      </span>
      <span className="kerf-first-session-tip-text">
        Type at your pace. We're watching accuracy, not speed — backspace to
        fix mistakes as you go.
      </span>
      <button
        type="button"
        className="kerf-first-session-tip-dismiss"
        onClick={() => setManuallyDismissed(true)}
        aria-label="Dismiss tip"
      >
        ×
      </button>
    </div>
  );
}
