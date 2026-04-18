import { describe, expect, it } from "vitest";
import { validateCreateProfileInput } from "./profile";

describe("validateCreateProfileInput", () => {
  const valid = {
    keyboardType: "sofle",
    dominantHand: "right",
    initialLevel: "first_day",
  };

  it("accepts a well-formed input and returns the typed shape", () => {
    expect(validateCreateProfileInput(valid)).toEqual(valid);
  });

  it("accepts every allowed enum value", () => {
    for (const keyboardType of ["sofle", "lily58"]) {
      for (const dominantHand of ["left", "right"]) {
        for (const initialLevel of ["first_day", "few_weeks", "comfortable"]) {
          expect(() =>
            validateCreateProfileInput({
              keyboardType,
              dominantHand,
              initialLevel,
            }),
          ).not.toThrow();
        }
      }
    }
  });

  it("rejects non-object input", () => {
    expect(() => validateCreateProfileInput(null)).toThrow();
    expect(() => validateCreateProfileInput("sofle")).toThrow();
    expect(() => validateCreateProfileInput(42)).toThrow();
  });

  it("rejects unknown keyboardType", () => {
    expect(() =>
      validateCreateProfileInput({ ...valid, keyboardType: "corne" }),
    ).toThrow(/keyboardType/);
  });

  it("rejects unknown dominantHand", () => {
    expect(() =>
      validateCreateProfileInput({ ...valid, dominantHand: "ambidextrous" }),
    ).toThrow(/dominantHand/);
  });

  it("rejects unknown initialLevel", () => {
    expect(() =>
      validateCreateProfileInput({ ...valid, initialLevel: "expert" }),
    ).toThrow(/initialLevel/);
  });

  it("rejects missing fields", () => {
    expect(() =>
      validateCreateProfileInput({ keyboardType: "sofle" }),
    ).toThrow();
  });
});
