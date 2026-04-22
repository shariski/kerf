/**
 * Warn before the user navigates away with an active session — Task 4.2.
 *
 * Browsers ignore any custom message these days (phishing mitigation),
 * but they still show a generic "Changes you made may not be saved"
 * dialog if the handler calls `preventDefault()` and sets `returnValue`
 * to a non-empty string. That's enough to catch the accidental close /
 * reload; we don't need our own copy here.
 *
 * Call with `enabled=true` only while a session is mid-flight — the
 * dialog is a cost (interrupts perfectly legitimate navigation), so we
 * don't want to attach it globally.
 */

import { useEffect } from "react";

export function useBeforeUnloadWarning(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Firefox needs a non-empty returnValue to show the dialog;
      // Chrome/Safari honor preventDefault alone. Set both to cover.
      event.returnValue = "unsaved";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled]);
}
