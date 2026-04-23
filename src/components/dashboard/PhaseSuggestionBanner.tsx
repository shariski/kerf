import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { PhaseTransitionSignal } from "#/domain/adaptive/phaseSuggestion";
import type { TransitionPhase } from "#/domain/profile/initialPhase";
import { updateTransitionPhase } from "#/server/profile";

/**
 * Dashboard top-of-page phase-transition suggestion banner (Task 3.4a).
 *
 * Surfaces the pure `suggestPhaseTransition` advisory — the domain
 * decides *whether* to suggest; this component decides *how* to
 * present. Two levers the domain deliberately doesn't own:
 *
 * 1. "Max once per session" (02-architecture.md §4.6) is enforced
 *    via `sessionStorage`, keyed on the *suggested direction* so a
 *    dismiss today doesn't silence a future opposite-direction
 *    suggestion (e.g. dismissing "graduate to refining" on Monday
 *    shouldn't silence "return to transitioning after break" in May).
 *
 * 2. Accepting the suggestion writes via `updateTransitionPhase` and
 *    invalidates the router loader so every dashboard section
 *    recomputes under the new phase — weakness coefficients, badges,
 *    formula display, and this banner itself (which will then return
 *    null because the advisory will no longer fire).
 *
 * Copy honors accuracy-first (CLAUDE.md §B3) — no hype, no exclamation
 * marks. The `reason` string already comes from the domain in that
 * register; buttons match.
 */

type Props = {
  signal: PhaseTransitionSignal | null;
  currentPhase: TransitionPhase;
};

const STORAGE_PREFIX = "kerf_phase_banner_dismissed_";

function storageKey(suggestedPhase: TransitionPhase): string {
  return `${STORAGE_PREFIX}${suggestedPhase}`;
}

function readDismissed(suggestedPhase: TransitionPhase): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(storageKey(suggestedPhase)) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(suggestedPhase: TransitionPhase): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(suggestedPhase), "1");
  } catch {
    // Private-mode browsers etc. — silent: worst case the user sees
    // the banner a second time this session.
  }
}

function verbForDirection(current: TransitionPhase, suggested: TransitionPhase): string {
  if (current === "transitioning" && suggested === "refining") {
    return "Switch to refining";
  }
  if (current === "refining" && suggested === "transitioning") {
    return "Return to transitioning";
  }
  return `Switch to ${suggested}`;
}

export function PhaseSuggestionBanner({ signal, currentPhase }: Props) {
  // `dismissed` starts true during SSR / initial client render so the
  // banner doesn't flash-then-hide on a user who already dismissed it
  // this session. The effect below flips it false if storage is empty.
  const [dismissed, setDismissed] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!signal) return;
    setDismissed(readDismissed(signal.suggestedPhase));
  }, [signal]);

  if (!signal || dismissed) return null;

  const handleAccept = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await updateTransitionPhase({ data: { phase: signal.suggestedPhase } });
      // Re-run the dashboard loader under the new phase. The banner
      // will unmount on the next render because the advisory no longer
      // fires (currentPhase now matches the old suggestedPhase).
      await router.invalidate();
    } catch (err) {
      setSubmitting(false);
      setSubmitError(
        err instanceof Error ? err.message : "Could not switch phase — try again in a moment.",
      );
    }
  };

  const handleDismiss = () => {
    writeDismissed(signal.suggestedPhase);
    setDismissed(true);
  };

  return (
    <aside className="kerf-dash-phase-banner" role="region" aria-label="Phase suggestion">
      <div className="kerf-dash-phase-banner-body">
        <span className="kerf-dash-phase-banner-label">Phase suggestion</span>
        <p className="kerf-dash-phase-banner-reason">{signal.reason}</p>
        {submitError ? (
          <p className="kerf-dash-phase-banner-error" role="alert">
            {submitError}
          </p>
        ) : null}
      </div>
      <div className="kerf-dash-phase-banner-actions">
        <button
          type="button"
          className="kerf-dash-phase-banner-btn kerf-dash-phase-banner-btn--primary"
          onClick={handleAccept}
          disabled={submitting}
        >
          {submitting ? "Switching…" : verbForDirection(currentPhase, signal.suggestedPhase)}
        </button>
        <button
          type="button"
          className="kerf-dash-phase-banner-btn kerf-dash-phase-banner-btn--secondary"
          onClick={handleDismiss}
          disabled={submitting}
        >
          Not yet
        </button>
      </div>
    </aside>
  );
}
