import type { FingerTable } from "#/domain/finger/types";

export type MechanismKey =
  | "space/timing"
  | "same-finger"
  | "adjacent-finger"
  | "row-cross"
  | "cross-hand"
  | "non-alpha";

const FINGER_ORDER: Record<string, number> = { pinky: 0, ring: 1, middle: 2, index: 3 };

/**
 * Classify an (target, actual) error pair by which finger mechanics failed.
 * Layout-aware: uses the provided FingerTable (sofle/lily58 base layers).
 * Returns null when the pair is not classifiable (e.g. both non-alpha).
 */
export function classifyMechanism(
  target: string,
  actual: string,
  fingerTable: FingerTable,
): MechanismKey | null {
  if (target === " " || actual === " ") return "space/timing";

  const t = fingerTable[target];
  const a = fingerTable[actual];
  if (!t || !a) return null; // one of the keys is not in the base layer
  const isAlpha = t.row >= 1 && a.row >= 1;
  if (!isAlpha) return t.row >= 1 || a.row >= 1 ? "non-alpha" : null;

  if (t.hand === a.hand && t.finger === a.finger) return "same-finger";

  if (t.hand === a.hand) {
    if (t.finger === a.finger) return "same-finger";
    const adjacent = Math.abs((FINGER_ORDER[t.finger] ?? 0) - (FINGER_ORDER[a.finger] ?? 0)) === 1;
    if (adjacent && t.row === a.row) return "adjacent-finger";
    if (adjacent && t.row !== a.row) return "row-cross";
    if (!adjacent) return "row-cross"; // non-adjacent same-hand: aim drift
  }

  return "cross-hand";
}
