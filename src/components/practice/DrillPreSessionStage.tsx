import { useState, type CSSProperties } from "react";
import type { KeyboardType, DominantHand } from "#/server/profile";
import type { TransitionPhase } from "#/domain/profile/initialPhase";
import { KeyboardContextPill } from "./KeyboardContextPill";
import { PhaseBadge } from "./PhaseBadge";

/**
 * Pre-drill picker screen at `/practice/drill` when no target / preset
 * is present in the URL.
 *
 * Matches the IA §4.3 spec: a "What to drill?" question with two
 * options — manual select of a char/bigram, or one of the preset
 * drill modes (inner column, thumb cluster, cross-hand bigrams).
 *
 * Auto-recommend from top weakness is deferred to Phase 3 once
 * session history persists (CLAUDE.md §B6). The copy on the screen
 * says so honestly.
 */

type Props = {
  keyboardType: KeyboardType;
  dominantHand?: DominantHand;
  phase: TransitionPhase;
  onSelectTarget: (target: string) => void;
  onSelectPreset: (preset: PresetKey) => void;
};

export type PresetKey =
  | "innerColumn"
  | "thumbCluster"
  | "crossHandBigram"
  | "verticalColumn-leftPinky"
  | "verticalColumn-leftRing"
  | "verticalColumn-leftMiddle"
  | "verticalColumn-leftIndexOuter"
  | "verticalColumn-leftIndexInner"
  | "verticalColumn-rightIndexInner"
  | "verticalColumn-rightIndexOuter"
  | "verticalColumn-rightMiddle"
  | "verticalColumn-rightRing"
  | "verticalColumn-rightPinky";

// Approx minutes to complete a 300-char drill at 40 wpm / ~5 chars per word.
// Matches the DEFAULT_DRILL_LENGTH in drillGenerator.ts and the task-breakdown
// "About 2-3 minutes" target. Floor/ceil instead of Math.round so 2:30 reads
// as "2–3 minutes", not the collapsed "3–3".
const EST_MIN_LOW = 2;
const EST_MIN_HIGH = 3;

type VerticalColumnOption = {
  preset: PresetKey;
  label: string;
  ariaLabel: string;
  fingerVar: string;
};

const LEFT_HAND_COLUMNS: VerticalColumnOption[] = [
  {
    preset: "verticalColumn-leftPinky",
    label: "pinky",
    ariaLabel: "Drill left pinky column",
    fingerVar: "--color-kerf-finger-l-pinky",
  },
  {
    preset: "verticalColumn-leftRing",
    label: "ring",
    ariaLabel: "Drill left ring column",
    fingerVar: "--color-kerf-finger-l-ring",
  },
  {
    preset: "verticalColumn-leftMiddle",
    label: "middle",
    ariaLabel: "Drill left middle column",
    fingerVar: "--color-kerf-finger-l-middle",
  },
  {
    preset: "verticalColumn-leftIndexOuter",
    label: "index (outer)",
    ariaLabel: "Drill left index outer column",
    fingerVar: "--color-kerf-finger-l-index",
  },
  {
    preset: "verticalColumn-leftIndexInner",
    label: "index (inner)",
    ariaLabel: "Drill left index inner column",
    fingerVar: "--color-kerf-finger-l-index",
  },
];

const RIGHT_HAND_COLUMNS: VerticalColumnOption[] = [
  {
    preset: "verticalColumn-rightPinky",
    label: "pinky",
    ariaLabel: "Drill right pinky column",
    fingerVar: "--color-kerf-finger-r-pinky",
  },
  {
    preset: "verticalColumn-rightRing",
    label: "ring",
    ariaLabel: "Drill right ring column",
    fingerVar: "--color-kerf-finger-r-ring",
  },
  {
    preset: "verticalColumn-rightMiddle",
    label: "middle",
    ariaLabel: "Drill right middle column",
    fingerVar: "--color-kerf-finger-r-middle",
  },
  {
    preset: "verticalColumn-rightIndexOuter",
    label: "index (outer)",
    ariaLabel: "Drill right index outer column",
    fingerVar: "--color-kerf-finger-r-index",
  },
  {
    preset: "verticalColumn-rightIndexInner",
    label: "index (inner)",
    ariaLabel: "Drill right index inner column",
    fingerVar: "--color-kerf-finger-r-index",
  },
];

