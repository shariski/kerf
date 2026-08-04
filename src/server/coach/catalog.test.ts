import { describe, expect, it } from "vitest";
import { targetKeyFor } from "./catalog";

describe("targetKeyFor", () => {
  it("is stable regardless of mechanism order", () => {
    expect(targetKeyFor(["cross-hand", "row-cross"], "hard")).toBe(
      targetKeyFor(["row-cross", "cross-hand"], "hard"),
    );
  });
  it("differs by difficulty", () => {
    expect(targetKeyFor(["cross-hand"], "hard")).not.toBe(targetKeyFor(["cross-hand"], "easy"));
  });
});
