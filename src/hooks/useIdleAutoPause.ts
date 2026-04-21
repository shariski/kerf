/**
 * Idle auto-pause — freezes the session clock after the user has stopped
 * typing for `IDLE_THRESHOLD_MS`.
 *
 * Design choices:
 *
 * - **Retroactive `pausedAt`.** When the watchdog notices the user has
 *   been idle for longer than the threshold, it dispatches a `pause`
 *   action with `now = lastKeystrokeAt + IDLE_THRESHOLD_MS`, not
 *   `performance.now()`. This means the first `IDLE_THRESHOLD_MS` of
 *   inactivity counts as normal thinking time (not every gap is a
 *   "pause"), and only time beyond the threshold gets subtracted from
 *   elapsed. Matches the mental model most typing platforms use.
 *
 * - **Polling, not `setTimeout` per keystroke.** Using an interval keeps
 *   us decoupled from the keystroke dispatcher: this hook doesn't have
 *   to hook into the capture path. 500ms tick is well inside the 2s
 *   threshold's tolerance.
 *
 * - **Auto-resume is the reducer's job.** On the next keypress, the
 *   reducer folds the paused slice into `pausedMs` and continues. This
 *   hook doesn't need a separate resume watcher.
 */

import { useEffect } from "react";
import { sessionStore } from "#/stores/sessionStore";

/**
 * Threshold after which a gap between keystrokes is treated as a pause.
 * Chosen at 2s because at 40 WPM a single char takes ~300ms; 2s is
 * already ~6x typical keystroke time, well past normal inter-word
 * thinking. Longer thresholds (e.g. 5s) leave too much idle time
 * accruing into elapsed — the WPM underscoring problem the user raised.
 */
export const IDLE_THRESHOLD_MS = 2000;

const TICK_MS = 500;

export function useIdleAutoPause(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      const state = sessionStore.getState();
      if (state.status !== "active") return;
      if (state.lastKeystrokeAt === null) return;
      const idleMs = performance.now() - state.lastKeystrokeAt;
      if (idleMs < IDLE_THRESHOLD_MS) return;
      state.dispatch({
        type: "pause",
        now: state.lastKeystrokeAt + IDLE_THRESHOLD_MS,
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [enabled]);
}
