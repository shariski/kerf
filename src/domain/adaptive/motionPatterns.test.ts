import { describe, expect, it } from "vitest";
import {
  verticalColumnCandidates,
  innerColumnCandidates,
  thumbClusterCandidate,
} from "./motionPatterns";
import type { CharacterStat, UserBaseline } from "../stats/types";

const baseline: UserBaseline = {
  meanErrorRate: 0.08,
  meanKeystrokeTime: 280,
  meanHesitationRate: 0.1,
  journey: "conventional",
};

const charStat = (character: string, errors: number, attempts = 100): CharacterStat => ({
  character,
  attempts,
  errors,
  sumTime: attempts * 280,
  hesitationCount: 0,
});

describe("verticalColumnCandidates", () => {
  it("returns 10 candidates (5 columns × 2 hands) when data is sufficient", () => {
    const stats: CharacterStat[] = [
      charStat("q", 5), charStat("a", 3), charStat("z", 2),
      charStat("w", 4), charStat("s", 3), charStat("x", 2),
      charStat("e", 6), charStat("d", 4), charStat("c", 3),
      charStat("r", 5), charStat("f", 3), charStat("v", 2),
      charStat("t", 8), charStat("g", 6), charStat("b", 4),
      charStat("y", 7), charStat("h", 5), charStat("n", 4),
      charStat("u", 4), charStat("j", 3), charStat("m", 2),
      charStat("i", 3), charStat("k", 2), charStat(",", 1),
      charStat("o", 2), charStat("l", 1), charStat(".", 0),
      charStat("p", 1), charStat(";", 0), charStat("/", 0),
    ];
    const candidates = verticalColumnCandidates(stats, baseline);
    expect(candidates).toHaveLength(10);
    expect(candidates.map((c) => c.type)).toEqual(Array(10).fill("vertical-column"));
  });

  it("scores each column by aggregate error rate across its 3 keys", () => {
    const stats = [
      charStat("w", 4), charStat("s", 3), charStat("x", 2),   // left-ring 9/300
      charStat("r", 5), charStat("f", 3), charStat("v", 2),   // left-index-outer 10/300
    ];
    const candidates = verticalColumnCandidates(stats, baseline);
    const leftRing = candidates.find((c) => c.value === "left-ring");
    const leftIndexOuter = candidates.find((c) => c.value === "left-index-outer");
    expect(leftIndexOuter!.score).toBeGreaterThan(leftRing!.score);
  });

  it("candidate.keys is the three keys of the column", () => {
    const stats = [charStat("w", 4), charStat("s", 3), charStat("x", 2)];
    const leftRing = verticalColumnCandidates(stats, baseline).find(
      (c) => c.value === "left-ring",
    );
    expect(leftRing!.keys).toEqual(["w", "s", "x"]);
  });

  it("returns empty array when no data", () => {
    expect(verticalColumnCandidates([], baseline)).toEqual([]);
  });
});

describe("innerColumnCandidates", () => {
  it("returns two candidates: left (B/G/T) and right (H/N/Y)", () => {
    const stats = [
      charStat("b", 2), charStat("g", 4), charStat("t", 3),
      charStat("h", 3), charStat("n", 2), charStat("y", 1),
    ];
    const candidates = innerColumnCandidates(stats, baseline);
    expect(candidates).toHaveLength(2);
    expect(candidates.map((c) => c.value).sort()).toEqual(["inner-left", "inner-right"]);
  });

  it("scores by aggregate error rate across the 3 inner keys on each hand", () => {
    const stats = [
      charStat("b", 2), charStat("g", 4), charStat("t", 3),  // left 9/300
      charStat("h", 1), charStat("n", 1), charStat("y", 1),  // right 3/300
    ];
    const candidates = innerColumnCandidates(stats, baseline);
    const left = candidates.find((c) => c.value === "inner-left")!;
    const right = candidates.find((c) => c.value === "inner-right")!;
    expect(left.score).toBeGreaterThan(right.score);
  });
});

describe("thumbClusterCandidate", () => {
  it("scores by space-key error rate (Phase A MVP)", () => {
    const stats = [charStat(" ", 5)];
    const candidate = thumbClusterCandidate(stats, baseline);
    expect(candidate).not.toBeNull();
    expect(candidate!.type).toBe("thumb-cluster");
    expect(candidate!.keys).toEqual([" "]);
  });

  it("returns null when space data is absent or below threshold", () => {
    expect(thumbClusterCandidate([], baseline)).toBeNull();
  });
});
