import { describe, expect, it } from "vitest";
import { SOFLE_BASE_LAYER } from "#/domain/finger/sofle";
import type { KeystrokeEvent } from "#/domain/stats/types";
import { computeMechanismPerformance } from "./mechanismPerformance";

const ev = (over: Partial<KeystrokeEvent>): KeystrokeEvent => ({
  targetChar: "e",
  actualChar: "e",
  isError: false,
  keystrokeMs: 100,
  prevChar: "a",
  timestamp: new Date(),
  ...over,
});

describe("computeMechanismPerformance", () => {
  it("counts attempts and errors per transition mechanism", () => {
    const events = [
      // t->r: left index to left index = same-finger
      ev({ targetChar: "r", prevChar: "t", isError: false }),
      ev({ targetChar: "r", prevChar: "t", isError: true }),
      // i->e: right middle to left middle = cross-hand
      ev({ targetChar: "e", prevChar: "i", isError: true }),
    ];
    const perf = computeMechanismPerformance(events, SOFLE_BASE_LAYER);
    const sf = perf.find((p) => p.mechanism === "same-finger");
    const ch = perf.find((p) => p.mechanism === "cross-hand");
    expect(sf?.attempts).toBe(2);
    expect(sf?.errors).toBe(1);
    expect(sf?.errorRate).toBeCloseTo(0.5, 2);
    expect(ch?.attempts).toBe(1);
    expect(ch?.errors).toBe(1);
    expect(ch?.errorRate).toBe(1);
  });

  it("classifies space transitions as space/timing", () => {
    const events = [ev({ targetChar: " ", prevChar: "e", isError: true })];
    const perf = computeMechanismPerformance(events, SOFLE_BASE_LAYER);
    const st = perf.find((p) => p.mechanism === "space/timing");
    expect(st?.attempts).toBe(1);
    expect(st?.errors).toBe(1);
  });

  it("skips events without prevChar", () => {
    const events = [ev({ prevChar: undefined })];
    const perf = computeMechanismPerformance(events, SOFLE_BASE_LAYER);
    expect(perf).toEqual([]);
  });

  it("sorts mechanisms by error count descending", () => {
    const events = [
      ev({ targetChar: "r", prevChar: "t", isError: true }),
      ev({ targetChar: "e", prevChar: "i", isError: true }),
      ev({ targetChar: "e", prevChar: "i", isError: true }),
    ];
    const perf = computeMechanismPerformance(events, SOFLE_BASE_LAYER);
    expect(perf[0]!.mechanism).toBe("cross-hand");
  });
});
