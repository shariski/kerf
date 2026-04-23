/**
 * Subscribes to new session events and pulses a color flash on the
 * KeyboardSVG for each keystroke.
 *
 * Flash uses the imperative `flash(char, status)` handle rather than React
 * state so the feedback round-trip stays under the 16ms budget spec'd in
 * docs/02-architecture.md §3. React state would trigger a re-render of the
 * keyboard (60 keys × children), which jitters the typing hot path.
 *
 * We track the previously-seen event count in a ref: when the count grows,
 * we read the latest event from the store directly and flash it. When the
 * count shrinks (session restart emits fresh events array), we reset the
 * marker so the first keystroke of the next session flashes too.
 */

import { useEffect, useRef, type RefObject } from "react";
import { sessionStore, useSessionStore } from "#/stores/sessionStore";
import type { KeyboardSVGHandle } from "#/components/keyboard";

export function useFlashKeyboardOnKeypress(ref: RefObject<KeyboardSVGHandle | null>): void {
  const eventsLength = useSessionStore((s) => s.events.length);
  const prevLength = useRef(0);

  useEffect(() => {
    if (eventsLength === 0) {
      prevLength.current = 0;
      return;
    }
    if (eventsLength <= prevLength.current) {
      prevLength.current = eventsLength;
      return;
    }
    const events = sessionStore.getState().events;
    const last = events[events.length - 1];
    if (last && ref.current) {
      ref.current.flash(last.actualChar, last.isError ? "error" : "correct");
    }
    prevLength.current = eventsLength;
  }, [eventsLength, ref]);
}
