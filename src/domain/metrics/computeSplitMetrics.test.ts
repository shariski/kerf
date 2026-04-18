import { describe, expect, it } from "vitest";
import type { KeystrokeEvent } from "../stats/types";
import {
  INSUFFICIENT_DATA_THRESHOLD,
  computeSplitMetrics,
} from "./computeSplitMetrics";

const ts = new Date("2026-04-18T12:00:00Z");

const event = (over: Partial<KeystrokeEvent> = {}): KeystrokeEvent => ({
  targetChar: over.targetChar ?? "a",
  actualChar: over.actualChar ?? over.targetChar ?? "a",
  isError:
    over.isError ??
    (over.actualChar !== undefined &&
      over.actualChar !== (over.targetChar ?? "a")),
  keystrokeMs: over.keystrokeMs ?? 200,
  prevChar: over.prevChar,
  timestamp: over.timestamp ?? ts,
});

// Fill helper — builds `n` no-op keystrokes to cross the insufficient-data
// threshold without cluttering test bodies. Uses 'a' so these events don't
// affect inner-col / thumb / cross-hand metrics unless the test sets prevChar.
const filler = (n: number): KeystrokeEvent[] =>
  Array.from({ length: n }, () => event({ targetChar: "a" }));

describe("computeSplitMetrics — insufficient data", () => {
  it("flags empty events as insufficient and returns safe zeros", () => {
    const m = computeSplitMetrics([], "sofle");
    expect(m.insufficientData).toBe(true);
    expect(m.totalKeystrokes).toBe(0);
    expect(m.innerColErrorRate).toBe(0);
    expect(m.thumbClusterAvgMs).toBe(0);
    expect(m.crossHandBigramAvgMs).toBe(0);
    // No errors = 100% stable by convention.
    expect(m.columnarStabilityPct).toBe(1);
  });

  it(`flags totalKeystrokes < ${INSUFFICIENT_DATA_THRESHOLD} as insufficient`, () => {
    const m = computeSplitMetrics(filler(49), "sofle");
    expect(m.insufficientData).toBe(true);
  });

  it(`does not flag totalKeystrokes >= ${INSUFFICIENT_DATA_THRESHOLD}`, () => {
    const m = computeSplitMetrics(filler(50), "sofle");
    expect(m.insufficientData).toBe(false);
  });
});

describe("computeSplitMetrics — Metric 1: inner column error rate", () => {
  it("counts attempts and errors only on B/G/H/N/T/Y", () => {
    const events = [
      ...filler(50),
      event({ targetChar: "b", actualChar: "b" }),
      event({ targetChar: "b", actualChar: "v" }), // error on inner col
      event({ targetChar: "g", actualChar: "g" }),
      event({ targetChar: "h", actualChar: "h" }),
      event({ targetChar: "n", actualChar: "m" }), // error on inner col
      event({ targetChar: "t", actualChar: "t" }),
      event({ targetChar: "y", actualChar: "y" }),
      event({ targetChar: "a", actualChar: "s" }), // error, NOT inner col
    ];
    const m = computeSplitMetrics(events, "sofle");
    expect(m.innerColAttempts).toBe(7);
    expect(m.innerColErrors).toBe(2);
    expect(m.innerColErrorRate).toBeCloseTo(2 / 7, 5);
  });

  it("is case-insensitive for target characters", () => {
    const events = [
      ...filler(50),
      event({ targetChar: "B", actualChar: "B" }),
      event({ targetChar: "B", actualChar: "V" }),
    ];
    const m = computeSplitMetrics(events, "sofle");
    expect(m.innerColAttempts).toBe(2);
    expect(m.innerColErrors).toBe(1);
  });

  it("returns 0 rate (not NaN) when no inner-col attempts", () => {
    const events = filler(50);
    const m = computeSplitMetrics(events, "sofle");
    expect(m.innerColAttempts).toBe(0);
    expect(m.innerColErrorRate).toBe(0);
  });
});

describe("computeSplitMetrics — Metric 2: thumb cluster decision time", () => {
  it("averages keystrokeMs over thumb-assigned events (space in our config)", () => {
    const events = [
      ...filler(50),
      event({ targetChar: " ", keystrokeMs: 100 }),
      event({ targetChar: " ", keystrokeMs: 200 }),
      event({ targetChar: " ", keystrokeMs: 300 }),
    ];
    const m = computeSplitMetrics(events, "sofle");
    expect(m.thumbClusterCount).toBe(3);
    expect(m.thumbClusterSumMs).toBe(600);
    expect(m.thumbClusterAvgMs).toBeCloseTo(200, 5);
  });

  it("returns 0 avg when there are no thumb events", () => {
    const events = filler(50);
    const m = computeSplitMetrics(events, "sofle");
    expect(m.thumbClusterCount).toBe(0);
    expect(m.thumbClusterAvgMs).toBe(0);
  });
});

