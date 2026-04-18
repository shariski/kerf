/**
 * Maps a user's self-reported initial level (from onboarding) to the starting
 * `transition_phase` on their keyboard profile. See docs/02-architecture.md §2
 * (keyboard_profiles) and docs/01-product-spec.md §5 (onboarding flow).
 *
 * - "first_day" / "few_weeks" → transitioning (engine emphasises accuracy +
 *    muscle memory on high-pain-point columns)
 * - "comfortable" → refining (engine narrows focus, pushes bigram smoothing)
 *
 * Later transitions from transitioning → refining are proposed by
 * phaseSuggestion.ts based on training data — this module only handles the
 * cold-start mapping where there is no data yet.
 */

export type InitialLevel = "first_day" | "few_weeks" | "comfortable";
export type TransitionPhase = "transitioning" | "refining";

export function initialPhaseForLevel(level: InitialLevel): TransitionPhase {
  return level === "comfortable" ? "refining" : "transitioning";
}
