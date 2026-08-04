import { describe, expect, it } from "vitest";
import { buildLlmDigest } from "./coach";
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
