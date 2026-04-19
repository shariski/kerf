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
 *       • First keystroke schedules a hide after HIDE_AFTER_MS (short
 *         grace so the nav doesn't flash on an accidental first key).
 *         The hide timer is armed ONCE per typing burst — subsequent
 *         keystrokes do NOT push it out, otherwise continuous typing
 *         would prevent the nav from ever disappearing. (The earlier
 *         debounced version had exactly that bug.)
 *       • Each keystroke re-arms the 3s pause-reveal timer.
 *       • 3s without a keystroke → reveal (interpreted as a pause).
 *         After a reveal, the next keystroke re-arms hide from scratch.
 *       • Mouse moves into the top 60px of the viewport → reveal.
 *       • Esc key → reveal. (Does not interfere with the practice
 *         route's Esc-to-pause handler; both listeners run.)
 *
 * Returns `{ hidden }` so the nav component can slap a data attribute
 * on and let CSS do the transition.
 */

// Shorter than the original IA §5 spec's 1s — empirical testing
// showed 1s feels sluggish, as if the nav hangs on after the user
// clearly committed to typing. 300ms keeps enough grace to avoid
// flashing on an accidental first key while still reading as
// "snappy". The 3s pause-reveal window is intentionally untouched —
// that's about detecting intent, not responsiveness.
export const HIDE_AFTER_MS = 300;
export const PAUSE_REVEAL_MS = 3000;
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
    // True once the hide-after-1s timer is armed for the current typing
    // burst. Cleared on reveal so the next keystroke can arm hide again.
    let hideArmed = false;

    const clearHide = () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = undefined;
      }
      hideArmed = false;
    };
    const clearPause = () => {
      if (pauseTimer) {
        clearTimeout(pauseTimer);
        pauseTimer = undefined;
      }
    };

    const reveal = () => {
      clearHide();
      clearPause();
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

      // Arm the hide ONCE per typing burst. Do NOT debounce it — rapid
      // typing would otherwise push the hide indefinitely into the
      // future and the nav would never disappear.
      if (!hideArmed) {
        hideArmed = true;
        hideTimer = setTimeout(() => setHidden(true), HIDE_AFTER_MS);
      }
      // Any keystroke resets the pause-reveal clock. Only a 3s gap
      // between keystrokes counts as "the user stopped typing".
      clearPause();
      pauseTimer = setTimeout(reveal, PAUSE_REVEAL_MS);
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
