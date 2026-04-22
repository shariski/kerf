/**
 * Corner-pinned live WPM widget shown during active typing.
 *
 * Live WPM is a tail mean over the last ~5 seconds of *typing time*
 * (pauses excluded). That window typically holds 20–40 keystrokes, which
 * damps per-keystroke interval variance (±30–40% at "steady" typing)
 * into a ±2–3 wpm visible band. An EMA with a practical response time
 * still exposes per-keystroke bounce; a tail-mean with a real denominator
 * flatlines it.
 *
 * Intervals at or above PAUSE_INTERVAL_MS are dropped entirely — they
 * aren't typing, they're pauses. This keeps idle auto-pause, manual
 * (Esc) pause, and mid-session thinking breaks from dragging the
 * displayed rate down. The window measures typing time, not wall time.
 *
 * The post-session summary uses cumulative math in summarizeSession().
 * Live and final can differ — that's intentional and matches how every
 * other typing app behaves. Live answers "how fast right now", final
 * answers "how fast this session".
 *
 * Follows CLAUDE.md §B3: WPM is rendered small and subdued, never as
 * the headline stat.
 */

import { useEffect, useState } from "react";
import { useSessionStore } from "#/stores/sessionStore";
import type { KeystrokeEvent } from "#/domain/session/types";

/** Intervals ≥ this are treated as pauses and dropped from both the
 * typing-time denominator and the character count. Matches
 * IDLE_THRESHOLD_MS in useIdleAutoPause for consistency. */
const PAUSE_INTERVAL_MS = 2000;
/** Target size of the tail window, measured in *typing time*. Chosen so
 * the window holds ~25 keystrokes at 60 wpm — enough samples that the
 * standard error of the mean drops to ~6%, giving a ±3 wpm visible band
 * at steady state instead of ±10. Smaller windows feel twitchy, larger
 * ones feel sluggish on genuine speed changes. */
const WINDOW_MS = 5000;
/** Until the user has this much typing time in the buffer, show 0. With
 * <1s of samples the denominator is tiny and a single keystroke swings
 * the reading by 20+ wpm, which is the thing we're trying to avoid. */
const MIN_WINDOW_MS = 1000;
/** Clamp impossibly fast intervals (hardware key repeat, synthetic
 * events). 30ms ≈ 400 wpm which is already past human records, so
 * anything below that is almost certainly noise. */
const MIN_INTERVAL_MS = 30;

/**
 * Tail mean over the last WINDOW_MS of typing time.
 *
 * Walks events backwards from the newest, accumulating valid intervals
 * until the accumulated typing time reaches the window target. WPM is
 * then (chars counted) / (typing time, minutes) / 5 chars-per-word.
 *
 * This gives the harmonic-mean-style rate you'd get from
 * total_chars / total_time — i.e. exactly the cumulative WPM you'd
 * compute for the recent window. No EMA bias, no warmup quirk.
 */
export function computeWindowedWpm(events: KeystrokeEvent[]): number {
  if (events.length < 2) return 0;
  let chars = 0;
  let typingMs = 0;
  for (let i = events.length - 1; i >= 1; i--) {
    const cur = events[i];
    const prev = events[i - 1];
    if (!cur || !prev) continue;
    const rawDelta = cur.timestamp.getTime() - prev.timestamp.getTime();
    if (rawDelta <= 0 || rawDelta >= PAUSE_INTERVAL_MS) continue;
    const delta = Math.max(rawDelta, MIN_INTERVAL_MS);
    chars++;
    typingMs += delta;
    if (typingMs >= WINDOW_MS) break;
  }
  if (typingMs < MIN_WINDOW_MS) return 0;
  return Math.round((chars * 12_000) / typingMs);
}

type Props = {
  visible: boolean;
};

export function LiveWpm({ visible }: Props) {
  const events = useSessionStore((s) => s.events);
  const [wpm, setWpm] = useState(0);

  // Refires once per forward keystroke. During idle/pause no events are
  // appended, so no recompute → the displayed value is frozen for free.
  useEffect(() => {
    setWpm(computeWindowedWpm(events));
  }, [events]);

  return (
    <div
      className="kerf-live-wpm"
      data-visible={visible || undefined}
      aria-label={`Live speed: ${wpm} words per minute`}
      aria-live="off"
    >
      <span className="kerf-live-wpm-value">{wpm}</span>
      <span className="kerf-live-wpm-unit"> wpm</span>
    </div>
  );
}
