/**
 * Binds window keydown to the session store's dispatch.
 *
 * Deliberately thin — all behavior lives in keystrokeReducer. This hook
 * only translates raw DOM events into SessionActions:
 *   - Single printable char → { type: "keypress" }
 *   - Backspace              → { type: "backspace" }
 *   - Everything else (Tab, Shift, arrows, F-keys, Esc, etc.) → ignored
 *
 * Tab/Esc are reserved for the upcoming pause/restart overlays (Task 2.4).
 * Modifier combos (Cmd+R, Ctrl+A) are ignored so users can still refresh,
 * select, etc., without the capture hijacking those chords.
 */

import { useEffect } from "react";
import { useSessionStore } from "#/stores/sessionStore";

type Options = {
  /** When false, the hook unbinds — useful during paused/complete states. */
  enabled?: boolean;
};

export function useKeystrokeCapture({ enabled = true }: Options = {}): void {
  const dispatch = useSessionStore((s) => s.dispatch);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Let the browser and other handlers own modifier chords.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Backspace") {
        e.preventDefault();
        dispatch({ type: "backspace" });
        return;
      }

      // Printable single-char keys only. e.key is "a", " ", "A" — never
      // "Shift", "ArrowLeft", etc. for single-length strings.
      if (e.key.length === 1) {
        e.preventDefault();
        dispatch({ type: "keypress", char: e.key, now: performance.now() });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch, enabled]);
}
