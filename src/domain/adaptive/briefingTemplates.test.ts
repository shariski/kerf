import { describe, expect, it } from "vitest";
import { buildBriefing } from "./briefingTemplates";
import type { SessionTarget } from "./targetSelection";

const target = (over: Partial<SessionTarget> = {}): SessionTarget => ({
  type: "vertical-column",
  value: "left-ring",
  keys: ["w", "s", "x"],
  label: "Left ring column vertical reach",
  ...over,
});

describe("buildBriefing — V1 vertical-column", () => {
  it("returns distinct text for conventional vs columnar journeys", () => {
    const conv = buildBriefing(target(), "conventional", "transitioning");
    const col = buildBriefing(target(), "columnar", "transitioning");
    expect(conv.text).not.toBe(col.text);
    expect(conv.keys).toEqual(["w", "s", "x"]);
    expect(col.keys).toEqual(["w", "s", "x"]);
  });

  it("conventional copy mentions row-staggered / vertical motion", () => {
    const { text } = buildBriefing(target(), "conventional", "transitioning");
    expect(text.toLowerCase()).toMatch(/row-staggered|vertical/);
  });

  it("columnar copy mentions column practice / smoothness", () => {
    const { text } = buildBriefing(target(), "columnar", "transitioning");
    expect(text.toLowerCase()).toMatch(/column|smooth/);
  });
});

describe("buildBriefing — V2 inner-column", () => {
  const innerT = target({
    type: "inner-column",
    value: "inner-left",
    keys: ["b", "g", "t"],
    label: "Inner-column reach — B, G, T",
  });
  it("renders inner-column copy", () => {
    const { text } = buildBriefing(innerT, "conventional", "transitioning");
    expect(text.toLowerCase()).toMatch(/inner column/);
  });
});

describe("buildBriefing — V3 thumb-cluster", () => {
  const thumbT = target({
    type: "thumb-cluster",
    value: "space",
    keys: [" "],
    label: "Thumb cluster — space activation",
  });
  it("is shared across journeys (same copy)", () => {
    const a = buildBriefing(thumbT, "conventional", "transitioning");
    const b = buildBriefing(thumbT, "columnar", "transitioning");
    expect(a.text).toBe(b.text);
  });
  it("mentions thumb", () => {
    expect(buildBriefing(thumbT, "conventional", "transitioning").text.toLowerCase()).toMatch(
      /thumb/,
    );
  });
});

describe("buildBriefing — V6 character target", () => {
  const charT = target({ type: "character", value: "g", keys: ["g"], label: "Your weakness: G" });
  it("mentions the target character", () => {
    const { text } = buildBriefing(charT, "conventional", "transitioning");
    expect(text).toMatch(/G/); // literal target inside the copy
  });
});

describe("buildBriefing — V7 diagnostic", () => {
  const dx = target({ type: "diagnostic", value: "baseline", keys: [], label: "Baseline capture" });
  it("uses baseline-capture language", () => {
    const { text } = buildBriefing(dx, "conventional", "transitioning");
    expect(text.toLowerCase()).toMatch(/baseline/);
  });
});

describe("buildBriefing — no verdict/hype language (CLAUDE.md §B3)", () => {
  const types: SessionTarget["type"][] = [
    "vertical-column",
    "inner-column",
    "thumb-cluster",
    "hand-isolation",
    "cross-hand-bigram",
    "character",
    "bigram",
    "diagnostic",
  ];
  for (const t of types) {
    it(`${t}: no hype/verdict words`, () => {
      const { text } = buildBriefing(
        target({ type: t, value: "x", keys: ["x"], label: "x" }),
        "conventional",
        "transitioning",
      );
      expect(text).not.toMatch(/amazing|crushing|nailed|incredible|!!/i);
      expect(text.toLowerCase()).not.toMatch(/pass\/fail|target met|target missed|personal best/);
    });
  }
});
