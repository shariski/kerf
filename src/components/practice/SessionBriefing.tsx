import { useEffect } from "react";
import type { SessionTarget } from "#/domain/adaptive/targetSelection";

type Props = {
  target: SessionTarget;
  briefingText: string;
  onStart: () => void;
  /**
   * If provided, renders a small "Back" button that returns the user
   * to the pre-session picker without starting a session. Routes also
   * auto-cancel the briefing on tab switch (visibilitychange → hidden),
   * so this is the explicit user-driven counterpart to that behavior.
   */
  onBack?: () => void;
};

export function SessionBriefing({ target, briefingText, onStart, onBack }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onStart();
        return;
      }
      // Escape returns to picker if a back handler is wired. Mirrors the
      // tab-switch auto-reset — same intent, explicit keystroke.
      if (e.key === "Escape" && onBack) {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStart, onBack]);

  return (
    <section className="kerf-session-briefing" aria-label="Session briefing">
      <span className="kerf-session-briefing-eyebrow">session brief</span>
      <h1 className="kerf-session-briefing-title">{target.label}</h1>
      <p className="kerf-session-briefing-text">{briefingText}</p>
      {target.keys.length > 0 && (
        <ul className="kerf-session-briefing-keys" aria-label="Keys in this target">
          {target.keys.map((k, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: positional key needed because target keys can repeat (e.g. ["e","e"] for "ee" bigram).
            <li key={`${k}-${i}`} className="kerf-session-briefing-key">
              <span aria-hidden>{k === " " ? "␣" : k.toUpperCase()}</span>
              <span className="sr-only">{k === " " ? "space" : k}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="kerf-session-briefing-actions">
        <button type="button" onClick={onStart} className="kerf-session-briefing-start">
          Start
          <kbd className="kerf-kbd" aria-hidden>
            ⏎
          </kbd>
        </button>
        {onBack && (
          <button type="button" onClick={onBack} className="kerf-session-briefing-back">
            ← Back
          </button>
        )}
      </div>
    </section>
  );
}
