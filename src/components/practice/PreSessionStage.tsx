/**
 * Pre-session stage — what you see before typing starts.
 *
 * Composition:
 *   - Keyboard context pill + transition phase badge (top row)
 *   - Title + subtitle ("What will you practice?" / "Accuracy first…")
 *   - Primary CTA (Enter key shortcut) → fires generateExercise + dispatch start
 *   - Secondary mode cards (Drill / Inner column / Warm up) — disabled for
 *     Task 2.4; they unlock in Tasks 2.6+
 *   - Collapsible filters panel
 *
 * Cold-start copy: until session history is persisted (Phase 3), the CTA
 * meta shows a neutral "balanced practice" line rather than the wireframe's
 * "columnar focus: B, N, T" (which needs weakness stats to be truthful).
 * Truthful-but-dull beats confident-but-fabricated per CLAUDE.md §B3.
 */

import type { TransitionPhase } from "#/domain/profile/initialPhase";
import type { KeyboardType } from "#/server/profile";
import { KeyboardContextPill } from "./KeyboardContextPill";
import { PhaseBadge } from "./PhaseBadge";
import { ModeCard } from "./ModeCard";
import {
  PreSessionFilters,
  type PreSessionFilterValues,
} from "./PreSessionFilters";

type Props = {
  keyboardType: KeyboardType;
  phase: TransitionPhase;
  filterValues: PreSessionFilterValues;
  onFilterChange: (next: PreSessionFilterValues) => void;
  onStartAdaptive: () => void;
  /** Navigate to /practice/drill so the user can pick a target. */
  onDrillWeakness: () => void;
  /** Shortcut to /practice/drill?preset=innerColumn. */
  onDrillInnerColumn: () => void;
};

const TARGET_WORD_COUNT = 30;
// ~3s per word at a transitioning-phase pace. Rough; revisited once real WPM is known.
const APPROX_SECONDS_PER_WORD = 3;

export function PreSessionStage({
  keyboardType,
  phase,
  filterValues,
  onFilterChange,
  onStartAdaptive,
  onDrillWeakness,
  onDrillInnerColumn,
}: Props) {
  const approxSeconds = TARGET_WORD_COUNT * APPROX_SECONDS_PER_WORD;
  const metaLine = `balanced practice · ${TARGET_WORD_COUNT} words · ~${approxSeconds} sec`;

  return (
    <div className="kerf-pre-session">
      <div className="kerf-pre-session-topline">
        <KeyboardContextPill keyboardType={keyboardType} />
        <PhaseBadge phase={phase} />
      </div>

      <h1 className="kerf-pre-title">What will you practice?</h1>
      <p className="kerf-pre-subtitle">Accuracy first. Speed follows.</p>

      <button
        type="button"
        className="kerf-pre-cta-primary"
        onClick={onStartAdaptive}
      >
        <span className="kerf-pre-cta-primary-text">
          <span className="kerf-pre-cta-primary-label">
            Continue adaptive practice
          </span>
          <span className="kerf-pre-cta-primary-meta">{metaLine}</span>
        </span>
        <span className="kerf-pre-cta-primary-action" aria-hidden>
          <kbd className="kerf-kbd">⏎</kbd>
          <span className="kerf-pre-cta-arrow">→</span>
        </span>
      </button>

      <div className="kerf-pre-modes-label">or pick a different mode</div>
      <div className="kerf-pre-modes">
        <ModeCard
          icon="◎"
          name="Drill weakness"
          description="Target a specific letter or bigram, repeatedly"
          onSelect={onDrillWeakness}
        />
        <ModeCard
          icon="⬌"
          name="Inner column"
          description="Focus drill on B, G, H, N, T, Y — classic split pain points"
          onSelect={onDrillInnerColumn}
        />
        <ModeCard
          icon="◷"
          name="Warm up"
          description="Comfortable pace, no evaluation tracking"
          disabled
        />
      </div>

      <PreSessionFilters values={filterValues} onChange={onFilterChange} />
    </div>
  );
}
