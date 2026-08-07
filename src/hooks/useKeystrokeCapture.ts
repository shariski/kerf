/**
 * Binds window keydown to the session store's dispatch.
 *
 * Deliberately thin — all behavior lives in keystrokeReducer. This hook
 * only translates raw DOM events into SessionActions:
 *   - Single printable char → { type: "keypress" }
 *   - Backspace              → { type: "backspace" }
 *   - Shift+Tab              → { type: "skip" } — advance past a target
 *     char the user's keyboard cannot produce (smart quotes, em dashes,
 *     accented letters, …). Plain Tab stays reserved for the restart
 *     bindings in the practice/drill/coach routes (they exclude shiftKey).
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

      // Shift+Tab: skip the current target char. Shift is deliberately NOT
      // excluded here — the routes' plain-Tab restart bindings already
      // return early on shiftKey, so this chord is free.
      if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "skip" });
        return;
      }

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
