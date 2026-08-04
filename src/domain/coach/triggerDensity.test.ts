import { describe, expect, it } from "vitest";
import { SOFLE_BASE_LAYER } from "#/domain/finger/sofle";
import { profileText } from "./triggerDensity";

describe("profileText", () => {
  it("profiles a text's transition mix", () => {
    // "tr" = left index index (same-finger); "es" = middle->ring same hand (row-cross)
    const profile = profileText("trees and seas", SOFLE_BASE_LAYER);
    expect(profile.nTransitions).toBeGreaterThan(0);
    expect(profile.sameFinger).toBeGreaterThan(0);
    expect(profile.rowCross).toBeGreaterThan(0);
    expect(profile.nWords).toBe(3);
  });

  it("computes word boundary stats", () => {
    const profile = profileText("the sea is vast", SOFLE_BASE_LAYER);
    expect(profile.wordsEndingEst).toBe(0.75); // the, sea, vast end in e/s/t
    expect(profile.vowelInitialWords).toBe(0.25); // "is"
  });
});
