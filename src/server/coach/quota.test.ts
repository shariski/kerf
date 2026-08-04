import { describe, expect, it } from "vitest";
import { utcDateString } from "./quota";

describe("utcDateString", () => {
  it("formats UTC date", () => {
    expect(utcDateString(new Date("2026-08-04T23:30:00Z"))).toBe("2026-08-04");
  });
});
