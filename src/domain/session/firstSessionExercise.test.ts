import { describe, expect, it } from "vitest";
import {
  FIRST_SESSION_WORDS,
  getFirstSessionTarget,
} from "./firstSessionExercise";

describe("getFirstSessionTarget", () => {
  it("is deterministic across calls", () => {
    expect(getFirstSessionTarget()).toBe(getFirstSessionTarget());
  });

  it("is composed of lowercase words joined by single spaces", () => {
    expect(getFirstSessionTarget()).toMatch(/^[a-z]+( [a-z]+)+$/);
  });

  it("matches the curated word list in order", () => {
    expect(getFirstSessionTarget()).toBe(FIRST_SESSION_WORDS.join(" "));
  });

  it("fits a reasonable first-session length window (30-180 chars)", () => {
    // Lower bound: must have real diagnostic content, not a two-word toy.
    // Upper bound: first-day transitioners fatigue fast; anything over
    // ~3 minutes at 30 WPM stops being a baseline and becomes an endurance
    // test. 180 chars / 5 / 30 WPM ≈ 72 seconds — comfortable.
    const target = getFirstSessionTarget();
    expect(target.length).toBeGreaterThanOrEqual(30);
    expect(target.length).toBeLessThanOrEqual(180);
  });

  it("covers inner-column stretch letters (t, h, n, r, b)", () => {
    // These are the split-keyboard transition friction points per
    // docs/02-architecture.md §4.5. Without them the first session
    // produces no signal for the adaptive engine to seed weakness
    // weights on.
    const target = getFirstSessionTarget();
    for (const letter of ["t", "h", "n", "r", "b"]) {
      expect(target).toContain(letter);
    }
  });
});
