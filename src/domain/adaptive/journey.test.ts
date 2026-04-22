import { describe, expect, it } from "vitest";
import { toJourneyCode, type JourneyCode } from "./journey";

describe("toJourneyCode", () => {
  it("narrows known journey codes", () => {
    expect(toJourneyCode("conventional")).toBe("conventional");
    expect(toJourneyCode("columnar")).toBe("columnar");
    expect(toJourneyCode("unsure")).toBe("unsure");
  });

  it("defaults null / undefined to 'unsure'", () => {
    expect(toJourneyCode(null)).toBe("unsure");
    expect(toJourneyCode(undefined)).toBe("unsure");
  });

  it("defaults unknown strings to 'unsure' (forward-compat if DB grows new codes)", () => {
    expect(toJourneyCode("something-else")).toBe("unsure");
    expect(toJourneyCode("")).toBe("unsure");
  });

  it("type: JourneyCode is the union literal", () => {
    const c: JourneyCode = "conventional";
    const k: JourneyCode = "columnar";
    const u: JourneyCode = "unsure";
    expect([c, k, u]).toEqual(["conventional", "columnar", "unsure"]);
  });
});