export function DrillPreSessionStage({
  keyboardType,
  phase,
  onSelectTarget,
  onSelectPreset,
}: Props) {
  const [rawInput, setRawInput] = useState("");
  const target = rawInput.trim().toLowerCase();
  const valid = target.length === 1 || target.length === 2;

  const submit = () => {
    if (!valid) return;
    onSelectTarget(target);
  };

  return (
    <div className="kerf-pre-session">
      <div className="kerf-pre-session-topline">
        <KeyboardContextPill keyboardType={keyboardType} />
        <PhaseBadge phase={phase} />
      </div>

      <h1 className="kerf-pre-title">What to drill?</h1>
      <p className="kerf-pre-subtitle">
        Focused reps on a specific letter, bigram, or split-keyboard pain point. About {EST_MIN_LOW}
        –{EST_MIN_HIGH} minutes.
      </p>

      <div className="kerf-drill-target-card">
        <label className="kerf-drill-target-label" htmlFor="kerf-drill-input">
          <span>Pick a target</span>
          <span className="kerf-drill-target-hint">single letter or bigram</span>
        </label>
        <div className="kerf-drill-target-row">
          <input
            id="kerf-drill-input"
            className="kerf-drill-target-input"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            maxLength={2}
            placeholder="b"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid) {
                e.preventDefault();
                submit();
              }
            }}
            aria-invalid={!valid && rawInput.length > 0}
          />
          <button
            type="button"
            className="kerf-drill-target-cta"
            onClick={submit}
            disabled={!valid}
          >
            Start drill
            <kbd className="kerf-kbd">⏎</kbd>
          </button>
        </div>
        <p className="kerf-drill-target-note">
          Auto-recommend from top weakness lands with Phase 3 session history.
        </p>
      </div>

      <div className="kerf-pre-modes-label">or pick a preset</div>
      <div className="kerf-pre-modes">
        <button
          type="button"
          className="kerf-mode-card"
          onClick={() => onSelectPreset("innerColumn")}
          aria-label="Inner column drill: B, G, H, N, T, Y"
        >
          <span className="kerf-mode-card-icon" aria-hidden>
            ⬌
          </span>
          <span className="kerf-mode-card-name">Inner column</span>
          <span className="kerf-mode-card-desc">
            Focus on B, G, H, N, T, Y — classic split pain points
          </span>
        </button>
        <button
          type="button"
          className="kerf-mode-card"
          onClick={() => onSelectPreset("thumbCluster")}
          aria-label="Thumb cluster drill: short words"
        >
          <span className="kerf-mode-card-icon" aria-hidden>
            ◐
          </span>
          <span className="kerf-mode-card-name">Thumb cluster</span>
          <span className="kerf-mode-card-desc">
            Short words — builds space-bar and thumb rhythm
          </span>
        </button>
        <button
          type="button"
          className="kerf-mode-card"
          onClick={() => onSelectPreset("crossHandBigram")}
          aria-label="Cross-hand bigram drill"
        >
          <span className="kerf-mode-card-icon" aria-hidden>
            ⇌
          </span>
          <span className="kerf-mode-card-name">Cross-hand bigrams</span>
          <span className="kerf-mode-card-desc">
            Top bigrams that jump between hands — hardest on split layouts
          </span>
        </button>
        <div className="kerf-mode-card kerf-mode-card--vertical-reach">
          <span className="kerf-mode-card-icon" aria-hidden>
            ↕
          </span>
          <span className="kerf-mode-card-name">Vertical reach</span>
          <span className="kerf-mode-card-desc">
            Top-to-bottom column reps — trains the reach from home row
          </span>
          <fieldset className="kerf-vertical-column-picker">
            <legend className="sr-only">Pick a column</legend>
            <div className="kerf-vertical-column-group">
              <span aria-hidden className="kerf-vertical-column-hand">
                left hand
              </span>
              {LEFT_HAND_COLUMNS.map(({ preset, label, ariaLabel, fingerVar }) => (
                <button
                  key={preset}
                  type="button"
                  className="kerf-vertical-column-btn"
                  onClick={() => onSelectPreset(preset)}
                  aria-label={ariaLabel}
                  style={{ "--kerf-finger-dot": `var(${fingerVar})` } as CSSProperties}
                >
                  <span aria-hidden className="kerf-vertical-column-dot" />
                  <span className="kerf-vertical-column-label">{label}</span>
                </button>
              ))}
            </div>
            <div className="kerf-vertical-column-group">
              <span aria-hidden className="kerf-vertical-column-hand">
                right hand
              </span>
              {RIGHT_HAND_COLUMNS.map(({ preset, label, ariaLabel, fingerVar }) => (
                <button
                  key={preset}
                  type="button"
                  className="kerf-vertical-column-btn"
                  onClick={() => onSelectPreset(preset)}
                  aria-label={ariaLabel}
                  style={{ "--kerf-finger-dot": `var(${fingerVar})` } as CSSProperties}
                >
                  <span aria-hidden className="kerf-vertical-column-dot" />
                  <span className="kerf-vertical-column-label">{label}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  );
}
