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

import { Fragment, useEffect, useMemo, useRef } from "react";
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

/**
 * Grouped runs of contiguous non-space ("word") and space characters so the
 * renderer can wrap each word in an inline-block container. That makes words
 * atomic — the browser wraps between words, never mid-word — and pairs with
 * `white-space: normal` on the parent to collapse leading/trailing spaces at
 * wrap points. Typing mechanic is unchanged: every target index still maps
 * 1:1 to a char span, so position tracking and backspace work as before.
 */
type Chunk = { kind: "word" | "space"; start: number; chars: string[] };

function chunkTarget(target: string): Chunk[] {
  const chunks: Chunk[] = [];
  let current: Chunk | null = null;
  for (let i = 0; i < target.length; i++) {
    const ch = target[i]!;
    const kind: Chunk["kind"] = ch === " " ? "space" : "word";
    if (!current || current.kind !== kind) {
      current = { kind, start: i, chars: [] };
      chunks.push(current);
    }
    current.chars.push(ch);
  }
  return chunks;
}

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

  const chunks = useMemo(() => chunkTarget(target), [target]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the current line visible within the scrollable typing window
  // (Monkeytype pattern). CSS guarantees the scroll geometry snaps to
  // whole-line multiples: total height = (top-slots + text-lines) × lh,
  // padding-top = top-slots × lh, both resolved from CSS vars in
  // styles.css § .kerf-typing. With those invariants, setting
  // `scrollTop = lineIndex * lh` positions text-line k at the (top-slots +
  // 1)-th visible slot — e.g. with top-slots=1, line 0 sits as the 2nd
  // visible slot with an empty slot above for the expected-letter badge,
  // which renders above the current char. No partial "cut" lines appear at
  // any scroll position or font-size. `scroll-behavior: smooth` handles
  // the animation; `prefers-reduced-motion` overrides it in styles.css.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const current = container.querySelector<HTMLElement>(
      ".kerf-typing-current, .kerf-typing-error",
    );
    if (!current) return;
    const styles = getComputedStyle(container);
    const lineHeightPx = resolveLineHeightPx(styles);
    const paddingTopPx = parseFloat(styles.paddingTop) || 0;
    if (!Number.isFinite(lineHeightPx) || lineHeightPx <= 0) return;
    const containerRect = container.getBoundingClientRect();
    const charRect = current.getBoundingClientRect();
    const charTopInContent =
      charRect.top - containerRect.top + container.scrollTop;
    const lineIndex = Math.max(
      0,
      Math.round((charTopInContent - paddingTopPx) / lineHeightPx),
    );
    container.scrollTop = Math.max(0, lineIndex * lineHeightPx);
  }, [position]);

  return (
    <div
      ref={containerRef}
      className="kerf-typing"
      role="textbox"
      aria-label="Typing exercise"
      aria-readonly="false"
      data-testid="typing-area"
    >
      {chunks.map((chunk, ci) => {
        const charElements = chunk.chars.map((ch, offset) => {
          const index = chunk.start + offset;
          return (
            <CharSpan
              key={index}
              char={ch}
              className={classFor(index, position, charStatus[index] ?? "pending")}
              expectedBadge={
                index === position && activeError && expectedLetterHint
                  ? activeError
                  : null
              }
            />
          );
        });
        return chunk.kind === "word" ? (
          <span key={ci} className="kerf-typing-word">
            {charElements}
          </span>
        ) : (
          <Fragment key={ci}>{charElements}</Fragment>
        );
      })}
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
  return (
    <span className={className}>
      {char}
      {expectedBadge && (
        <span className="kerf-typing-expected" aria-hidden="true">
          {expectedBadge.expected === " " ? "␣" : expectedBadge.expected}
        </span>
      )}
    </span>
  );
}

/**
 * `getComputedStyle(el).lineHeight` does not always return pixels. For a
 * unitless CSS value like `line-height: 2.0`, the computed value stays a
 * multiplier string ("2"), which must be resolved against font-size. For
 * the keyword `normal`, browsers don't expose a numeric value, so we fall
 * back to the common 1.2 ratio. px values pass through unchanged.
 */
function resolveLineHeightPx(styles: CSSStyleDeclaration): number {
  const fontSize = parseFloat(styles.fontSize);
  const lh = styles.lineHeight;
  if (lh === "normal") return fontSize * 1.2;
  if (lh.endsWith("px")) return parseFloat(lh);
  return parseFloat(lh) * fontSize;
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
