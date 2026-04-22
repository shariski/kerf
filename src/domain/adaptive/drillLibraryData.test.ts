import { describe, expect, it } from "vitest";
import { DRILL_LIBRARY } from "./drillLibraryData";
import { isValidDrillEntry } from "./drillLibrary";

describe("DRILL_LIBRARY — structural", () => {
  it("has at least 30 entries (target ~33 per ADR-003 §3)", () => {
    expect(DRILL_LIBRARY.length).toBeGreaterThanOrEqual(30);
  });

  it("every entry passes structural validation", () => {
    for (const entry of DRILL_LIBRARY) {
      expect(isValidDrillEntry(entry), `invalid: ${entry.id}`).toBe(true);
    }
  });

  it("every entry has a unique id", () => {
    const ids = DRILL_LIBRARY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers 10 vertical columns (5 left + 5 right)", () => {
    const verticals = DRILL_LIBRARY.filter((e) => e.category === "vertical-column");
    const values = new Set(verticals.map((e) => e.target.value));
    const expectedColumns = [
      "left-pinky", "left-ring", "left-middle", "left-index-outer", "left-index-inner",
      "right-index-inner", "right-index-outer", "right-middle", "right-ring", "right-pinky",
    ];
    for (const col of expectedColumns) {
      expect(values.has(col), `missing column: ${col}`).toBe(true);
    }
  });

  it("covers both inner-column sides (inner-left, inner-right)", () => {
    const inner = DRILL_LIBRARY.filter((e) => e.category === "inner-column");
    const values = new Set(inner.map((e) => e.target.value));
    expect(values.has("inner-left")).toBe(true);
    expect(values.has("inner-right")).toBe(true);
  });

  it("has at least one thumb-cluster entry", () => {
    expect(DRILL_LIBRARY.some((e) => e.category === "thumb-cluster")).toBe(true);
  });
});
