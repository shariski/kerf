import { describe, expect, it } from "vitest";
import { REVIEW_TAGS } from "#/domain/coach/review";
import { buildLlmOutput, passageStatusFor } from "./review";

describe("passageStatusFor", () => {
  it("returns needs_review in review mode", () => {
    expect(passageStatusFor(true)).toBe("needs_review");
  });
  it("returns active outside review mode", () => {
    expect(passageStatusFor(false)).toBe("active");
  });
});

describe("buildLlmOutput", () => {
  const res = {
    content: "{\"suggested_topics\":[\"space\"]}",
    usage: { promptTokens: 10, completionTokens: 20 },
  };
  it("captures both responses, model, and latency", () => {
    const out = buildLlmOutput(res, { ...res, content: "{\"test_cases\":[]}" }, 1_000);
    expect(out.analysis.content).toContain("suggested_topics");
    expect(out.generation.content).toContain("test_cases");
    expect(out.analysis.usage.completionTokens).toBe(20);
    expect(out.model).toBeTruthy();
    expect(out.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

describe("REVIEW_TAGS", () => {
  it("has a stable, fixed tag set", () => {
    expect(REVIEW_TAGS).toEqual([
      "too easy",
      "too hard",
      "bad density",
      "meta words",
      "good density",
      "good title",
    ]);
  });
});
