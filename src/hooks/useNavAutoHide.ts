import { useEffect, useState } from "react";
import { useSessionStore } from "#/stores/sessionStore";

/**
 * Monkeytype-style global nav auto-hide, per IA §5.
 *
 * The logic keys entirely off session status + keystroke activity:
 *   - Session status !== "active" → always visible. Pre-session,
 *     post-session, dashboard, every other page.
 *   - Session status === "active":
 *       • Nav starts visible (no typing yet).
 *       • First keystroke schedules a hide in 1s (the "don't vanish
 *         mid-word" grace window).
 *       • Each subsequent keystroke both re-arms the hide timer and
 *         re-arms a 3s reveal timer.
 *       • 3s without a keystroke → reveal (interpreted as a pause).
 *       • Mouse moves into the top 60px of the viewport → reveal.
 *       • Esc key → reveal. (Does not interfere with the practice
 *         route's Esc-to-pause handler; both listeners run.)
 *
 * Returns `{ hidden }` so the nav component can slap a data attribute
 * on and let CSS do the transition.
 */

const HIDE_AFTER_MS = 1000;
const PAUSE_REVEAL_MS = 3000;
const REVEAL_TOP_PX = 60;

export function useNavAutoHide(): { hidden: boolean } {
  const status = useSessionStore((s) => s.status);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // On any non-active status, snap visible and stay there. Covers
    // pre-session → active transitions (visible until first keystroke)
    // and active → complete transitions (immediately visible for the
    // post-session summary).
    if (status !== "active") {
      setHidden(false);
      return;
    }

    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let pauseTimer: ReturnType<typeof setTimeout> | undefined;

    const clearHide = () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = undefined;
      }
    };
    const clearPause = () => {
      if (pauseTimer) {
        clearTimeout(pauseTimer);
        pauseTimer = undefined;
      }
    };

    const reveal = () => {
      clearHide();
      setHidden(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        reveal();
        return;
      }
      // Ignore modifier chords — they're not "typing" in the session
      // sense (e.g. Cmd+L to focus address bar shouldn't hide the nav).
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Only printable keys count as typing activity — same rule the
      // keystroke-capture hook uses.
      if (e.key.length !== 1) return;

      clearHide();
      hideTimer = setTimeout(() => setHidden(true), HIDE_AFTER_MS);
      clearPause();
      pauseTimer = setTimeout(() => setHidden(false), PAUSE_REVEAL_MS);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (e.clientY <= REVEAL_TOP_PX) reveal();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousemove", onMouseMove);
      clearHide();
      clearPause();
    };
  }, [status]);

  return { hidden };
}
