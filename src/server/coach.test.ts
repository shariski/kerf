import { describe, expect, it } from "vitest";
import type { MechanismKey } from "#/domain/coach/mechanisms";
import type { KeystrokeEvent } from "#/domain/stats/types";
import {
  buildLlmDigest,
  isCoachBetaEligible,
  parseWordRange,
  pickTargetMechanism,
  pickTopic,
  reviewTopic,
  uniqueProductionTopic,
} from "./coach";

const ev = (over: Partial<KeystrokeEvent>): KeystrokeEvent => ({
  targetChar: "e",
  actualChar: "e",
  isError: false,
  keystrokeMs: 100,
  prevChar: "a",
  timestamp: new Date("2026-08-01T12:00:00Z"),
  ...over,
});

describe("isCoachBetaEligible", () => {
  const cutoff = "2026-09-30T16:59:59Z";
  it("keeps accounts created by the cutoff in the free beta", () => {
    expect(isCoachBetaEligible("2026-09-30T16:59:59Z", cutoff)).toBe(true);
    expect(isCoachBetaEligible("2026-10-01T00:00:00Z", cutoff)).toBe(false);
  });
  it("allows all accounts when no cohort cutoff is configured", () => {
    expect(isCoachBetaEligible("2027-01-01T00:00:00Z", undefined)).toBe(true);
  });
});

describe("pickTopic", () => {
  it("prefers the first suggested topic not already used", () => {
    expect(pickTopic(["space", "the sea"], ["space"])).toBe("the sea");
  });
  it("falls back to the first suggestion when all are used", () => {
    expect(pickTopic(["space", "the sea"], ["space", "the sea"])).toBe("space");
  });
  it("falls back to the default when there are no suggestions", () => {
    expect(pickTopic([], [])).toBe("general knowledge");
  });
  it("matches used topics case-insensitively", () => {
    expect(pickTopic(["The Sea", "Space"], ["the sea"])).toBe("Space");
  });
  it("skips themes overlapping with used topics", () => {
    expect(
      pickTopic(
        ["The Silk Road", "The Space Race"],
        ["The history of the Silk Road and its impact on trade"],
      ),
    ).toBe("The Space Race");
  });
  it("falls back to the first suggestion when every theme overlaps", () => {
    expect(pickTopic(["The Silk Road"], ["The Silk Road and its trade routes"])).toBe(
      "The Silk Road",
    );
  });
});

describe("reviewTopic", () => {
  it("uniquifies an exact topic repeat in review mode", () => {
    expect(reviewTopic("The Silk Road", ["The Silk Road", "The Apollo 11 Moon Landing"])).toBe(
      "The Silk Road — review #3",
    );
  });
  it("leaves a fresh topic alone", () => {
    expect(reviewTopic("The Space Race", ["The Silk Road"])).toBe("The Space Race");
  });
  it("matches used topics case-insensitively", () => {
    expect(reviewTopic("the silk road", ["The Silk Road"])).toBe("the silk road — review #2");
  });
});

describe("uniqueProductionTopic", () => {
  it("keeps a fresh topic unchanged", () => {
    expect(uniqueProductionTopic("The Space Race", ["The Silk Road"])).toBe("The Space Race");
  });
  it("creates a fresh catalog variant when an exact topic repeats", () => {
    expect(uniqueProductionTopic("The Silk Road", ["The Silk Road"])).toBe(
      "The Silk Road — variation 2",
    );
  });
});

describe("buildLlmDigest", () => {
  it("renders a compact JSON digest with profile and stats", () => {
    const events = [
      ev({ targetChar: "e", prevChar: undefined }),
      ev({ targetChar: "s", prevChar: "e" }),
      ev({ targetChar: "t", actualChar: "r", isError: true, prevChar: "s" }),
    ];
    const digest = JSON.parse(buildLlmDigest(events));
    expect(digest.user_profile.keystrokes).toBe(3);
    expect(digest.character_stats.length).toBeGreaterThan(0);
    expect(digest.worst_bigrams).toBeDefined();
  });
});

describe("parseWordRange", () => {
  it("defaults to 80-140 when unset", () => {
    expect(parseWordRange(undefined)).toEqual({ min: 80, max: 140 });
  });
  it("parses a staging override", () => {
    expect(parseWordRange("60,140")).toEqual({ min: 60, max: 140 });
  });
  it("falls back to the default on garbage", () => {
    expect(parseWordRange("abc")).toEqual({ min: 80, max: 140 });
  });
  it("falls back to the default when min >= max", () => {
    expect(parseWordRange("200,100")).toEqual({ min: 80, max: 140 });
  });
});

describe("pickTargetMechanism", () => {
  const mechs = ["cross-hand", "row-cross", "space/timing"] as const;
  it("keeps the main weakness dominant (60% of sessions)", () => {
    const counts: Partial<Record<MechanismKey, number>> = {
      "cross-hand": 0,
      "row-cross": 0,
      "space/timing": 0,
    };
    for (let i = 0; i < 10; i++) {
      const m = pickTargetMechanism([...mechs], i);
      counts[m] = (counts[m] ?? 0) + 1;
    }
    expect(counts["cross-hand"]).toBe(6);
    expect(counts["row-cross"]).toBe(2);
    expect(counts["space/timing"]).toBe(2);
  });
  it("rotates deterministically by session index", () => {
    expect(pickTargetMechanism([...mechs], 0)).toBe("cross-hand");
    expect(pickTargetMechanism([...mechs], 1)).toBe("cross-hand");
    expect(pickTargetMechanism([...mechs], 2)).toBe("row-cross");
    expect(pickTargetMechanism([...mechs], 4)).toBe("space/timing");
  });
  it("clamps to the available mechanisms when only two exist", () => {
    const two = ["cross-hand", "row-cross"] as const;
    expect(pickTargetMechanism([...two], 2)).toBe("row-cross");
    expect(pickTargetMechanism([...two], 4)).toBe("row-cross");
  });
  it("always targets the only mechanism when just one exists", () => {
    const one = ["cross-hand"] as const;
    for (let i = 0; i < 5; i++) {
      expect(pickTargetMechanism([...one], i)).toBe("cross-hand");
    }
  });
});
