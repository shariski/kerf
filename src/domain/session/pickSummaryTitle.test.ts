import { describe, expect, it } from "vitest";
import type { TransitionPhase } from "#/domain/stats/types";
import { pickSummaryTitle } from "./pickSummaryTitle";

/**
 * Invariant tests for the post-session title picker. These do NOT
 * assert exact copy — they assert the §6.2 / §B3 rules the copy has
 * to honor regardless of what you choose to say.
 *
 * If you rewrite `pickSummaryTitle`, all of these tests must still
 * pass. If they don't, rewrite the copy — don't loosen the tests.
 */

const ACCURACIES = [100, 98, 95, 92, 88, 80, 72, 55, 0] as const;
const PHASES: TransitionPhase[] = ["transitioning", "refining"];

const BANNED_PHRASES = [
  "amazing",
  "crushing it",
  "nailed it",
  "incredible",
  "awesome",
  "killing it",
  "rockstar",
  "legend",
  "personal best",
] as const;

/** Words/phrases that are positive framing — must NOT appear for <80%. */
const POSITIVE_FRAMING_LOW_ACC = [
  "great",
  "nice",
  "strong",
  "well done",
  "on track",
  "good work",
  "progress",
  "solid",
] as const;

for (const phase of PHASES) {
  describe(`pickSummaryTitle — invariants (phase=${phase})`, () => {
    for (const acc of ACCURACIES) {
      it(`${acc}% is a single sentence under 80 chars`, () => {
        const title = pickSummaryTitle(acc, phase);
        expect(title.length).toBeGreaterThan(0);
        expect(title.length).toBeLessThanOrEqual(80);
        expect(title.startsWith(" ")).toBe(false);
        expect(title.endsWith("\n")).toBe(false);
      });

      it(`${acc}% contains no banned hype phrases`, () => {
        const title = pickSummaryTitle(acc, phase).toLowerCase();
        for (const phrase of BANNED_PHRASES) {
          expect(title, `contained "${phrase}"`).not.toContain(phrase);
        }
      });

      it(`${acc}% has no stacked exclamation marks`, () => {
        const title = pickSummaryTitle(acc, phase);
        expect(title).not.toMatch(/!{2,}/);
      });
    }
  });

  describe(`pickSummaryTitle — accuracy-first honesty (phase=${phase})`, () => {
    it("low accuracy (<80%) does not use positive framing words", () => {
      for (const acc of [72, 55, 30, 0]) {
        const title = pickSummaryTitle(acc, phase).toLowerCase();
        for (const pos of POSITIVE_FRAMING_LOW_ACC) {
          expect(title, `${acc}% contained "${pos}"`).not.toContain(pos);
        }
      }
    });
  });
}

describe("pickSummaryTitle — phase-aware voice", () => {
  it("uses different copy per phase at the same accuracy (at least one bucket)", () => {
    // Not every bucket needs to differ, but at least one must —
    // otherwise the function is ignoring the phase parameter.
    const differs = ACCURACIES.some(
      (acc) => pickSummaryTitle(acc, "transitioning") !== pickSummaryTitle(acc, "refining"),
    );
    expect(differs).toBe(true);
  });
});
