/**
 * Small phase pill shown above the pre-session title.
 *
 * Copy follows accuracy-first tone (CLAUDE.md §B3): transitioning → "building
 * muscle memory", refining → "polishing flow". The phase itself is sourced
 * from `keyboard_profiles.transition_phase` (see src/server/profile.ts).
 */

import type { TransitionPhase } from "#/domain/profile/initialPhase";

type Props = {
  phase: TransitionPhase;
};

export function PhaseBadge({ phase }: Props) {
  return (
    <span
      className="kerf-phase-badge"
      aria-label={`Current phase: ${phase}`}
      data-phase={phase}
    >
      <span className="kerf-phase-badge-dot" aria-hidden />
      {phase}
    </span>
  );
}
