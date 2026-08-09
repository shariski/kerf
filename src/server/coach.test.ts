import { describe, expect, it } from "vitest";
import { buildLlmDigest, parseWordRange, passageTopicFor, pickTargetMechanism, pickTopic, reviewTopic } from "./coach";
import type { KeystrokeEvent } from "#/domain/stats/types";

const ev = (over: Partial<KeystrokeEvent>): KeystrokeEvent => ({
  targetChar: "e",
  actualChar: "e",
  isError: false,
  keystrokeMs: 100,
  prevChar: "a",
  timestamp: new Date("2026-08-01T12:00:00Z"),
  ...over,
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
      pickTopic(["The Silk Road", "The Space Race"], ["The history of the Silk Road and its impact on trade"]),
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

describe("passageTopicFor", () => {
  it("prefers the cycled topic in review mode", () => {
    expect(passageTopicFor(true, "The Space Race", "The Silk Road")).toBe("The Space Race");
  });
  it("keeps the LLM's refined topic outside review mode", () => {
    expect(passageTopicFor(false, "The Space Race", "The Silk Road")).toBe("The Silk Road");
  });
  it("falls back to the cycled topic when the LLM omits one", () => {
    expect(passageTopicFor(false, "The Space Race", undefined)).toBe("The Space Race");
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
  it("defaults to 120-350 when unset", () => {
    expect(parseWordRange(undefined)).toEqual({ min: 120, max: 350 });
  });
  it("parses a staging override", () => {
    expect(parseWordRange("60,140")).toEqual({ min: 60, max: 140 });
  });
  it("falls back to the default on garbage", () => {
    expect(parseWordRange("abc")).toEqual({ min: 120, max: 350 });
  });
  it("falls back to the default when min >= max", () => {
    expect(parseWordRange("200,100")).toEqual({ min: 120, max: 350 });
  });
});

describe("pickTargetMechanism", () => {
  const mechs = ["cross-hand", "row-cross", "space/timing"] as const;
  it("keeps the main weakness dominant (60% of sessions)", () => {
    const counts = { "cross-hand": 0, "row-cross": 0, "space/timing": 0 };
    for (let i = 0; i < 10; i++) {
      const m = pickTargetMechanism([...mechs], i);
      counts[m]++;
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
