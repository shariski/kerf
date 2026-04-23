import { describe, expect, it } from "vitest";
import {
  BANNED_WORDS,
  WEEKLY_ACCURACY_NOISE_PP,
  WEEKLY_STAGNATION_MIN_SESSIONS,
  WEEKLY_WPM_NOISE,
  generateWeeklyInsight,
} from "./weeklyInsight";
import type { TransitionPhase } from "../profile/initialPhase";

// --- fixture helpers -------------------------------------------------------

const NOW = new Date("2026-04-21T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

const daysAgo = (n: number, hour = 10): Date =>
  new Date(NOW.getTime() - n * DAY + hour * 60 * 60 * 1000);

type S = { startedAt: Date; accuracyPct: number; wpm: number };

const session = (daysBack: number, accuracyPct: number, wpm: number): S => ({
  startedAt: daysAgo(daysBack),
  accuracyPct,
  wpm,
});

const run = (sessions: S[], phase: TransitionPhase = "transitioning") =>
  generateWeeklyInsight({ sessions, phase, now: NOW });

// Renders every generated string into one blob for banned-word linting.
const allCopy = (r: ReturnType<typeof generateWeeklyInsight>): string =>
  [r.narrative, ...r.recommendations].join(" ").toLowerCase();

// --- frame classification --------------------------------------------------

describe("generateWeeklyInsight — frame classification", () => {
  it("returns `building` when the prior-week window is empty", () => {
    // Three sessions this week, none last week.
    const r = run([session(1, 94, 40), session(3, 95, 41), session(5, 93, 39)]);
    expect(r.frame).toBe("building");
    expect(r.hasComparison).toBe(false);
  });

  it("returns `building` when this-week is empty even if last-week has data", () => {
    const r = run([session(8, 94, 40), session(10, 95, 41)]);
    expect(r.frame).toBe("building");
    expect(r.hasComparison).toBe(false);
  });

  it("returns `stagnant` when both windows have ≥3 sessions and neither metric moved beyond noise", () => {
    const thisW = [session(1, 94, 40), session(3, 94, 40), session(5, 94, 40)];
    const lastW = [session(8, 94, 40), session(10, 94, 40), session(12, 94, 40)];
    const r = run([...thisW, ...lastW]);
    expect(r.frame).toBe("stagnant");
    expect(r.hasComparison).toBe(true);
  });

  it("does NOT call it `stagnant` when either window has fewer than the minimum sessions", () => {
    // Accuracy and speed identical, but only 2 sessions in last week.
    const thisW = [session(1, 94, 40), session(3, 94, 40), session(5, 94, 40)];
    const lastW = [session(8, 94, 40), session(10, 94, 40)];
    const r = run([...thisW, ...lastW]);
    expect(r.frame).toBe("steady");
  });

  it("returns `right-trajectory` when accuracy climbed (speed direction does not matter)", () => {
    const thisW = [session(1, 96, 42), session(3, 96, 42)];
    const lastW = [session(8, 92, 40), session(10, 92, 40)];
    const r = run([...thisW, ...lastW]);
    expect(r.frame).toBe("right-trajectory");
  });

  it("returns `concern` when accuracy dropped while speed rose — the anti-pattern", () => {
    const thisW = [session(1, 88, 48), session(3, 88, 48)];
    const lastW = [session(8, 94, 42), session(10, 94, 42)];
    const r = run([...thisW, ...lastW]);
    expect(r.frame).toBe("concern");
  });

  it("returns `mixed` when both metrics cooled", () => {
    const thisW = [session(1, 88, 35), session(3, 88, 35)];
    const lastW = [session(8, 94, 42), session(10, 94, 42)];
    const r = run([...thisW, ...lastW]);
    expect(r.frame).toBe("mixed");
  });

  it("returns `right-trajectory` when only speed moved up with flat accuracy", () => {
    // Accuracy held within noise; speed rose +3.
    const thisW = [session(1, 94, 45), session(3, 94, 45)];
    const lastW = [session(8, 94, 42), session(10, 94, 42)];
    const r = run([...thisW, ...lastW]);
    expect(r.frame).toBe("right-trajectory");
  });

  it("returns `mixed` when only speed dropped with flat accuracy", () => {
    const thisW = [session(1, 94, 38), session(3, 94, 38)];
    const lastW = [session(8, 94, 42), session(10, 94, 42)];
    const r = run([...thisW, ...lastW]);
    expect(r.frame).toBe("mixed");
  });

  it("does not classify sub-noise deltas as movement", () => {
    // 0.4 pp accuracy and 0.9 WPM deltas — both below noise floor.
    const thisW = [session(1, 94.4, 40.9)];
    const lastW = [session(8, 94, 40)];
    const r = run([...thisW, ...lastW]);
    // hasComparison is true but neither window meets stagnation minimum,
    // so `steady` is the honest call.
    expect(r.frame).toBe("steady");
  });
});

// --- window boundary semantics --------------------------------------------

describe("generateWeeklyInsight — window boundaries", () => {
  it("excludes sessions older than 14 days even when they would otherwise fit the stagnation bucket", () => {
    const thisW = [session(1, 94, 40), session(3, 94, 40), session(5, 94, 40)];
    const lastW = [session(8, 94, 40), session(10, 94, 40), session(12, 94, 40)];
    const old = [session(20, 94, 40), session(30, 94, 40)];
    const r = run([...thisW, ...lastW, ...old]);
    // The old entries are dropped; this-week and last-week session counts
    // should match only the in-window sets.
    expect(r.thisWeek.sessions).toBe(3);
    expect(r.lastWeek.sessions).toBe(3);
  });

  it("places a session exactly 7 days old into the LAST-week bucket (inclusive lower, exclusive upper)", () => {
    // 7 days ago + tiny offset so floating-point comparison is unambiguous.
    const sessions: S[] = [
      {
        startedAt: new Date(NOW.getTime() - 7 * DAY),
        accuracyPct: 94,
        wpm: 40,
      },
      session(1, 95, 41),
    ];
    const r = run(sessions);
    expect(r.thisWeek.sessions).toBe(1);
    expect(r.lastWeek.sessions).toBe(1);
  });
});

// --- aggregates ------------------------------------------------------------

describe("generateWeeklyInsight — aggregates", () => {
  it("rounds accuracy and WPM for display", () => {
    const thisW = [session(1, 94.4, 40.6), session(3, 95.1, 41.4)];
    const lastW = [session(8, 92.0, 38.0)];
    const r = run([...thisW, ...lastW]);
    // mean = 94.75 / 41.0
    expect(r.thisWeek.accuracyPct).toBe(95);
    expect(r.thisWeek.wpm).toBe(41);
    expect(r.lastWeek.accuracyPct).toBe(92);
    expect(r.lastWeek.wpm).toBe(38);
  });

  it("returns null aggregates for empty windows, not zero", () => {
    const r = run([session(1, 94, 40)]);
    expect(r.lastWeek.accuracyPct).toBeNull();
    expect(r.lastWeek.wpm).toBeNull();
    expect(r.lastWeek.sessions).toBe(0);
  });
});

// --- copy integrity --------------------------------------------------------

describe("generateWeeklyInsight — copy integrity", () => {
  // Parametric check: for every frame × phase combination, we fabricate
  // a minimal input that hits that frame and verify the emitted copy
  // never uses a banned word. Cheaper than a case per cell.
  const hitFrame = (frame: string, phase: TransitionPhase) => {
    switch (frame) {
      case "building":
        return run([session(1, 94, 40)], phase);
      case "stagnant": {
        const thisW = Array.from({ length: 3 }, (_, i) => session(1 + i * 2, 94, 40));
        const lastW = Array.from({ length: 3 }, (_, i) => session(8 + i * 2, 94, 40));
        return run([...thisW, ...lastW], phase);
      }
      case "right-trajectory":
        return run([session(1, 96, 42), session(8, 92, 40)], phase);
      case "concern":
        return run([session(1, 88, 48), session(8, 94, 42)], phase);
      case "mixed":
        return run([session(1, 88, 35), session(8, 94, 42)], phase);
      case "steady":
        return run([session(1, 94, 40), session(8, 94, 40)], phase);
      default:
        throw new Error(`unhandled frame: ${frame}`);
    }
  };

  const frames = [
    "building",
    "stagnant",
    "right-trajectory",
    "concern",
    "mixed",
    "steady",
  ] as const;
  const phases: TransitionPhase[] = ["transitioning", "refining"];

  it.each(
    frames.flatMap((f) => phases.map((p) => [f, p] as const)),
  )("uses no banned hype words in frame=%s, phase=%s", (frame, phase) => {
    const r = hitFrame(frame, phase);
    expect(r.frame).toBe(frame);
    const copy = allCopy(r);
    for (const word of BANNED_WORDS) {
      expect(copy).not.toContain(word);
    }
  });

  it.each(phases)("uses no stacked exclamation marks in any frame, phase=%s", (phase) => {
    for (const f of frames) {
      const r = hitFrame(f, phase);
      const copy = allCopy(r);
      expect(copy).not.toMatch(/!!/);
    }
  });

  it("stagnant copy surfaces the plateau honestly, not as a win", () => {
    const thisW = Array.from({ length: 3 }, (_, i) => session(1 + i * 2, 94, 40));
    const lastW = Array.from({ length: 3 }, (_, i) => session(8 + i * 2, 94, 40));
    const r = run([...thisW, ...lastW]);
    expect(r.narrative.toLowerCase()).toMatch(/plateau|honest|similar numbers/);
    // Should not frame the plateau as a positive.
    expect(r.narrative.toLowerCase()).not.toMatch(/keep it up|great|well done|congrats/);
  });

  it("concern copy leads with accuracy concern, not with the speed gain", () => {
    const r = run([session(1, 88, 48), session(8, 94, 42)]);
    // The sentence must name the accuracy drop; it may also mention
    // speed, but the anti-pattern is the point.
    expect(r.narrative.toLowerCase()).toContain("accuracy");
    expect(r.narrative.toLowerCase()).toMatch(/slip|drop|eas/);
  });

  it("right-trajectory narrative leads with accuracy when accuracy climbed", () => {
    const r = run([session(1, 96, 42), session(8, 92, 40)]);
    expect(r.narrative.toLowerCase()).toContain("accuracy");
    expect(r.narrative.toLowerCase()).toContain("climb");
  });

  it("picks phase-specific recommendations", () => {
    const bothTransitioning = run([session(1, 96, 42), session(8, 92, 40)], "transitioning");
    const bothRefining = run([session(1, 96, 42), session(8, 92, 40)], "refining");
    expect(bothTransitioning.recommendations.join(" ")).not.toEqual(
      bothRefining.recommendations.join(" "),
    );
  });
});

// --- sanity: thresholds wired ---------------------------------------------

describe("generateWeeklyInsight — thresholds", () => {
  it("exports reasonable noise floors", () => {
    expect(WEEKLY_ACCURACY_NOISE_PP).toBeGreaterThan(0);
    expect(WEEKLY_ACCURACY_NOISE_PP).toBeLessThan(2);
    expect(WEEKLY_WPM_NOISE).toBeGreaterThan(0);
    expect(WEEKLY_WPM_NOISE).toBeLessThan(3);
    expect(WEEKLY_STAGNATION_MIN_SESSIONS).toBeGreaterThanOrEqual(2);
  });
});
