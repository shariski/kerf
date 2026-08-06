import { describe, expect, it } from "vitest";
import { z } from "zod";
import { REVIEW_TAGS } from "#/domain/coach/review";
import { annotateCoachPassageSchema, buildLlmOutput, passageStatusFor } from "./review";

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

describe("annotateCoachPassageSchema", () => {
  const valid = {
    passageId: "92898d6c-9538-43f6-92b4-198e87a11cbf",
    verdict: "good",
    rating: 4,
    tags: ["good density"],
    note: "nice passage",
  };
  it("accepts a valid payload", () => {
    expect(annotateCoachPassageSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects an unknown verdict", () => {
    const r = annotateCoachPassageSchema.safeParse({ ...valid, verdict: "maybe" });
    expect(r.success).toBe(false);
  });
  it("rejects rating out of range", () => {
    expect(annotateCoachPassageSchema.safeParse({ ...valid, rating: 6 }).success).toBe(false);
  });
  it("rejects unknown tags", () => {
    expect(annotateCoachPassageSchema.safeParse({ ...valid, tags: ["spam"] }).success).toBe(false);
  });
  it("rejects more than 5 tags", () => {
    const tags = ["too easy", "too hard", "bad density", "meta words", "good density", "good title"];
    expect(annotateCoachPassageSchema.safeParse({ ...valid, tags }).success).toBe(false);
  });
  it("allows an empty note", () => {
    expect(annotateCoachPassageSchema.safeParse({ ...valid, note: "" }).success).toBe(true);
  });
});
