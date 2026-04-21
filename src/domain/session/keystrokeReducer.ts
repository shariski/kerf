/**
 * Pure state machine for a typing session. No React, no Zustand, no DOM.
 *
 * The session store (src/stores/sessionStore.ts) wraps this reducer, and
 * the capture hook (src/hooks/useKeystrokeCapture.ts) dispatches actions
 * into the store. Unit-tested in isolation — see keystrokeReducer.test.ts.
 *
 * Invariants (enforced by the tests):
 *   1. On error, position does not advance; activeError holds the pending badge.
 *   2. Once activeError is set, it latches: every further keypress is recorded
 *      as another error attempt (even if it matches the target char). Only
 *      backspace clears it. See docs/01-product-spec.md §204, 03-task-
 *      breakdown.md §287, 06-design-summary.md §324 — the user must backspace
 *      to correct an error; typing the right letter does not auto-fix it.
 *   3. Backspace only clears an activeError — never rewinds correct history.
 *   4. KeystrokeEvent emitted for every target-key attempt (correct or error),
 *      never for backspace. Shape matches computeStats's consumer contract.
 *   5. prevChar resets to undefined across word boundaries (spaces).
 *   6. `startedAt` is null between "start" and the first character keystroke
 *      — Monkeytype-style: the clock begins when the user actually types,
 *      not when the session is primed. Idle time between "ready" and first
 *      keypress must not inflate elapsed or deflate WPM.
 *      Modifier-only keys (Shift, Caps Lock, Arrows, etc.) never reach the
 *      reducer; useKeystrokeCapture filters them at `e.key.length === 1`.
 */

import type {
  KeystrokeEvent,
  SessionAction,
  SessionState,
} from "./types";
import { idleSessionState } from "./types";

export function keystrokeReducer(
  state: SessionState,
  action: SessionAction,
): SessionState {
  switch (action.type) {
    case "start":
      return {
        target: action.target,
        position: 0,
        charStatus: Array.from({ length: action.target.length }, () => "pending"),
        activeError: null,
        events: [],
        // Null until the first real keystroke lands — the "keypress" branch
        // sets both on demand. See invariant #6.
        lastKeystrokeAt: null,
        startedAt: null,
        completedAt: null,
        status: "active",
      };

    case "reset":
      return idleSessionState();

    case "backspace": {
      if (state.status !== "active" || state.activeError === null) return state;
      const charStatus = [...state.charStatus];
      charStatus[state.position] = "pending";
      return { ...state, activeError: null, charStatus };
    }

    case "keypress": {
      if (state.status !== "active") return state;

      // First real keystroke starts the clock (invariant #6). `??` covers
      // both "fresh session, startedAt still null" and "already started"
      // in one line.
      const sessionStartedAt = state.startedAt ?? action.now;

      const targetChar = state.target[state.position]!;
      // Error latches until backspace: once we're in an error state, any
      // further keypress stays an error even if it matches the target char.
      const isError = action.char !== targetChar || state.activeError !== null;
      const keystrokeMs =
        state.lastKeystrokeAt === null ? 0 : action.now - state.lastKeystrokeAt;
      const event: KeystrokeEvent = {
        targetChar,
        actualChar: action.char,
        isError,
        keystrokeMs,
        prevChar: prevCharFor(state.target, state.position),
        timestamp: new Date(action.now),
      };

      if (isError) {
        const charStatus = [...state.charStatus];
        charStatus[state.position] = "error";
        return {
          ...state,
          charStatus,
          activeError: { expected: targetChar, actual: action.char },
          events: [...state.events, event],
          lastKeystrokeAt: action.now,
          startedAt: sessionStartedAt,
        };
      }

      // Correct keystroke — advance.
      const charStatus = [...state.charStatus];
      charStatus[state.position] = "correct";
      const nextPosition = state.position + 1;
      const isComplete = nextPosition === state.target.length;
      return {
        ...state,
        charStatus,
        activeError: null,
        position: nextPosition,
        events: [...state.events, event],
        lastKeystrokeAt: action.now,
        startedAt: sessionStartedAt,
        completedAt: isComplete ? action.now : state.completedAt,
        status: isComplete ? "complete" : "active",
      };
    }
  }
}

function prevCharFor(target: string, position: number): string | undefined {
  if (position === 0) return undefined;
  const prev = target[position - 1];
  if (prev === " ") return undefined;
  return prev;
}
