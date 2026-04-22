import type { JourneyCode } from "./journey";
import type { SessionTarget, TargetType } from "./targetSelection";

export type DrillCategory =
  | "vertical-column"
  | "inner-column"
  | "thumb-cluster"
  | "hand-isolation"
  | "cross-hand-bigram";

export type DrillLibraryEntry = {
  id: string;
  category: DrillCategory;
  target: {
    type: TargetType;
    value: string;
    label: string;
    keys: string[];
    hand?: "left" | "right";
    finger?: string;
  };
  /** The string the user types. Curated, not sampled. */
  exercise: string;
  /** Journey-specific briefing copy; filled from briefingTemplates in Task 9
   * for vertical-column + inner-column entries. Shared entries may use the
   * same string for both journey keys (e.g. thumb-cluster). */
  briefing: {
    conventional: string;
    columnar: string;
  };
  /** Which journeys this entry is surfaced to. */
  appliesTo: JourneyCode[];
  estimatedSeconds: number;
};

/**
 * Structural validation of a single entry. Does not validate copy quality
 * (that's a reviewer job in Task 9). Does enforce:
 *   - id non-empty
 *   - exercise contains at least one of the target.keys
 *   - briefing has non-empty strings for both journeys
 *   - appliesTo non-empty
 */
export function isValidDrillEntry(e: DrillLibraryEntry): boolean {
  if (!e.id || e.id.length === 0) return false;
  if (!e.exercise || e.exercise.length === 0) return false;
  const lowerExercise = e.exercise.toLowerCase();
  const hasTargetKey = e.target.keys.some((k) => lowerExercise.includes(k.toLowerCase()));
  if (!hasTargetKey) return false;
  if (!e.briefing.conventional || !e.briefing.columnar) return false;
  if (!e.appliesTo || e.appliesTo.length === 0) return false;
  return true;
}

/**
 * Find the first library entry matching the given target. `journey` is used
 * as a tiebreaker when multiple entries target the same (type, value) — the
 * entry whose `appliesTo` includes the journey wins. Throws if no entry
 * matches; Target Selection should only pick targets the library covers.
 */
export function lookupDrill(
  library: DrillLibraryEntry[],
  target: SessionTarget,
  journey: JourneyCode,
): DrillLibraryEntry {
  const matches = library.filter(
    (e) => e.target.type === target.type && e.target.value === target.value,
  );
  if (matches.length === 0) {
    throw new Error(
      `lookupDrill: no drill for target ${target.type}/${target.value}`,
    );
  }
  const journeyMatch = matches.find((e) => e.appliesTo.includes(journey));
  return journeyMatch ?? matches[0]!;
}
