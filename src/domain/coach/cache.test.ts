import { describe, expect, it } from "vitest";
import { shouldRestoreCoachCache } from "./cache";

const cached = {
  passage: { id: "first" },
  quota: { remaining: 4 },
  reviewMode: false,
};

describe("shouldRestoreCoachCache", () => {
  it("restores an unfinished passage after a reload", () => {
    expect(shouldRestoreCoachCache(cached, null)).toBe(true);
  });

  it("advances after completion while new sessions remain", () => {
    expect(shouldRestoreCoachCache(cached, "first")).toBe(false);
  });

  it("keeps the last passage repeatable after the limit", () => {
    expect(shouldRestoreCoachCache({ ...cached, quota: { remaining: 0 } }, "first")).toBe(true);
  });
});
