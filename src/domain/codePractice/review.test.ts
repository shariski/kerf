import { describe, expect, it } from "vitest";
import type { CodeSessionEventDto } from "./session";
import { codeErrorPositions, summarizeCodeFocusEvidence } from "./review";

function event(targetChar: string, isError = false): CodeSessionEventDto {
  return {
    targetChar,
    actualChar: isError ? "x" : targetChar,
    isError,
    keystrokeMs: 100,
    timestamp: "2026-10-01T00:00:00.000Z",
  };
}

describe("code focus evidence", () => {
  it("counts corrections at target positions without shifting later evidence", () => {
    const text = "x[0]";
    const events = [event("x"), event("[", true), event("["), event("0"), event("]")];
    expect(summarizeCodeFocusEvidence(text, events, "brackets")).toEqual({
      attempts: 3,
      errors: 1,
      accuracyPct: 67,
      errorPositions: [1],
    });
    expect(codeErrorPositions(events)).toEqual([{ index: 1, expected: "[", typed: "x" }]);
  });

  it("separates leading indentation from ordinary spaces", () => {
    const text = "a b\n  c";
    const events = [...text].map((char) => event(char));
    expect(summarizeCodeFocusEvidence(text, events, "indentation")).toEqual({
      attempts: 3,
      errors: 0,
      accuracyPct: 100,
      errorPositions: [],
    });
  });

  it("counts a Tab indentation as one focused action and keeps brackets separate", () => {
    const text = "x\n    (y)";
    const events = [...text].map((char) => event(char));
    for (let index = 2; index < 6; index++) {
      events[index] = { ...events[index]!, inputMethod: "tabExpansion" };
    }
    expect(summarizeCodeFocusEvidence(text, events, "indentation").attempts).toBe(2);
    expect(summarizeCodeFocusEvidence(text, events, "brackets").attempts).toBe(2);
    expect(summarizeCodeFocusEvidence(text, events, "symbols").attempts).toBe(0);
  });
});
