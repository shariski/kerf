/**
 * Renders the active exercise text with per-character status and the
 * amber expected-letter badge during errors (product-spec.md §6.1).
 *
 * Subscribes to the session store directly — the capture hook drives
 * dispatch, and React re-renders this component. A full render walks
 * the entire target (~300 chars), which is fine for typical exercises;
 * if profiling ever shows this as a hot path we can switch to per-char
 * memoization or imperative DOM mutation (see KeyboardSVG.flash() for
 * the pattern).
 */

import { useEffect } from "react";
import { useSessionStore } from "#/stores/sessionStore";
import { useKeystrokeCapture } from "#/hooks/useKeystrokeCapture";
import type { CharStatus, ActiveError } from "#/domain/session/types";

type Props = {
  target: string;
  /** When false, the amber expected-letter badge is suppressed even during
   *  errors. Users who find it noisy can turn this off in settings (Task 2.4). */
  expectedLetterHint?: boolean;
  /** When false, the keystroke hook unbinds (e.g. during pause overlay). */
  capture?: boolean;
};

export function TypingArea({
  target,
  expectedLetterHint = true,
  capture = true,
}: Props) {
  const dispatch = useSessionStore((s) => s.dispatch);
  const position = useSessionStore((s) => s.position);
  const charStatus = useSessionStore((s) => s.charStatus);
  const activeError = useSessionStore((s) => s.activeError);
  const sessionTarget = useSessionStore((s) => s.target);

  useEffect(() => {
    if (sessionTarget !== target) {
      dispatch({ type: "start", target, now: performance.now() });
    }
  }, [target, sessionTarget, dispatch]);

  useKeystrokeCapture({ enabled: capture });

  return (
    <div
      className="kerf-typing"
      role="textbox"
      aria-label="Typing exercise"
      aria-readonly="false"
      data-testid="typing-area"
    >
      {target.split("").map((ch, i) => (
        <CharSpan
          key={i}
          char={ch}
          className={classFor(i, position, charStatus[i] ?? "pending")}
          expectedBadge={
            i === position && activeError && expectedLetterHint
              ? activeError
              : null
          }
        />
      ))}
    </div>
  );
}

function CharSpan({
  char,
  className,
  expectedBadge,
}: {
  char: string;
  className: string;
  expectedBadge: ActiveError | null;
}) {
  // Render a non-breaking space so spaces have width for the current/error
  // highlight without collapsing in HTML whitespace rules.
  const display = char === " " ? "\u00A0" : char;
  return (
    <span className={className}>
      {display}
      {expectedBadge && (
        <span className="kerf-typing-expected" aria-hidden="true">
          {expectedBadge.expected === " " ? "␣" : expectedBadge.expected}
        </span>
      )}
    </span>
  );
}

function classFor(
  index: number,
  position: number,
  status: CharStatus,
): string {
  const base = "kerf-typing-char";
  if (index < position) return `${base} kerf-typing-typed`;
  if (index === position) {
    if (status === "error") return `${base} kerf-typing-error`;
    return `${base} kerf-typing-current`;
  }
  return `${base} kerf-typing-upcoming`;
}
