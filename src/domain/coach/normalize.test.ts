import { describe, expect, it } from "vitest";
import { normalizePassageText } from "./normalize";

describe("normalizePassageText", () => {
  it("replaces paragraph breaks with a single space", () => {
    expect(normalizePassageText("resupply.\n\nGoods moved")).toBe("resupply. Goods moved");
  });

  it("collapses mixed whitespace runs around newlines", () => {
    expect(normalizePassageText("one\n  \ntwo")).toBe("one two");
  });

  it("replaces tabs and carriage returns", () => {
    expect(normalizePassageText("a\tb\r\nc")).toBe("a b c");
  });

  it("replaces non-breaking spaces", () => {
    expect(normalizePassageText("a\u00a0b")).toBe("a b");
  });

  it("collapses repeated regular spaces", () => {
    expect(normalizePassageText("a  b   c")).toBe("a b c");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizePassageText("  hello world  ")).toBe("hello world");
  });

  it("leaves single-line text untouched", () => {
    expect(normalizePassageText("The Silk Road was not a single road.")).toBe(
      "The Silk Road was not a single road.",
    );
  });
});
