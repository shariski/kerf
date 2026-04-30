import { describe, expect, it } from "vitest";
import { validateCreateProfileInput, validateSwitchActiveProfileInput } from "./profile";

describe("validateCreateProfileInput", () => {
  const valid = {
    keyboardType: "sofle",
    dominantHand: "right",
    initialLevel: "first_day",
    fingerAssignment: "conventional",
  };

  it("accepts a well-formed input and returns the typed shape", () => {
    expect(validateCreateProfileInput(valid)).toEqual({ ...valid, nickname: null });
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

  it("falls back to 'unsure' when fingerAssignment is absent or unrecognised", () => {
    const without = validateCreateProfileInput({
      keyboardType: "sofle",
      dominantHand: "right",
      initialLevel: "first_day",
    });
    expect(without.fingerAssignment).toBe("unsure");

    const unknown = validateCreateProfileInput({
      keyboardType: "sofle",
      dominantHand: "right",
      initialLevel: "first_day",
      fingerAssignment: "diagonal",
    });
    expect(unknown.fingerAssignment).toBe("unsure");
  });

  it("rejects non-object input", () => {
    expect(() => validateCreateProfileInput(null)).toThrow();
    expect(() => validateCreateProfileInput("sofle")).toThrow();
    expect(() => validateCreateProfileInput(42)).toThrow();
  });

  it("rejects unknown keyboardType", () => {
    expect(() => validateCreateProfileInput({ ...valid, keyboardType: "corne" })).toThrow(
      /keyboardType/,
    );
  });

  it("rejects unknown dominantHand", () => {
    expect(() => validateCreateProfileInput({ ...valid, dominantHand: "ambidextrous" })).toThrow(
      /dominantHand/,
    );
  });

  it("rejects unknown initialLevel", () => {
    expect(() => validateCreateProfileInput({ ...valid, initialLevel: "expert" })).toThrow(
      /initialLevel/,
    );
  });

  it("rejects missing fields", () => {
    expect(() => validateCreateProfileInput({ keyboardType: "sofle" })).toThrow();
  });
});

describe("validateSwitchActiveProfileInput", () => {
  it("accepts a well-formed input and returns the typed shape", () => {
    const valid = { profileId: "abc-123" };
    expect(validateSwitchActiveProfileInput(valid)).toEqual(valid);
  });

  it("rejects non-object input", () => {
    expect(() => validateSwitchActiveProfileInput(null)).toThrow();
    expect(() => validateSwitchActiveProfileInput("abc")).toThrow();
    expect(() => validateSwitchActiveProfileInput(42)).toThrow();
  });

  it("rejects missing profileId", () => {
    expect(() => validateSwitchActiveProfileInput({})).toThrow(/profileId/);
  });

  it("rejects non-string profileId", () => {
    expect(() => validateSwitchActiveProfileInput({ profileId: 42 })).toThrow(/profileId/);
    expect(() => validateSwitchActiveProfileInput({ profileId: null })).toThrow(/profileId/);
  });

  it("rejects empty-string profileId — guards against the 'switch to nothing' no-op", () => {
    expect(() => validateSwitchActiveProfileInput({ profileId: "" })).toThrow(/profileId/);
  });
});
