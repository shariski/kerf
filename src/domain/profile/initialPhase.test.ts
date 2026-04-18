import { describe, expect, it } from "vitest";
import { initialPhaseForLevel } from "./initialPhase";

describe("initialPhaseForLevel", () => {
  it("maps first_day → transitioning", () => {
    expect(initialPhaseForLevel("first_day")).toBe("transitioning");
  });

  it("maps few_weeks → transitioning", () => {
    expect(initialPhaseForLevel("few_weeks")).toBe("transitioning");
  });

  it("maps comfortable → refining", () => {
    expect(initialPhaseForLevel("comfortable")).toBe("refining");
  });
});
