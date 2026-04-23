import { describe, expect, it } from "vitest";
import type { KeystrokeEvent } from "#/domain/stats/types";
import { summarizeSession } from "./summarize";

const ts = new Date("2026-04-19T12:00:00Z");

const event = (over: Partial<KeystrokeEvent>): KeystrokeEvent => ({
  targetChar: over.targetChar ?? "a",
  actualChar: over.actualChar ?? over.targetChar ?? "a",
  isError:
    over.isError ?? (over.actualChar !== undefined && over.actualChar !== (over.targetChar ?? "a")),
  keystrokeMs: over.keystrokeMs ?? 180,
  prevChar: over.prevChar,
  timestamp: over.timestamp ?? ts,
});

/**
 * Build a flawless session: every char of `target` typed correctly.
 * prevChar is wired per the reducer's semantics (undefined after spaces).
 */
const flawless = (target: string): KeystrokeEvent[] => {
  const events: KeystrokeEvent[] = [];
  let prev: string | undefined;
  for (const ch of target) {
    events.push(event({ targetChar: ch, prevChar: prev }));
    prev = ch === " " ? undefined : ch;
  }
  return events;
};

describe("summarizeSession — accuracy and wpm", () => {
  it("returns 100% accuracy for a clean run", () => {
    const summary = summarizeSession({
      target: "hello world",
      events: flawless("hello world"),
      keyboardType: "sofle",
      startedAt: 0,
      completedAt: 60_000,
      phase: "transitioning",
    });
    expect(summary.accuracyPct).toBe(100);
    expect(summary.totalErrors).toBe(0);
    expect(summary.errorPositions).toEqual([]);
  });

  it("rounds accuracy down when mixed", () => {
    // 3 correct, 1 error → 75%
    const events: KeystrokeEvent[] = [
      event({ targetChar: "a" }),
      event({ targetChar: "b", actualChar: "v" }),
      event({ targetChar: "b" }),
      event({ targetChar: "c" }),
    ];
    const summary = summarizeSession({
      target: "abc",
      events,
      keyboardType: "sofle",
      startedAt: 0,
      completedAt: 10_000,
      phase: "transitioning",
    });
    expect(summary.accuracyPct).toBe(75);
    expect(summary.totalErrors).toBe(1);
    expect(summary.totalKeystrokes).toBe(4);
  });

  it("reports 0 WPM for sub-2s sessions (noise guard)", () => {
    const summary = summarizeSession({
      target: "ab",
      events: flawless("ab"),
      keyboardType: "sofle",
      startedAt: 0,
      completedAt: 500,
      phase: "transitioning",
    });
    expect(summary.wpm).toBe(0);
  });

  it("computes wpm using only correct keystrokes", () => {
    // 50 correct chars in 60s = 10 WPM
    const events = Array.from({ length: 50 }, () => event({ targetChar: "a" }));
    const summary = summarizeSession({
      target: "a".repeat(50),
      events,
      keyboardType: "sofle",
      startedAt: 0,
      completedAt: 60_000,
      phase: "transitioning",
    });
    expect(summary.wpm).toBe(10);
  });

  it("handles missing timestamps gracefully", () => {
    const summary = summarizeSession({
      target: "ab",
      events: flawless("ab"),
      keyboardType: "sofle",
      startedAt: null,
      completedAt: null,
      phase: "transitioning",
    });
    expect(summary.elapsedMs).toBe(0);
    expect(summary.wpm).toBe(0);
    expect(summary.elapsedLabel).toBe("0:00");
  });

  it("subtracts pausedMs from elapsed so idle time doesn't deflate WPM", () => {
    // 50 correct chars over 120s wall time, but 60s was paused.
    // Effective elapsed = 60s → 10 WPM, matching the unpaused run above.
    const events = Array.from({ length: 50 }, () => event({ targetChar: "a" }));
    const summary = summarizeSession({
      target: "a".repeat(50),
      events,
      keyboardType: "sofle",
      startedAt: 0,
      completedAt: 120_000,
      pausedMs: 60_000,
      phase: "transitioning",
    });
    expect(summary.elapsedMs).toBe(60_000);
    expect(summary.wpm).toBe(10);
  });

  it("clamps elapsed at 0 if pausedMs exceeds wall time (defensive)", () => {
    const summary = summarizeSession({
      target: "ab",
      events: flawless("ab"),
      keyboardType: "sofle",
      startedAt: 0,
      completedAt: 1_000,
      pausedMs: 5_000,
      phase: "transitioning",
    });
    expect(summary.elapsedMs).toBe(0);
    expect(summary.wpm).toBe(0);
  });
});

