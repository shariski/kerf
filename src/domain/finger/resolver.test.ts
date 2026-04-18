import { describe, expect, it } from "vitest";
import { getFingerForKey } from "./resolver";

describe("getFingerForKey", () => {
  it("returns the assignment for a known key in sofle", () => {
    const assignment = getFingerForKey("sofle", "f");
    expect(assignment).toEqual({
      hand: "left",
      finger: "index",
      row: 2,
      col: 3,
    });
  });

  it("returns the assignment for a known key in lily58", () => {
    const assignment = getFingerForKey("lily58", "j");
    expect(assignment).toEqual({
      hand: "right",
      finger: "index",
      row: 2,
      col: 1,
    });
  });

  it("treats uppercase letters as their lowercase equivalent", () => {
    expect(getFingerForKey("sofle", "A")).toEqual(
      getFingerForKey("sofle", "a"),
    );
  });

  it("returns undefined for an unknown character", () => {
    expect(getFingerForKey("sofle", "\u0001")).toBeUndefined();
  });

  it("returns the space assignment", () => {
    const assignment = getFingerForKey("sofle", " ");
    expect(assignment?.finger).toBe("thumb");
  });
});
