import { describe, expect, it } from "vitest";
import { SOFLE_BASE_LAYER } from "#/domain/finger/sofle";
import { evaluateGate, BASELINE_PROFILE } from "./gate";
import type { MechanismKey } from "./mechanisms";

const crossHandHeavy = [
  "data time world base", // every word alternates hands
  "quiet theme water mind",
  "The wide world of data time and mind is a base of quiet theme. "
    + "The wide world of data time and mind is a base of quiet theme. "
    + "The wide world of data time and mind is a base of quiet theme. "
    + "The wide world of data time and mind is a base of quiet theme. "
    + "The wide world of data time and mind is a base of quiet theme. "
    + "The wide world of data time and mind is a base of quiet theme. "
    + "The wide world of data time and mind is a base of quiet theme. "
    + "The wide world of data time and mind is a base of quiet theme.",
].join("\n\n");

const metaSalad =
  "The sequence of practice and rhythm mistakes is a finger typing error letter.";

const fiveParagraphPassage = [
  "The wide world of data time and mind is a base of quiet theme. The wide world of data time and mind is a base of quiet theme. The wide world of data time and mind is a base of quiet theme.",
  "The wide world of data time and mind is a base of quiet theme. The wide world of data time and mind is a base of quiet theme. The wide world of data time and mind is a base of quiet theme.",
  "The wide world of data time and mind is a base of quiet theme. The wide world of data time and mind is a base of quiet theme. The wide world of data time and mind is a base of quiet theme.",
  "The wide world of data time and mind is a base of quiet theme. The wide world of data time and mind is a base of quiet theme. The wide world of data time and mind is a base of quiet theme.",
  "The wide world of data time and mind is a base of quiet theme. The wide world of data time and mind is a base of quiet theme. The wide world of data time and mind is a base of quiet theme.",
].join("\n\n");

describe("evaluateGate", () => {
  it("passes a cross-hand heavy passage for the cross-hand mechanism", () => {
    const result = evaluateGate("cross-hand", crossHandHeavy, SOFLE_BASE_LAYER);
    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("rejects meta-commentary", () => {
    const result = evaluateGate("cross-hand", metaSalad, SOFLE_BASE_LAYER);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes("meta"))).toBe(true);
  });

  it("rejects unknown mechanism keys instead of skipping the gate", () => {
    const result = evaluateGate(
      "cross_hand" as MechanismKey,
      crossHandHeavy,
      SOFLE_BASE_LAYER,
    );
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes("mechanism"))).toBe(true);
  });

  it("rejects under-saturated passages", () => {
    const plain = "the cat sat on a mat and the dog ran to it";
    const result = evaluateGate("cross-hand", plain, SOFLE_BASE_LAYER);
    expect(result.passed).toBe(false);
  });

  it("rejects too-short passages", () => {
    const result = evaluateGate("row-cross", "one two", SOFLE_BASE_LAYER);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes("length"))).toBe(true);
  });

  it("rejects passages with more than 3 paragraphs", () => {
    const result = evaluateGate("cross-hand", fiveParagraphPassage, SOFLE_BASE_LAYER);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes("paragraphs"))).toBe(true);
  });

  it("exports a baseline profile with PoC values", () => {
    expect(BASELINE_PROFILE.sameFinger).toBeGreaterThan(0.1);
    expect(BASELINE_PROFILE.rowCross).toBeGreaterThan(0.3);
    expect(BASELINE_PROFILE.crossHand).toBeGreaterThan(0.4);
  });
});
