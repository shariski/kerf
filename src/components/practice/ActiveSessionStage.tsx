/**
 * Active typing stage — composes TypingArea + keyboard SVG + corner widgets.
 *
 * Rendered while `sessionStore.status === "active"`. Pause overlay is layered
 * on top by the parent when `paused` is true (not this component's concern).
 * Keystroke capture is gated via `capture`: when paused, the parent passes
 * false so the TypingArea's window listener unbinds.
 *
 * Visual keyboard flashes via imperative ref per docs/02-architecture.md §3
 * (16ms feedback budget). See useFlashKeyboardOnKeypress for the wiring.
 */

import { useRef } from "react";
import { TypingArea } from "#/components/TypingArea";
import { SofleSVG, Lily58SVG, type KeyboardSVGHandle } from "#/components/keyboard";
import { useSessionStore } from "#/stores/sessionStore";
import { useFlashKeyboardOnKeypress } from "#/hooks/useFlashKeyboardOnKeypress";
import type { KeyboardType } from "#/server/profile";
import { LiveWpm } from "./LiveWpm";
import { ShortcutHints } from "./ShortcutHints";
import { FirstSessionTooltip } from "./FirstSessionTooltip";

export type TypingSize = "S" | "M" | "L" | "XL";

type Props = {
  keyboardType: KeyboardType;
  showKeyboard: boolean;
  expectedLetterHint: boolean;
  /** When false, keystroke capture unbinds — used while the pause overlay is open. */
  capture: boolean;
  typingSize: TypingSize;
  /** True only on the first-ever session for a profile — shows the
   * onboarding tooltip above the typing area (Task 4.1). */
  isFirstSession?: boolean;
};

export function ActiveSessionStage({
  keyboardType,
  showKeyboard,
  expectedLetterHint,
  capture,
  typingSize,
  isFirstSession = false,
}: Props) {
  const target = useSessionStore((s) => s.target);
  const position = useSessionStore((s) => s.position);
  const keyboardRef = useRef<KeyboardSVGHandle>(null);

  useFlashKeyboardOnKeypress(keyboardRef);

  const nextChar = target[position] ?? "";
  const KeyboardComponent = keyboardType === "sofle" ? SofleSVG : Lily58SVG;

  return (
    <div className="kerf-active-session" data-typing-size={typingSize}>
      <div className="kerf-active-session-typing">
        {isFirstSession && <FirstSessionTooltip />}
        <TypingArea target={target} expectedLetterHint={expectedLetterHint} capture={capture} />
      </div>

      {showKeyboard && (
        <div className="kerf-active-session-keyboard">
          <KeyboardComponent ref={keyboardRef} targetKey={nextChar || undefined} showFingerBars />
        </div>
      )}

      <LiveWpm visible />
      <ShortcutHints visible />
    </div>
  );
}
