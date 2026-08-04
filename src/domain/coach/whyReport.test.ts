import { describe, expect, it } from "vitest";
import { SOFLE_BASE_LAYER } from "#/domain/finger/sofle";
import type { KeystrokeEvent } from "#/domain/stats/types";
import { computeWhyReport } from "./whyReport";

const event = (over: Partial<KeystrokeEvent>): KeystrokeEvent => ({
  targetChar: "e",
  actualChar: "s",
  isError: true,
  keystrokeMs: 150,
  prevChar: "a",
  timestamp: new Date(),
  ...over,
});

describe("computeWhyReport", () => {
  it("counts only true confusions (isError and actual != target)", () => {
    const events = [
      event({ targetChar: "e", actualChar: "s" }),
      event({ targetChar: "e", actualChar: "e" }), // correction noise
      event({ targetChar: "t", actualChar: "r" }),
    ];
    const report = computeWhyReport(events, SOFLE_BASE_LAYER);
    expect(report.totalTrueConfusions).toBe(2);
  });

  it("aggregates per-mechanism counts, shares, and avg timing", () => {
    const events = [
      event({ targetChar: "e", actualChar: "s", keystrokeMs: 100 }),
      event({ targetChar: "t", actualChar: "r", keystrokeMs: 200 }),
      event({ targetChar: "i", actualChar: "e", keystrokeMs: 150 }),
    ];
    const report = computeWhyReport(events, SOFLE_BASE_LAYER);
    const byName = Object.fromEntries(report.mechanisms.map((m) => [m.mechanism, m]));
    expect(byName["row-cross"]!.count).toBe(1);
    expect(byName["row-cross"]!.sharePct).toBeCloseTo(33.3, 0);
    expect(byName["same-finger"]!.avgMs).toBe(200);
    expect(byName["cross-hand"]!.count).toBe(1);
  });

  it("records top confusions per mechanism with counts", () => {
    const events = [
      event({ targetChar: "e", actualChar: "s" }),
      event({ targetChar: "e", actualChar: "s" }),
    ];
    const report = computeWhyReport(events, SOFLE_BASE_LAYER);
    const rowCross = report.mechanisms.find((m) => m.mechanism === "row-cross");
    expect(rowCross?.topConfusions).toEqual([{ target: "e", typedAs: "s", count: 2 }]);
  });
});
