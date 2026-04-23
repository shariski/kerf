import { describe, expect, it } from "vitest";
import { DECAY_WINDOW_DAYS } from "./baselines";
import { decayStats, decayWeight } from "./decayStats";
import type { KeystrokeEvent } from "./types";

const ASOF = new Date("2026-04-18T12:00:00Z");

const daysAgo = (days: number): Date => new Date(ASOF.getTime() - days * 24 * 60 * 60 * 1000);

const event = (timestamp: Date): KeystrokeEvent => ({
  targetChar: "a",
  actualChar: "a",
  isError: false,
  keystrokeMs: 200,
  timestamp,
});

describe("decayWeight", () => {
  it("is 1.0 for an event happening exactly at asOf", () => {
    expect(decayWeight(ASOF, ASOF)).toBe(1);
  });

  it("is 1.0 for future events (clock skew tolerance)", () => {
    expect(decayWeight(daysAgo(-5), ASOF)).toBe(1);
  });

  it("is 0.0 for events exactly at the decay window edge", () => {
    expect(decayWeight(daysAgo(DECAY_WINDOW_DAYS), ASOF)).toBe(0);
  });

  it("is 0.0 for events older than the decay window", () => {
    expect(decayWeight(daysAgo(60), ASOF)).toBe(0);
  });

  it("is 0.5 at the linear midpoint of the decay window", () => {
    expect(decayWeight(daysAgo(15), ASOF)).toBeCloseTo(0.5, 5);
  });

  it("is 0.9 ten percent into the window (3 days old)", () => {
    expect(decayWeight(daysAgo(3), ASOF)).toBeCloseTo(0.9, 5);
  });
});

describe("decayStats", () => {
  it("returns a parallel array preserving event order", () => {
    const events = [event(daysAgo(1)), event(daysAgo(10)), event(daysAgo(20))];
    const decayed = decayStats(events, ASOF);
    expect(decayed).toHaveLength(3);
    expect(decayed.map((e) => e.timestamp)).toEqual(events.map((e) => e.timestamp));
  });

  it("attaches a weight in [0, 1] to every event", () => {
    const events = [event(daysAgo(0)), event(daysAgo(15)), event(daysAgo(45))];
    const decayed = decayStats(events, ASOF);
    expect(decayed[0]?.weight).toBe(1);
    expect(decayed[1]?.weight).toBeCloseTo(0.5, 5);
    expect(decayed[2]?.weight).toBe(0);
  });

  it("does not mutate the input events", () => {
    const original = event(daysAgo(5));
    const decayed = decayStats([original], ASOF);
    expect(original).not.toHaveProperty("weight");
    expect(decayed[0]).toMatchObject({ ...original, weight: expect.any(Number) });
  });

  it("returns an empty array for empty input", () => {
    expect(decayStats([], ASOF)).toEqual([]);
  });
});
