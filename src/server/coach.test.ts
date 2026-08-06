import { describe, expect, it } from "vitest";
import { buildLlmDigest, pickTopic } from "./coach";
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
