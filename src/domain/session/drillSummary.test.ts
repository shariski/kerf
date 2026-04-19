import { describe, expect, it } from "vitest";
import type { KeystrokeEvent } from "#/domain/stats/types";
import {
  DRILL_MIN_PER_HALF_ATTEMPTS,
  summarizeDrill,
} from "./drillSummary";

const ts = new Date("2026-04-19T12:00:00Z");

const ev = (over: Partial<KeystrokeEvent>): KeystrokeEvent => ({
  targetChar: over.targetChar ?? "b",
  actualChar: over.actualChar ?? over.targetChar ?? "b",
  isError:
    over.isError ??
    (over.actualChar !== undefined &&
      over.actualChar !== (over.targetChar ?? "b")),
  keystrokeMs: over.keystrokeMs ?? 180,
  prevChar: over.prevChar,
  timestamp: over.timestamp ?? ts,
});

describe("summarizeDrill — basic split", () => {
  it("splits events at the midpoint", () => {
    const events = Array.from({ length: 10 }, () => ev({ targetChar: "b" }));
    const result = summarizeDrill({ events, targetChars: ["b"] });
    expect(result.splitIndex).toBe(5);
    expect(result.before.attempts).toBe(5);
    expect(result.after.attempts).toBe(5);
  });

  it("odd-length events: first half is the smaller slice", () => {
    const events = Array.from({ length: 9 }, () => ev({ targetChar: "b" }));
    const result = summarizeDrill({ events, targetChars: ["b"] });
    expect(result.splitIndex).toBe(4);
    expect(result.before.attempts).toBe(4);
    expect(result.after.attempts).toBe(5);
  });
});

describe("summarizeDrill — target filtering", () => {
  it("ignores events whose targetChar is not in the drill target set", () => {
    const events: KeystrokeEvent[] = [
      ...Array.from({ length: 10 }, () => ev({ targetChar: "b" })),
      ...Array.from({ length: 10 }, () => ev({ targetChar: "x" })),
    ];
    const result = summarizeDrill({ events, targetChars: ["b"] });
    // First half: all 10 b's, all pass the filter, no errors.
    expect(result.before.attempts).toBe(10);
    // Second half: all 10 x's, none pass the filter.
    expect(result.after.attempts).toBe(0);
  });

  it("lowercases target chars before matching", () => {
    const events = Array.from({ length: 8 }, () => ev({ targetChar: "B" }));
    const result = summarizeDrill({ events, targetChars: ["b"] });
    expect(result.before.attempts).toBe(4);
    expect(result.after.attempts).toBe(4);
  });

  it("handles a bigram target (both chars count)", () => {
    const events: KeystrokeEvent[] = [
      ev({ targetChar: "e" }),
      ev({ targetChar: "r" }),
      ev({ targetChar: "e" }),
      ev({ targetChar: "r" }),
      ev({ targetChar: "e" }),
      ev({ targetChar: "r" }),
      ev({ targetChar: "e" }),
      ev({ targetChar: "r" }),
    ];
    const result = summarizeDrill({ events, targetChars: ["e", "r"] });
    expect(result.before.attempts).toBe(4);
    expect(result.after.attempts).toBe(4);
  });
});

describe("summarizeDrill — rate math", () => {
  it("computes errorRatePct as rounded errors/attempts", () => {
    // First half: 4 attempts, 2 errors → 50%
    // Second half: 4 attempts, 1 error → 25%
    const events: KeystrokeEvent[] = [
      ev({ targetChar: "b", actualChar: "n" }),
      ev({ targetChar: "b" }),
      ev({ targetChar: "b", actualChar: "v" }),
      ev({ targetChar: "b" }),
      ev({ targetChar: "b", actualChar: "n" }),
      ev({ targetChar: "b" }),
      ev({ targetChar: "b" }),
      ev({ targetChar: "b" }),
    ];
    const result = summarizeDrill({ events, targetChars: ["b"] });
    expect(result.before.errorRatePct).toBe(50);
    expect(result.after.errorRatePct).toBe(25);
    expect(result.deltaPct).toBe(-25); // improvement
  });

  it("returns 0% when a half has no target attempts", () => {
    const events: KeystrokeEvent[] = Array.from({ length: 10 }, () =>
      ev({ targetChar: "x" }),
    );
    const result = summarizeDrill({ events, targetChars: ["b"] });
    expect(result.before.errorRatePct).toBe(0);
    expect(result.after.errorRatePct).toBe(0);
    expect(result.deltaPct).toBe(0);
  });

  it("positive delta when error rate worsens", () => {
    // First half: 0 errors → 0%; second half: 4/4 → 100%.
    const events: KeystrokeEvent[] = [
      ...Array.from({ length: 4 }, () => ev({ targetChar: "b" })),
      ...Array.from({ length: 4 }, () =>
        ev({ targetChar: "b", actualChar: "n" }),
      ),
    ];
    const result = summarizeDrill({ events, targetChars: ["b"] });
    expect(result.deltaPct).toBe(100);
  });
});

describe("summarizeDrill — insufficient data flag", () => {
  it(`flags when either half has fewer than ${DRILL_MIN_PER_HALF_ATTEMPTS} target attempts`, () => {
    // 4 total target events → 2 per half, below the threshold.
    const events = Array.from({ length: 4 }, () => ev({ targetChar: "b" }));
    const result = summarizeDrill({ events, targetChars: ["b"] });
    expect(result.insufficientData).toBe(true);
  });

  it("does NOT flag when both halves meet the minimum", () => {
    const events = Array.from({ length: 10 }, () => ev({ targetChar: "b" }));
    const result = summarizeDrill({ events, targetChars: ["b"] });
    expect(result.insufficientData).toBe(false);
  });

  it("flags when one half has the minimum but the other does not", () => {
    // First 5 are target 'b', last 1 is target 'b' — second half has 1 'b'.
    const events: KeystrokeEvent[] = [
      ...Array.from({ length: 5 }, () => ev({ targetChar: "b" })),
      ...Array.from({ length: 4 }, () => ev({ targetChar: "x" })),
      ev({ targetChar: "b" }),
    ];
    const result = summarizeDrill({ events, targetChars: ["b"] });
    expect(result.before.attempts).toBeGreaterThanOrEqual(
      DRILL_MIN_PER_HALF_ATTEMPTS,
    );
    expect(result.after.attempts).toBeLessThan(DRILL_MIN_PER_HALF_ATTEMPTS);
    expect(result.insufficientData).toBe(true);
  });
});

describe("summarizeDrill — empty input", () => {
  it("handles zero events without dividing by zero", () => {
    const result = summarizeDrill({ events: [], targetChars: ["b"] });
    expect(result.before.attempts).toBe(0);
    expect(result.after.attempts).toBe(0);
    expect(result.deltaPct).toBe(0);
    expect(result.insufficientData).toBe(true);
  });
});
