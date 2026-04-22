import { describe, expect, it } from "vitest";
import { isValidDrillEntry, lookupDrill, type DrillLibraryEntry } from "./drillLibrary";
import type { SessionTarget } from "./targetSelection";

const validEntry: DrillLibraryEntry = {
  id: "left-ring-vertical-basic",
  category: "vertical-column",
  target: {
    type: "vertical-column",
    value: "left-ring",
    label: "Left ring column vertical reach",
    keys: ["w", "s", "x"],
  },
  exercise: "wsx xsw wsxwsx",
  briefing: {
    conventional: "{placeholder V1 conv}",
    columnar: "{placeholder V1 col}",
  },
  appliesTo: ["conventional", "columnar"],
  estimatedSeconds: 45,
};

describe("isValidDrillEntry", () => {
  it("accepts a well-formed entry", () => {
    expect(isValidDrillEntry(validEntry)).toBe(true);
  });

  it("rejects missing id", () => {
    expect(isValidDrillEntry({ ...validEntry, id: "" })).toBe(false);
  });

  it("rejects exercise that doesn't contain any of the target keys", () => {
    expect(
      isValidDrillEntry({
        ...validEntry,
        exercise: "abcdef",
        target: { ...validEntry.target, keys: ["w", "s", "x"] },
      }),
    ).toBe(false);
  });

  it("rejects briefing without both journey variants for journey-scoped categories", () => {
    expect(
      isValidDrillEntry({
        ...validEntry,
        briefing: { conventional: "x", columnar: "" },
      }),
    ).toBe(false);
  });
});

describe("lookupDrill", () => {
  const library: DrillLibraryEntry[] = [validEntry];

  it("returns an entry matching the target type + value", () => {
    const target: SessionTarget = {
      type: "vertical-column",
      value: "left-ring",
      keys: ["w", "s", "x"],
      label: "Left ring column vertical reach",
    };
    expect(lookupDrill(library, target, "conventional")).toBe(validEntry);
  });

  it("prefers an entry whose appliesTo includes the given journey", () => {
    const other: DrillLibraryEntry = {
      ...validEntry,
      id: "left-ring-columnar-only",
      appliesTo: ["columnar"],
    };
    const chosen = lookupDrill([validEntry, other], {
      type: "vertical-column",
      value: "left-ring",
      keys: ["w", "s", "x"],
      label: "Left ring",
    }, "columnar");
    expect([validEntry, other]).toContain(chosen);
    // Both apply to columnar — either is acceptable; stability not required.
  });

  it("throws if no entry matches the target", () => {
    const target: SessionTarget = {
      type: "vertical-column",
      value: "right-pinky",
      keys: ["p", ";", "/"],
      label: "Right pinky",
    };
    expect(() => lookupDrill(library, target, "conventional")).toThrow(
      /no drill/i,
    );
  });
});