describe("summarizeSession — elapsed formatting", () => {
  it("pads seconds to two digits", () => {
    const summary = summarizeSession({
      target: "a",
      events: flawless("a"),
      keyboardType: "sofle",
      startedAt: 0,
      completedAt: 4_000,
      phase: "transitioning",
    });
    expect(summary.elapsedLabel).toBe("0:04");
  });

  it("formats minutes:seconds", () => {
    const summary = summarizeSession({
      target: "a",
      events: flawless("a"),
      keyboardType: "sofle",
      startedAt: 0,
      completedAt: 134_000,
      phase: "transitioning",
    });
    expect(summary.elapsedLabel).toBe("2:14");
  });
});

describe("summarizeSession — word count", () => {
  it("counts whitespace-separated words", () => {
    const summary = summarizeSession({
      target: "the quick brown fox",
      events: flawless("the quick brown fox"),
      keyboardType: "sofle",
      startedAt: 0,
      completedAt: 60_000,
      phase: "transitioning",
    });
    expect(summary.wordCount).toBe(4);
  });

  it("returns 0 for an empty target", () => {
    const summary = summarizeSession({
      target: "",
      events: [],
      keyboardType: "sofle",
      startedAt: 0,
      completedAt: 0,
      phase: "transitioning",
    });
    expect(summary.wordCount).toBe(0);
  });
});

describe("summarizeSession — totalErrors vs uniqueErrorCount", () => {
  it("counts every wrong keystroke in totalErrors", () => {
    // 'b' mistyped as 'x' then 'y' then correctly as 'b' → 2 wrong keystrokes.
    const events: KeystrokeEvent[] = [
      event({ targetChar: "a" }),
      event({ targetChar: "b", actualChar: "x" }),
      event({ targetChar: "b", actualChar: "y" }),
      event({ targetChar: "b" }),
    ];
    const summary = summarizeSession({
      target: "ab",
      events,
      keyboardType: "sofle",
      startedAt: 0,
      completedAt: 10_000,
      phase: "transitioning",
    });
    expect(summary.totalErrors).toBe(2);
    expect(summary.uniqueErrorCount).toBe(1); // one distinct position
  });

  it("counts one wrong keystroke as one of each", () => {
    const events: KeystrokeEvent[] = [
      event({ targetChar: "a" }),
      event({ targetChar: "b", actualChar: "v" }),
      event({ targetChar: "b" }),
    ];
    const summary = summarizeSession({
      target: "ab",
      events,
      keyboardType: "sofle",
      startedAt: 0,
      completedAt: 10_000,
      phase: "transitioning",
    });
    expect(summary.totalErrors).toBe(1);
    expect(summary.uniqueErrorCount).toBe(1);
  });

  it("reports uniqueErrorCount === errorPositions.length", () => {
    const events: KeystrokeEvent[] = [
      event({ targetChar: "a", actualChar: "q" }),
      event({ targetChar: "a", actualChar: "w" }), // 2nd wrong attempt at pos 0
      event({ targetChar: "a" }),
      event({ targetChar: "b" }),
      event({ targetChar: "c", actualChar: "x" }),
      event({ targetChar: "c" }),
    ];
    const summary = summarizeSession({
      target: "abc",
      events,
      keyboardType: "sofle",
      startedAt: 0,
      completedAt: 10_000,
      phase: "transitioning",
    });
    expect(summary.totalErrors).toBe(3);
    expect(summary.uniqueErrorCount).toBe(2);
    expect(summary.uniqueErrorCount).toBe(summary.errorPositions.length);
  });
});

describe("summarizeSession — error positions", () => {
  it("records each error at the correct target position", () => {
    // target = "abc", user: 'a' → 'v' (error at pos 1) → 'b' (correct) → 'c'
    const events: KeystrokeEvent[] = [
      event({ targetChar: "a" }),
      event({ targetChar: "b", actualChar: "v" }),
      event({ targetChar: "b" }),
      event({ targetChar: "c" }),
    ];
    const summary = summarizeSession({
      target: "abc",
      events,
      keyboardType: "sofle",
      startedAt: 0,
      completedAt: 10_000,
      phase: "transitioning",
    });
    expect(summary.errorPositions).toEqual([{ index: 1, expected: "b", typed: "v" }]);
  });

  it("keeps only the FIRST error at each position, even if user mistypes multiple times", () => {
    // target = "ab", user: 'a' → 'x' → 'y' → 'b'
    const events: KeystrokeEvent[] = [
      event({ targetChar: "a" }),
      event({ targetChar: "b", actualChar: "x" }),
      event({ targetChar: "b", actualChar: "y" }),
      event({ targetChar: "b" }),
    ];
    const summary = summarizeSession({
      target: "ab",
      events,
      keyboardType: "sofle",
      startedAt: 0,
      completedAt: 10_000,
      phase: "transitioning",
    });
    expect(summary.errorPositions).toEqual([{ index: 1, expected: "b", typed: "x" }]);
  });

  it("returns errors sorted by index", () => {
    // errors at positions 2 and 0 in insertion order → sorted ascending
    const events: KeystrokeEvent[] = [
      event({ targetChar: "a", actualChar: "q" }),
      event({ targetChar: "a" }),
      event({ targetChar: "b" }),
      event({ targetChar: "c", actualChar: "x" }),
      event({ targetChar: "c" }),
    ];
    const summary = summarizeSession({
      target: "abc",
      events,
      keyboardType: "sofle",
      startedAt: 0,
      completedAt: 10_000,
      phase: "transitioning",
    });
    expect(summary.errorPositions.map((e) => e.index)).toEqual([0, 2]);
  });
});

