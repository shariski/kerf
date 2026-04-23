/**
 * JourneyCode — the user's self-declared finger-assignment style on a
 * columnar split board. ADR-003 §2.
 *
 *   - conventional  — fingers reach diagonally as on QWERTY; F and J home.
 *                     Primary pain: vertical motion per column.
 *   - columnar      — each finger on its own column (user retrained).
 *                     Primary pain: inner-column reach (B/G/T, H/N/Y).
 *   - unsure        — user defaulted to 'I'm not sure' at onboarding, or
 *                     the column is NULL from a pre-ADR-003 profile.
 *                     Engine treats 'unsure' as 'conventional' for
 *                     weakness/target weighting (lower-friction default).
 */
export type JourneyCode = "conventional" | "columnar" | "unsure";

const KNOWN: ReadonlySet<string> = new Set<JourneyCode>(["conventional", "columnar", "unsure"]);

/**
 * Narrow an unknown string (or null/undefined from the DB) into a
 * JourneyCode. Unknown values fall back to 'unsure' so the engine
 * always has a safe default.
 */
export function toJourneyCode(raw: string | null | undefined): JourneyCode {
  if (raw != null && KNOWN.has(raw)) return raw as JourneyCode;
  return "unsure";
}
