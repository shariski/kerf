/**
 * Full-screen pause overlay shown on Esc during an active session.
 *
 * Keyboard flow (relies on native browser focus):
 *   - Resume button autofocuses on mount → Enter resumes.
 *   - Tab walks Resume → Restart → End session, Shift+Tab walks back.
 *   - Esc closes the overlay (handled by parent).
 *
 * Settings here are session-scoped only — per decision in Task 2.4 planning
 * they reset on reload (no localStorage yet). If this proves annoying the
 * upgrade to localStorage is a one-liner inside the parent.
 *
 * Copy honors CLAUDE.md §B3: the title "Take a breath." and subtitle frame
 * slowing down as the right trajectory, not a failure.
 */

import { useEffect, useRef } from "react";

export type PauseSettings = {
  typingSize: "S" | "M" | "L" | "XL";
  showKeyboard: boolean;
  expectedLetterHint: boolean;
};

type Props = {
  settings: PauseSettings;
  onSettingsChange: (next: PauseSettings) => void;
  onResume: () => void;
  onRestart: () => void;
  onEnd: () => void;
};

export function PauseOverlay({
  settings,
  onSettingsChange,
  onResume,
  onRestart,
  onEnd,
}: Props) {
  const resumeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    resumeRef.current?.focus();
  }, []);

  const set = <K extends keyof PauseSettings>(
    key: K,
    value: PauseSettings[K],
  ) => onSettingsChange({ ...settings, [key]: value });

  return (
    <div
      className="kerf-pause-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Session paused"
    >
      <div className="kerf-pause-panel">
        <div className="kerf-pause-label">paused</div>
        <h2 className="kerf-pause-title">Take a breath.</h2>
        <p className="kerf-pause-subtitle">
          Accuracy improves when you slow down. Adjust settings below or
          resume when ready.
        </p>

        <div className="kerf-pause-settings">
          <SettingRow
            label="Typing text size"
            description="larger = easier on the eyes"
          >
            {(["S", "M", "L", "XL"] as const).map((s) => (
              <PillOption
                key={s}
                active={settings.typingSize === s}
                onClick={() => set("typingSize", s)}
              >
                {s}
              </PillOption>
            ))}
          </SettingRow>

          <SettingRow
            label="Visual keyboard"
            description="show finger assignment hints"
          >
            <PillOption
              active={settings.showKeyboard}
              onClick={() => set("showKeyboard", true)}
            >
              Show
            </PillOption>
            <PillOption
              active={!settings.showKeyboard}
              onClick={() => set("showKeyboard", false)}
            >
              Hide
            </PillOption>
          </SettingRow>

          <SettingRow
            label="Expected-letter hint"
            description="show correct letter above errors"
          >
            <PillOption
              active={settings.expectedLetterHint}
              onClick={() => set("expectedLetterHint", true)}
            >
              On
            </PillOption>
            <PillOption
              active={!settings.expectedLetterHint}
              onClick={() => set("expectedLetterHint", false)}
            >
              Off
            </PillOption>
          </SettingRow>
        </div>

        <div className="kerf-pause-actions">
          <button
            ref={resumeRef}
            type="button"
            className="kerf-pause-btn kerf-pause-btn--primary"
            onClick={onResume}
          >
            Resume
            <span className="kerf-pause-btn-shortcut">⏎</span>
          </button>
          <button
            type="button"
            className="kerf-pause-btn"
            onClick={onRestart}
          >
            Restart exercise
            <span className="kerf-pause-btn-shortcut">⇥⏎</span>
          </button>
          <button type="button" className="kerf-pause-btn" onClick={onEnd}>
            End session
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="kerf-pause-setting-row">
      <div>
        <div className="kerf-pause-setting-label">{label}</div>
        <div className="kerf-pause-setting-desc">{description}</div>
      </div>
      <div className="kerf-pill-group">{children}</div>
    </div>
  );
}

function PillOption({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="kerf-pill-option"
      data-active={active || undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
