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

/**
 * Lifecycle of a typing session.
 *
 * `paused` is a transient sub-state of an in-progress session: the clock
 * is frozen (`pausedAt !== null` and paused-ms accumulation stops) but
 * `target`, `position`, `events`, etc. are preserved. Any keypress action
 * received while paused auto-resumes and then processes the keystroke —
 * this is what lets the idle auto-pause feature "just work" when the user
 * returns to typing. Manual (Esc) pause blocks input upstream by unbinding
 * the capture listener, so auto-resume there requires an explicit resume
 * action from the UI.
 */
export type SessionStatus = "idle" | "active" | "paused" | "complete";

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
  /**
   * Wall-clock ms at which the current pause began. Non-null iff
   * `status === "paused"`. Used by `resume` to compute the slice of
   * time to fold into `pausedMs`.
   */
  pausedAt: number | null;
  /**
   * Accumulated milliseconds spent paused across all pause/resume
   * cycles this session. `summarizeSession` subtracts this from the
   * wall-clock span (`completedAt - startedAt`) so WPM reflects actual
   * typing time, not wall time including idle gaps.
   */
  pausedMs: number;
};

export type SessionAction =
  | { type: "start"; target: string; now: number }
  | { type: "keypress"; char: string; now: number }
  | { type: "backspace" }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number }
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
  pausedAt: null,
  pausedMs: 0,
});
