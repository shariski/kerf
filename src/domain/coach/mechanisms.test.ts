import { describe, expect, it } from "vitest";
import { SOFLE_BASE_LAYER } from "#/domain/finger/sofle";
import { classifyMechanism } from "./mechanisms";

describe("classifyMechanism", () => {
  it("classifies space involvement as space/timing", () => {
    expect(classifyMechanism(" ", "e", SOFLE_BASE_LAYER)).toBe("space/timing");
    expect(classifyMechanism("e", " ", SOFLE_BASE_LAYER)).toBe("space/timing");
  });

  it("classifies same-finger transitions (t and r are both left index)", () => {
    expect(classifyMechanism("t", "r", SOFLE_BASE_LAYER)).toBe("same-finger");
  });

  it("classifies adjacent-finger same-row slips (r -> e)", () => {
    expect(classifyMechanism("r", "e", SOFLE_BASE_LAYER)).toBe("adjacent-finger");
  });

  it("classifies same-hand row crosses (e -> s)", () => {
    expect(classifyMechanism("e", "s", SOFLE_BASE_LAYER)).toBe("row-cross");
  });

  it("classifies cross-hand confusions (i -> e)", () => {
    expect(classifyMechanism("i", "e", SOFLE_BASE_LAYER)).toBe("cross-hand");
  });

  it("classifies digits typed for letters as non-alpha", () => {
    expect(classifyMechanism("a", "1", SOFLE_BASE_LAYER)).toBe("non-alpha");
  });

  it("returns null for unclassifiable pairs", () => {
    expect(classifyMechanism("2", "3", SOFLE_BASE_LAYER)).toBeNull();
  });
});
