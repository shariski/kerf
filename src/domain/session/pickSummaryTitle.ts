import type { TransitionPhase } from "#/domain/stats/types";

/**
 * Post-session summary title — the sentence that sits directly under the
 * "session complete" badge on the /practice summary screen (e.g. the
 * wireframe's "Accuracy held up well.").
 *
 * This is pure product copy, deliberately left as an implementation
 * choice for the developer. The contract below encodes the rules from
 * docs/01-product-spec.md §6.2 and CLAUDE.md §B3.
 *
 * Input
 *   accuracyPct — 0 to 100 (rounded integer)
 *   phase       — "transitioning" | "refining"
 *
 * Output
 *   A single sentence, no trailing newline, no leading whitespace.
 *   The invariants the tests will enforce:
 *
 *   1. NEVER contains any of:
 *      "amazing", "crushing it", "nailed it", "incredible", "awesome",
 *      "killing it", "rockstar", "legend", "personal best"
 *      (case-insensitive)
 *
 *   2. NEVER contains stacked exclamation marks (/!{2,}/).
 *      At most one "!" in the whole string, and prefer zero.
 *
 *   3. For low accuracy (< 80%) the copy must NOT use positive framing.
 *      No "great", "nice", "strong", "well done", "on track" or similar.
 *      Be honest — see CLAUDE.md §B3 "When user hasn't improved, say so
 *      honestly. Do not sugarcoat."
 *
 *   4. The output for `phase="transitioning"` and the output for
 *      `phase="refining"` at the SAME accuracy must differ — the voice
 *      is different per phase (see docs/01-product-spec.md §6.2 and
 *      CLAUDE.md §B3):
 *        transitioning → "building muscle memory" framing
 *        refining      → "polishing flow" framing
 *
 *   5. Output length ≤ 80 characters (it's a page title).
 *
 * Suggested shape (not prescriptive — feel free to pick your own copy):
 *
 *   if (accuracyPct >= 98)   → a quiet "locked in" / "clean rep" phrasing
 *   else if (accuracyPct >= 92) → affirming but restrained ("held up well")
 *   else if (accuracyPct >= 80) → neutral / observational ("uneven rep")
 *   else                         → honest concern ("bumpy one — reset next")
 *
 * Aim for 5–10 lines of code. Keep strings short. Lean mentor, not coach.
 */
export function pickSummaryTitle(accuracyPct: number, phase: TransitionPhase): string {
  const transitioning = phase === "transitioning";
  if (accuracyPct >= 98) {
    return transitioning
      ? "Locked in. That's muscle memory taking hold."
      : "Clean rep. Flow is settling into place.";
  }
  if (accuracyPct >= 92) {
    return transitioning
      ? "Accuracy held up well. Muscle memory is forming."
      : "Accuracy held up well. Flow is getting quieter.";
  }
  if (accuracyPct >= 80) {
    return transitioning
      ? "Uneven rep — muscle memory is still knitting together."
      : "Uneven rep — ease back to let flow catch up.";
  }
  return transitioning
    ? "Bumpy one. Slow down; muscle memory needs precision first."
    : "Bumpy one. Slow down; accuracy has to lead the flow.";
}
