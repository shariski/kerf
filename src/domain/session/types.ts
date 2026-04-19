/**
 * Session domain — state shape for an in-progress typing exercise.
 *
 * The reducer (keystrokeReducer.ts) owns this state. The Zustand store
 * (src/stores/sessionStore.ts) is a thin wrapper so the pure logic stays
 * testable without React or Zustand imports.
 *
 * KeystrokeEvent is intentionally re-exported from stats/types.ts so the
 * events buffer is directly consumable by computeStats at session end.
 */

export type { KeystrokeEvent } from "#/domain/stats/types";
import type { KeystrokeEvent } from "#/domain/stats/types";

/** Per-character display status, parallel-indexed to SessionState.target. */
export type CharStatus = "pending" | "correct" | "error";

/** Lifecycle of a typing session. */
export type SessionStatus = "idle" | "active" | "complete";

/**
 * An active error: user typed the wrong char at the current position and
 * has not yet backspaced. Drives the amber expected-letter badge in the UI.
 * Null when no error is pending.
 */
export type ActiveError = {
  expected: string;
  actual: string;
};

export type SessionState = {
  target: string;
  /** Index of the next expected char in target. Does not advance on error. */
  position: number;
  /** Status per target index. Always has length === target.length when active. */
  charStatus: CharStatus[];
  activeError: ActiveError | null;
  /** Buffered events for end-of-session persistence + stats aggregation. */
  events: KeystrokeEvent[];
  /** Wall-clock ms of last keystroke; used to compute keystrokeMs on next event. */
  lastKeystrokeAt: number | null;
  startedAt: number | null;
  completedAt: number | null;
  status: SessionStatus;
};

export type SessionAction =
  | { type: "start"; target: string; now: number }
  | { type: "keypress"; char: string; now: number }
  | { type: "backspace" }
  | { type: "reset" };

export const idleSessionState = (): SessionState => ({
  target: "",
  position: 0,
  charStatus: [],
  activeError: null,
  events: [],
  lastKeystrokeAt: null,
  startedAt: null,
  completedAt: null,
  status: "idle",
});