describe("summarizeSession — emergent weaknesses", () => {
  it("surfaces characters with ≥2 errors and ≥3 attempts", () => {
    // Character 'b': 3 attempts, 2 errors. Character 'a': 5 attempts, 0 errors.
    const events: KeystrokeEvent[] = [
      ...Array.from({ length: 5 }, () => event({ targetChar: "a" })),
      event({ targetChar: "b", actualChar: "n" }),
      event({ targetChar: "b", actualChar: "v" }),
      event({ targetChar: "b" }),
    ];
    const summary = summarizeSession({
      target: "aaaaab",
      events,
      keyboardType: "sofle",
      startedAt: 0,
      completedAt: 10_000,
      phase: "transitioning",
    });
    expect(summary.emergentWeaknesses).toHaveLength(1);
    expect(summary.emergentWeaknesses[0]!.unit).toBe("b");
    expect(summary.emergentWeaknesses[0]!.errorCount).toBe(2);
    expect(summary.topWeaknessName).toBe("b");
  });

  it("suppresses low-volume noise (1 error)", () => {
    const events: KeystrokeEvent[] = [
      event({ targetChar: "a" }),
      event({ targetChar: "b", actualChar: "v" }),
      event({ targetChar: "b" }),
    ];
    const summary = summarizeSession({
      target: "ab",
      events,
      keyboardType: "sofle",
      startedAt: 0,
      completedAt: 10_000,
      phase: "transitioning",
    });
    expect(summary.emergentWeaknesses).toEqual([]);
    expect(summary.topWeaknessName).toBeNull();
  });

  it("returns at most two entries, highest error rate first", () => {
    // 3 chars each with 3 errors / 5 attempts — all qualify. Pick top 2.
    const mk = (c: string, errs: number) => {
      const out: KeystrokeEvent[] = [];
      for (let i = 0; i < errs; i++) {
        out.push(event({ targetChar: c, actualChar: "x" }));
      }
      for (let i = errs; i < 5; i++) {
        out.push(event({ targetChar: c }));
      }
      return out;
    };
    const events = [...mk("b", 3), ...mk("j", 4), ...mk("q", 2)];
    const summary = summarizeSession({
      target: "bjq",
      events,
      keyboardType: "sofle",
      startedAt: 0,
      completedAt: 10_000,
      phase: "transitioning",
    });
    expect(summary.emergentWeaknesses).toHaveLength(2);
    // 'j' has highest rate (4/5), then 'b' (3/5).
    expect(summary.emergentWeaknesses.map((w) => w.unit)).toEqual(["j", "b"]);
  });
});

describe("summarizeSession — patterns and insight", () => {
  it("surfaces B↔N confusion via the existing pattern detector", () => {
    const mk = (target: string, typed: string) => event({ targetChar: target, actualChar: typed });
    // 3 B↔N substitutions + filler
    const events: KeystrokeEvent[] = [
      mk("b", "n"),
      mk("b", "n"),
      mk("n", "b"),
      // correct filler so the session has enough signal
      ...Array.from({ length: 20 }, () => event({ targetChar: "a" })),
    ];
    const summary = summarizeSession({
      target: "a".repeat(20),
      events,
      keyboardType: "sofle",
      startedAt: 0,
      completedAt: 60_000,
      phase: "transitioning",
    });
    expect(summary.patterns.some((p) => p.kind === "bn-confusion")).toBe(true);
  });

  it("insight text is non-empty and free of banned hype words", () => {
    const summary = summarizeSession({
      target: "hello world",
      events: flawless("hello world"),
      keyboardType: "sofle",
      startedAt: 0,
      completedAt: 60_000,
      phase: "transitioning",
    });
    expect(summary.insightText.length).toBeGreaterThan(0);
    const lower = summary.insightText.toLowerCase();
    for (const banned of ["amazing", "crushing it", "nailed it", "incredible", "awesome"]) {
      expect(lower).not.toContain(banned);
    }
    // No stacked exclamation marks.
    expect(summary.insightText).not.toMatch(/!{2,}/);
  });
});
