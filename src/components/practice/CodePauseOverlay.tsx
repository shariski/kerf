import { useEffect, useRef } from "react";
import { CODE_FOCUSES, codeFocusLabel, type CodeFocus } from "#/domain/codePractice/focus";
import { CODE_LANGUAGES, type CodeLanguage } from "#/domain/codePractice/languages";
import { KerfSelect } from "./KerfSelect";

export type CodePauseDraft = {
  language: CodeLanguage;
  focusChoice: "recommended" | CodeFocus;
  typingSize: "S" | "M" | "L" | "XL";
};

type Props = {
  draft: CodePauseDraft;
  onChange: (next: CodePauseDraft) => void;
  onResume: () => void;
  onRestart: () => void;
  onEnd: () => void;
};

export function CodePauseOverlay({ draft, onChange, onResume, onRestart, onEnd }: Props) {
  const resumeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    resumeRef.current?.focus();
  }, []);

  return (
    <div className="kerf-pause-overlay" role="dialog" aria-modal="true" aria-label="Session paused">
      <div className="kerf-pause-panel">
        <div className="kerf-pause-label">paused</div>
        <h2 className="kerf-pause-title">Take a breath.</h2>
        <p className="kerf-pause-subtitle">
          Adjust this session. Changes apply when you resume or press Esc again.
        </p>

        <div className="kerf-pause-settings">
          <div className="kerf-pause-setting-row">
            <div>
              <div className="kerf-pause-setting-label">Focus</div>
              <div className="kerf-pause-setting-desc">changing focus starts a fresh example</div>
            </div>
            <KerfSelect
              className="kerf-pause-focus-select"
              label="Focus"
              value={draft.focusChoice}
              options={[
                { value: "recommended", label: "Suggested focus" },
                ...CODE_FOCUSES.map((focus) => ({
                  value: focus,
                  label: codeFocusLabel(focus, draft.language),
                })),
              ]}
              onChange={(focusChoice) => onChange({ ...draft, focusChoice })}
              onSelectionComplete={() => resumeRef.current?.focus()}
            />
          </div>
          <div className="kerf-pause-setting-row">
            <div>
              <div className="kerf-pause-setting-label">Code language</div>
              <div className="kerf-pause-setting-desc">
                changing language starts a fresh example
              </div>
            </div>
            <KerfSelect
              className="kerf-pause-focus-select"
              label="Code language"
              value={draft.language}
              options={CODE_LANGUAGES.map((item) => ({ value: item.id, label: item.label }))}
              onChange={(language) => onChange({ ...draft, language })}
              onSelectionComplete={() => resumeRef.current?.focus()}
            />
          </div>
          <div className="kerf-pause-setting-row">
            <div>
              <div className="kerf-pause-setting-label">Typing text size</div>
              <div className="kerf-pause-setting-desc">larger = easier on the eyes</div>
            </div>
            <fieldset className="kerf-pill-group">
              <legend className="sr-only">Typing text size</legend>
              {(["S", "M", "L", "XL"] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  className="kerf-pill-option"
                  data-active={draft.typingSize === size || undefined}
                  aria-pressed={draft.typingSize === size}
                  onClick={() => {
                    onChange({ ...draft, typingSize: size });
                    resumeRef.current?.focus();
                  }}
                >
                  {size}
                </button>
              ))}
            </fieldset>
          </div>
        </div>

        <div className="kerf-pause-actions">
          <button
            ref={resumeRef}
            type="button"
            className="kerf-pause-btn kerf-pause-btn--primary"
            onClick={onResume}
          >
            Resume <span className="kerf-pause-btn-shortcut">⏎</span>
          </button>
          <button type="button" className="kerf-pause-btn" onClick={onRestart}>
            Restart example <span className="kerf-pause-btn-shortcut">⌃↵</span>
          </button>
          <button type="button" className="kerf-pause-btn" onClick={onEnd}>
            End session
          </button>
        </div>
      </div>
    </div>
  );
}
