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
  /** Session target-key set (from `generateSession`). Chars in this list that
   *  are still pending (not yet typed) render with a subtle color lift +
   *  font-weight bump, so the user can see upcoming focus letters in the
   *  flow of text. Orthogonal to the keyboard-SVG ivory ring — same signal,
   *  different attention surface. Typed chars never get this treatment
   *  (typed/error state colors take precedence). */
  targetKeys?: string[];
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
    // biome-ignore lint/style/noNonNullAssertion: bounded-loop index — i < target.length, so target[i] is defined.
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
  targetKeys,
}: Props) {
  const targetKeySet = useMemo(
    () => (targetKeys && targetKeys.length > 0 ? new Set(targetKeys) : null),
    [targetKeys],
  );
  const dispatch = useSessionStore((s) => s.dispatch);
  const position = useSessionStore((s) => s.position);
  const charStatus = useSessionStore((s) => s.charStatus);
  const activeError = useSessionStore((s) => s.activeError);
  const sessionTarget = useSessionStore((s) => s.target);

  useEffect(() => {
    if (sessionTarget !== target) {
      dispatch({ type: "start", target, now: performance.now(), targetKeys: [] });
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: position is the trigger — the effect re-queries the DOM for the new .kerf-typing-current/.kerf-typing-error element, which is updated elsewhere from position. Removing it would freeze the scroll-follow on first paint.
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
    const charTopInContent = charRect.top - containerRect.top + container.scrollTop;
    const lineIndex = Math.max(0, Math.round((charTopInContent - paddingTopPx) / lineHeightPx));
    container.scrollTop = Math.max(0, lineIndex * lineHeightPx);
  }, [position]);

  return (
    // biome-ignore lint/a11y/useSemanticElements: custom typing surface that renders per-char correctness highlighting; <input>/<textarea> can't render that. role="textbox" + aria-label is the canonical ARIA pattern for custom typing widgets.
    <div
      ref={containerRef}
      className="kerf-typing"
      role="textbox"
      tabIndex={0}
      aria-label="Typing exercise"
      aria-readonly="false"
      data-testid="typing-area"
    >
      {chunks.map((chunk) => {
        const charElements = chunk.chars.map((ch, offset) => {
          const index = chunk.start + offset;
          const isTargetKey = targetKeySet?.has(ch) ?? false;
          return (
            <CharSpan
              key={index}
              char={ch}
              className={classFor(index, position, charStatus[index] ?? "pending", isTargetKey)}
              expectedBadge={
                index === position && activeError && expectedLetterHint ? activeError : null
              }
            />
          );
        });
        return chunk.kind === "word" ? (
          <span key={chunk.start} className="kerf-typing-word">
            {charElements}
          </span>
        ) : (
          <Fragment key={chunk.start}>{charElements}</Fragment>
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
  isTargetKey: boolean,
): string {
  const base = "kerf-typing-char";
  // Target-key highlight only applies to chars that haven't been typed yet.
  // Once typed (typed/error state), the status color takes precedence — we
  // don't want retrospective decoration.
  const targetClass = isTargetKey ? " kerf-typing-target" : "";
  if (index < position) return `${base} kerf-typing-typed`;
  if (index === position) {
    if (status === "error") return `${base} kerf-typing-error`;
    return `${base} kerf-typing-current${targetClass}`;
  }
  return `${base} kerf-typing-upcoming${targetClass}`;
}
