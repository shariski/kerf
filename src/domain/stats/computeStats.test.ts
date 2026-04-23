import { describe, expect, it } from "vitest";
import { computeStats } from "./computeStats";
import type { KeystrokeEvent, WeightedKeystrokeEvent } from "./types";

const at = new Date("2026-04-18T12:00:00Z");

const ev = (targetChar: string, opts: Partial<KeystrokeEvent> = {}): KeystrokeEvent => ({
  targetChar,
  actualChar: opts.actualChar ?? targetChar,
  isError: opts.isError ?? false,
  keystrokeMs: opts.keystrokeMs ?? 200,
  prevChar: opts.prevChar,
  timestamp: opts.timestamp ?? at,
});

const findChar = (result: ReturnType<typeof computeStats>, ch: string) =>
  result.characters.find((c) => c.character === ch);

const findBigram = (result: ReturnType<typeof computeStats>, bg: string) =>
  result.bigrams.find((b) => b.bigram === bg);

describe("computeStats — character aggregation", () => {
  it("returns empty stats for empty input", () => {
    const result = computeStats([], { hesitationThresholdMs: 500 });
    expect(result).toEqual({ characters: [], bigrams: [] });
  });

  it("counts attempts per distinct target character", () => {
    const result = computeStats([ev("a"), ev("a"), ev("b")], { hesitationThresholdMs: 500 });
    expect(findChar(result, "a")?.attempts).toBe(2);
    expect(findChar(result, "b")?.attempts).toBe(1);
  });

  it("counts errors only when isError is true", () => {
    const result = computeStats([ev("a"), ev("a", { isError: true, actualChar: "s" })], {
      hesitationThresholdMs: 500,
    });
    expect(findChar(result, "a")).toMatchObject({ attempts: 2, errors: 1 });
  });

  it("sums keystroke time per character", () => {
    const result = computeStats([ev("a", { keystrokeMs: 100 }), ev("a", { keystrokeMs: 250 })], {
      hesitationThresholdMs: 500,
    });
    expect(findChar(result, "a")?.sumTime).toBe(350);
  });

  it("flags a keystroke as hesitation when keystrokeMs > threshold", () => {
    const result = computeStats(
      [ev("a", { keystrokeMs: 200 }), ev("a", { keystrokeMs: 400 }), ev("a", { keystrokeMs: 600 })],
      { hesitationThresholdMs: 500 },
    );
    expect(findChar(result, "a")?.hesitationCount).toBe(1);
  });

  it("does not flag a keystroke at exactly the threshold", () => {
    const result = computeStats([ev("a", { keystrokeMs: 500 })], { hesitationThresholdMs: 500 });
    expect(findChar(result, "a")?.hesitationCount).toBe(0);
  });

  it("normalizes characters to lowercase before grouping", () => {
    const result = computeStats([ev("A"), ev("a")], { hesitationThresholdMs: 500 });
    expect(result.characters).toHaveLength(1);
    expect(findChar(result, "a")?.attempts).toBe(2);
  });
});

describe("computeStats — bigram aggregation", () => {
  it("forms a bigram when prevChar is set", () => {
    const result = computeStats([ev("h"), ev("e", { prevChar: "h" })], {
      hesitationThresholdMs: 500,
    });
    expect(findBigram(result, "he")).toMatchObject({
      attempts: 1,
      errors: 0,
      sumTime: 200,
    });
  });

  it("skips bigram formation when prevChar is undefined", () => {
    const result = computeStats([ev("h"), ev("e")], { hesitationThresholdMs: 500 });
    expect(result.bigrams).toEqual([]);
  });

  it("counts bigram errors when the second key was an error", () => {
    const result = computeStats([ev("e", { prevChar: "h", isError: true, actualChar: "r" })], {
      hesitationThresholdMs: 500,
    });
    expect(findBigram(result, "he")?.errors).toBe(1);
  });

  it("normalizes bigrams to lowercase", () => {
    const result = computeStats([ev("E", { prevChar: "H" }), ev("e", { prevChar: "h" })], {
      hesitationThresholdMs: 500,
    });
    expect(result.bigrams).toHaveLength(1);
    expect(findBigram(result, "he")?.attempts).toBe(2);
  });
});

describe("computeStats — weighted aggregation", () => {
  it("treats unweighted events as weight 1.0", () => {
    const result = computeStats([ev("a"), ev("a")], {
      hesitationThresholdMs: 500,
    });
    expect(findChar(result, "a")?.attempts).toBe(2);
  });

  it("scales attempts/errors/time by weight when present", () => {
    const events: WeightedKeystrokeEvent[] = [
      { ...ev("a", { keystrokeMs: 200 }), weight: 1 },
      { ...ev("a", { keystrokeMs: 200, isError: true, actualChar: "s" }), weight: 0.5 },
    ];
    const result = computeStats(events, { hesitationThresholdMs: 500 });
    const a = findChar(result, "a");
    expect(a?.attempts).toBeCloseTo(1.5, 5);
    expect(a?.errors).toBeCloseTo(0.5, 5);
    expect(a?.sumTime).toBeCloseTo(300, 5);
  });

  it("drops events whose weight is 0 from aggregation entirely", () => {
    const events: WeightedKeystrokeEvent[] = [
      { ...ev("a"), weight: 0 },
      { ...ev("b"), weight: 1 },
    ];
    const result = computeStats(events, { hesitationThresholdMs: 500 });
    expect(findChar(result, "a")).toBeUndefined();
    expect(findChar(result, "b")?.attempts).toBe(1);
  });
});
