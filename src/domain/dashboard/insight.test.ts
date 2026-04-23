import { describe, expect, it } from "vitest";
import { composeDashboardInsight, type InsightInput } from "./insight";
import type { WeaknessRankEntry } from "./aggregates";

const rank = (unit: string, score: number, isCharacter = unit.length === 1): WeaknessRankEntry => ({
  unit,
  isCharacter,
  score,
  errorRatePct: 10,
  avgTimeMs: 200,
  attempts: 100,
  relativeWeightPct: 100,
});

const base = (over: Partial<InsightInput> = {}): InsightInput => ({
  totalSessions: over.totalSessions ?? 10,
  accuracyTrendPct: over.accuracyTrendPct ?? null,
  wpmTrend: over.wpmTrend ?? null,
  phase: over.phase ?? "transitioning",
  topWeaknesses: over.topWeaknesses ?? [],
});

const BANNED = [
  "amazing",
  "crushing it",
  "nailed it",
  "incredible",
  "awesome",
  "killing it",
  "rockstar",
  "legend",
];

function expectNoHype(text: string) {
  const lower = text.toLowerCase();
  for (const word of BANNED) {
    expect(lower, `contained "${word}"`).not.toContain(word);
  }
  expect(text, "stacked exclamation marks").not.toMatch(/!{2,}/);
}

describe("composeDashboardInsight — narrative", () => {
  it("single-session case uses early-data framing", () => {
    const out = composeDashboardInsight(base({ totalSessions: 1 }));
    expect(out.narrative).toMatch(/one session/i);
    expectNoHype(out.narrative);
  });

  it("speed-up + accuracy-down is framed as concern, not a win (§6.2)", () => {
    const out = composeDashboardInsight(base({ accuracyTrendPct: -2, wpmTrend: 5 }));
    expect(out.narrative.toLowerCase()).toContain("slow");
    expect(out.narrative.toLowerCase()).toContain("accuracy");
    expectNoHype(out.narrative);
  });

  it("accuracy-up + speed-flat is the right-trajectory frame", () => {
    const out = composeDashboardInsight(base({ accuracyTrendPct: 1.2, wpmTrend: 0 }));
    expect(out.narrative.toLowerCase()).toContain("accuracy is climbing");
    expectNoHype(out.narrative);
  });

  it("flat trajectory stays quiet — no hype, no panic", () => {
    const out = composeDashboardInsight(base({ accuracyTrendPct: 0, wpmTrend: 0 }));
    expect(out.narrative.toLowerCase()).toContain("steady");
    expectNoHype(out.narrative);
  });

  it("phase differentiates the tone (transitioning vs refining)", () => {
    const tr = composeDashboardInsight(
      base({ accuracyTrendPct: 1.5, wpmTrend: 0, phase: "transitioning" }),
    );
    const rf = composeDashboardInsight(
      base({ accuracyTrendPct: 1.5, wpmTrend: 0, phase: "refining" }),
    );
    expect(tr.narrative).not.toEqual(rf.narrative);
    expect(tr.narrative.toLowerCase()).toMatch(/muscle memory/);
    expect(rf.narrative.toLowerCase()).toMatch(/polish|flow/);
  });

  it("never contains banned hype words regardless of direction", () => {
    for (const acc of [null, -3, 0, 3]) {
      for (const wpm of [null, -3, 0, 3]) {
        for (const phase of ["transitioning", "refining"] as const) {
          const out = composeDashboardInsight(
            base({ accuracyTrendPct: acc, wpmTrend: wpm, phase }),
          );
          expectNoHype(out.narrative);
          expectNoHype(out.rationale);
        }
      }
    }
  });
});

describe("composeDashboardInsight — rationale", () => {
  it("returns a no-data message when there are no weaknesses", () => {
    const out = composeDashboardInsight(base({ topWeaknesses: [] }));
    expect(out.rationale).toMatch(/engine/i);
    expect(out.nextFocus).toEqual([]);
  });

  it("lists one focus unit with its score", () => {
    const out = composeDashboardInsight(base({ topWeaknesses: [rank("b", 2.8)] }));
    expect(out.rationale).toContain("b");
    expect(out.rationale).toContain("2.8");
  });

  it("joins two focus units with 'and'", () => {
    const out = composeDashboardInsight(base({ topWeaknesses: [rank("b", 2.8), rank("er", 2.1)] }));
    expect(out.rationale).toContain("b");
    expect(out.rationale).toContain("er");
    expect(out.rationale).toMatch(/ and /);
  });

  it("joins three focus units with commas + 'and' (Oxford comma)", () => {
    const out = composeDashboardInsight(
      base({
        topWeaknesses: [rank("b", 2.8), rank("er", 2.1), rank("t", 1.7)],
      }),
    );
    expect(out.rationale).toMatch(/b.*er.*and.*t/);
  });

  it("caps focus at 3 units even when more are provided", () => {
    const out = composeDashboardInsight(
      base({
        topWeaknesses: [
          rank("b", 2.8),
          rank("er", 2.1),
          rank("t", 1.7),
          rank("g", 1.5),
          rank("th", 1.3),
        ],
      }),
    );
    expect(out.nextFocus).toHaveLength(3);
    // The 4th/5th units never make the focus list — check the
    // structured data rather than the rationale string (which can
    // contain "t" and "h" adjacent in unrelated words).
    expect(out.nextFocus.map((u) => u.unit)).toEqual(["b", "er", "t"]);
  });
});