describe("computeSplitMetrics — Metric 3: cross-hand bigram timing", () => {
  it("counts bigrams where prev and target are on different hands", () => {
    // 't' is left-hand, 'h' is right-hand on our QWERTY finger table.
    const events = [
      ...filler(50),
      event({ targetChar: "h", prevChar: "t", keystrokeMs: 140 }),
      // 'e' left, 'r' left → same hand
      event({ targetChar: "r", prevChar: "e", keystrokeMs: 120 }),
      // 'e' left, 'y' right → cross-hand
      event({ targetChar: "y", prevChar: "e", keystrokeMs: 160 }),
    ];
    const m = computeSplitMetrics(events, "sofle");
    expect(m.crossHandBigramCount).toBe(2);
    expect(m.crossHandBigramSumMs).toBe(300);
    expect(m.crossHandBigramAvgMs).toBeCloseTo(150, 5);
  });

  it("excludes bigrams involving a thumb-assigned key", () => {
    // 'a' (left finger) followed by ' ' (left THUMB). Must NOT count as
    // cross-hand even though one could argue about hand membership.
    // ' ' followed by 'a': also excluded.
    const events = [
      ...filler(50),
      event({ targetChar: " ", prevChar: "a", keystrokeMs: 200 }),
      event({ targetChar: "a", prevChar: " ", keystrokeMs: 200 }),
    ];
    const m = computeSplitMetrics(events, "sofle");
    expect(m.crossHandBigramCount).toBe(0);
  });

  it("ignores events whose prevChar is missing", () => {
    const events = [
      ...filler(50),
      event({ targetChar: "h", keystrokeMs: 140 }), // no prevChar
    ];
    const m = computeSplitMetrics(events, "sofle");
    expect(m.crossHandBigramCount).toBe(0);
  });

  it("ignores events referencing chars not in the finger table", () => {
    const events = [
      ...filler(50),
      event({ targetChar: "h", prevChar: "t", keystrokeMs: 140 }),
      event({ targetChar: "?", prevChar: "t", keystrokeMs: 140 }), // ? not mapped
    ];
    const m = computeSplitMetrics(events, "sofle");
    expect(m.crossHandBigramCount).toBe(1);
  });

  it("returns 0 avg (not NaN) when no cross-hand bigrams exist", () => {
    const events = filler(50);
    const m = computeSplitMetrics(events, "sofle");
    expect(m.crossHandBigramCount).toBe(0);
    expect(m.crossHandBigramAvgMs).toBe(0);
  });
});

describe("computeSplitMetrics — Metric 4: columnar stability", () => {
  it("classifies same-hand adjacent-column error as drift (B→V)", () => {
    // 'b' is left-index col 4, 'v' is left-index col 3 — adjacent.
    const events = [
      ...filler(50),
      event({ targetChar: "b", actualChar: "v" }),
    ];
    const m = computeSplitMetrics(events, "sofle");
    expect(m.columnarDriftCount).toBe(1);
    expect(m.columnarStableCount).toBe(0);
  });

  it("classifies cross-hand error as stable not drift (B→N, QWERTY residue)", () => {
    // 'b' is LEFT index, 'n' is RIGHT index — different hands.
    const events = [
      ...filler(50),
      event({ targetChar: "b", actualChar: "n" }),
    ];
    const m = computeSplitMetrics(events, "sofle");
    expect(m.columnarStableCount).toBe(1);
    expect(m.columnarDriftCount).toBe(0);
  });

  it("classifies same-hand far-apart error as stable (B→Q)", () => {
    // 'b' left-index row 3; 'q' left-pinky row 1 — col diff > 1.
    const events = [
      ...filler(50),
      event({ targetChar: "b", actualChar: "q" }),
    ];
    const m = computeSplitMetrics(events, "sofle");
    expect(m.columnarStableCount).toBe(1);
    expect(m.columnarDriftCount).toBe(0);
  });

  it("computes stability percentage as stable / (stable + drift)", () => {
    const events = [
      ...filler(50),
      event({ targetChar: "b", actualChar: "v" }), // drift
      event({ targetChar: "b", actualChar: "n" }), // stable (cross-hand)
      event({ targetChar: "b", actualChar: "q" }), // stable (far)
    ];
    const m = computeSplitMetrics(events, "sofle");
    expect(m.columnarStableCount).toBe(2);
    expect(m.columnarDriftCount).toBe(1);
    expect(m.columnarStabilityPct).toBeCloseTo(2 / 3, 5);
  });

  it("returns 1.0 stability when there are no errors", () => {
    const m = computeSplitMetrics(filler(50), "sofle");
    expect(m.columnarStabilityPct).toBe(1);
  });

  it("skips errors whose target or typed char is not in the finger table", () => {
    const events = [
      ...filler(50),
      event({ targetChar: "?", actualChar: "b" }), // target unmapped
      event({ targetChar: "b", actualChar: "?" }), // typed unmapped
    ];
    const m = computeSplitMetrics(events, "sofle");
    expect(m.columnarStableCount).toBe(0);
    expect(m.columnarDriftCount).toBe(0);
  });
});

describe("computeSplitMetrics — layout parameter", () => {
  it("accepts 'lily58' as well as 'sofle'", () => {
    // sofle and lily58 share the alpha layer; a simple smoke test
    // confirms the layout param is threaded through to finger lookups.
    const events = [
      ...filler(50),
      event({ targetChar: "b", actualChar: "v" }),
    ];
    const sofle = computeSplitMetrics(events, "sofle");
    const lily58 = computeSplitMetrics(events, "lily58");
    expect(lily58.columnarDriftCount).toBe(sofle.columnarDriftCount);
  });
});
