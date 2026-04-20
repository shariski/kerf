import { describe, expect, it } from "vitest";
import {
  MIN_SAMPLES_PER_BUCKET,
  computeTemporalPatterns,
  formatHourLabel,
  pickPeakBucket,
} from "./temporalPatterns";

// --- fixture helpers -------------------------------------------------------

/** Build a session timestamp at a specific hour and day-of-week using
 * a base Sunday (2026-04-19 is a Sunday). Deterministic — the test
 * doesn't care about absolute date, only hour/day-of-week. */
const BASE_SUNDAY = new Date(2026, 3, 19, 0, 0, 0); // month is 0-indexed

const at = (
  dayOffset: number,
  hour: number,
  wpm: number,
): { startedAt: Date; wpm: number } => ({
  startedAt: new Date(
    BASE_SUNDAY.getFullYear(),
    BASE_SUNDAY.getMonth(),
    BASE_SUNDAY.getDate() + dayOffset,
    hour,
    0,
    0,
  ),
  wpm,
});

// --- shape guarantees ------------------------------------------------------

describe("computeTemporalPatterns — shape", () => {
  it("returns 24 hour buckets and 7 day-of-week buckets even for empty input", () => {
    const r = computeTemporalPatterns({ sessions: [] });
    expect(r.byHour).toHaveLength(24);
    expect(r.byDayOfWeek).toHaveLength(7);
    expect(r.totalSessions).toBe(0);
    expect(r.hasMeaningfulData).toBe(false);
  });

  it("labels hour buckets 0-23 in order", () => {
    const r = computeTemporalPatterns({ sessions: [] });
    expect(r.byHour.map((h) => h.hour)).toEqual(
      Array.from({ length: 24 }, (_, i) => i),
    );
  });

  it("labels day-of-week buckets Sun-Sat starting from 0", () => {
    const r = computeTemporalPatterns({ sessions: [] });
    expect(r.byDayOfWeek.map((d) => d.dayLabel)).toEqual([
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
    expect(r.byDayOfWeek.map((d) => d.dayOfWeek)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("every bucket starts with meanWpm=null and sampleCount=0 for empty input", () => {
    const r = computeTemporalPatterns({ sessions: [] });
    for (const h of r.byHour) {
      expect(h.meanWpm).toBeNull();
      expect(h.sampleCount).toBe(0);
    }
    for (const d of r.byDayOfWeek) {
      expect(d.meanWpm).toBeNull();
      expect(d.sampleCount).toBe(0);
    }
  });
});

// --- bucketing logic -------------------------------------------------------

describe("computeTemporalPatterns — bucketing", () => {
  it("counts each session once in each dimension", () => {
    const sessions = [
      at(0, 9, 42), // Sunday 09:00
      at(1, 14, 50), // Monday 14:00
      at(6, 22, 38), // Saturday 22:00
    ];
    const r = computeTemporalPatterns({ sessions });
    expect(r.totalSessions).toBe(3);
    expect(r.byHour[9]!.sampleCount).toBe(1);
    expect(r.byHour[14]!.sampleCount).toBe(1);
    expect(r.byHour[22]!.sampleCount).toBe(1);
    expect(r.byDayOfWeek[0]!.sampleCount).toBe(1); // Sun
    expect(r.byDayOfWeek[1]!.sampleCount).toBe(1); // Mon
    expect(r.byDayOfWeek[6]!.sampleCount).toBe(1); // Sat
  });

  it("aggregates sessions landing in the same hour into one bucket", () => {
    const sessions = [
      at(0, 9, 40),
      at(2, 9, 50), // different day, same hour
      at(4, 9, 60),
    ];
    const r = computeTemporalPatterns({ sessions });
    expect(r.byHour[9]!.sampleCount).toBe(3);
    expect(r.byHour[9]!.meanWpm).toBe(50); // (40+50+60)/3
  });

  it("aggregates sessions landing on the same day-of-week across weeks", () => {
    const sessions = [
      at(1, 9, 40), // Mon wk1
      at(8, 14, 50), // Mon wk2
      at(15, 20, 60), // Mon wk3
    ];
    const r = computeTemporalPatterns({ sessions });
    expect(r.byDayOfWeek[1]!.sampleCount).toBe(3);
    expect(r.byDayOfWeek[1]!.meanWpm).toBe(50);
  });

  it("rounds mean WPM to the nearest integer", () => {
    const sessions = [at(0, 9, 41), at(2, 9, 42)]; // mean 41.5
    const r = computeTemporalPatterns({ sessions });
    expect(r.byHour[9]!.meanWpm).toBe(42);
  });
});

// --- minimum-samples gating ------------------------------------------------

describe("computeTemporalPatterns — min-samples gate", () => {
  it(`leaves meanWpm null when a bucket has fewer than ${MIN_SAMPLES_PER_BUCKET} sessions`, () => {
    const r = computeTemporalPatterns({ sessions: [at(0, 3, 80)] });
    expect(r.byHour[3]!.sampleCount).toBe(1);
    expect(r.byHour[3]!.meanWpm).toBeNull();
  });

  it(`populates meanWpm when sampleCount equals ${MIN_SAMPLES_PER_BUCKET}`, () => {
    const sessions = [at(0, 3, 80), at(7, 3, 60)];
    const r = computeTemporalPatterns({ sessions });
    expect(r.byHour[3]!.sampleCount).toBe(2);
    expect(r.byHour[3]!.meanWpm).toBe(70);
  });

  it("a bucket with enough samples coexists with sub-threshold buckets", () => {
    const sessions = [
      // 09:00 has 3 — above threshold
      at(0, 9, 40),
      at(1, 9, 50),
      at(2, 9, 60),
      // 03:00 has 1 — below threshold
      at(3, 3, 90),
    ];
    const r = computeTemporalPatterns({ sessions });
    expect(r.byHour[9]!.meanWpm).toBe(50);
    expect(r.byHour[3]!.meanWpm).toBeNull();
    expect(r.byHour[3]!.sampleCount).toBe(1); // count still retained
  });
});

// --- hasMeaningfulData flag ------------------------------------------------

describe("computeTemporalPatterns — hasMeaningfulData", () => {
  it("false when every session is isolated in its own bucket", () => {
    const sessions = [at(0, 9, 40), at(1, 14, 50), at(2, 20, 60)];
    const r = computeTemporalPatterns({ sessions });
    // Each hour has count 1 — no meanWpm populated. Each day has
    // count 1 — same. So no bucket is meaningful.
    expect(r.hasMeaningfulData).toBe(false);
  });

  it("true when any hour bucket clears the gate", () => {
    const sessions = [at(0, 9, 40), at(1, 9, 50)];
    const r = computeTemporalPatterns({ sessions });
    expect(r.hasMeaningfulData).toBe(true);
  });

  it("true when any day-of-week bucket clears the gate even if no hour does", () => {
    // Two sessions on Monday but different hours — day-of-week gets
    // 2 samples, each hour only 1. hasMeaningfulData should still be
    // true because the day dimension meets the threshold.
    const sessions = [at(1, 9, 40), at(8, 14, 50)];
    const r = computeTemporalPatterns({ sessions });
    expect(r.byHour.every((h) => h.meanWpm === null)).toBe(true);
    expect(r.byDayOfWeek[1]!.meanWpm).toBe(45);
    expect(r.hasMeaningfulData).toBe(true);
  });
});

// --- peak bucket -----------------------------------------------------------

describe("pickPeakBucket", () => {
  it("returns null when no bucket has data", () => {
    const r = computeTemporalPatterns({ sessions: [] });
    expect(pickPeakBucket(r.byHour)).toBeNull();
    expect(pickPeakBucket(r.byDayOfWeek)).toBeNull();
  });

  it("returns the highest-WPM bucket among those that cleared the gate", () => {
    const sessions = [
      at(0, 9, 40), // 09:00 mean 45
      at(7, 9, 50),
      at(0, 14, 60), // 14:00 mean 62
      at(7, 14, 64),
    ];
    const r = computeTemporalPatterns({ sessions });
    const peak = pickPeakBucket(r.byHour);
    expect(peak?.hour).toBe(14);
    expect(peak?.meanWpm).toBe(62);
  });

  it("ignores high single-sample buckets that haven't cleared the gate", () => {
    // 3am single session at 90 WPM would be the arithmetic max, but
    // has only 1 sample → meanWpm is null → must be skipped.
    const sessions = [at(0, 3, 90), at(0, 9, 40), at(7, 9, 50)];
    const r = computeTemporalPatterns({ sessions });
    const peak = pickPeakBucket(r.byHour);
    expect(peak?.hour).toBe(9);
    expect(peak?.meanWpm).toBe(45);
  });
});

// --- formatHourLabel -------------------------------------------------------

describe("formatHourLabel", () => {
  it("zero-pads single-digit hours", () => {
    expect(formatHourLabel(0)).toBe("00:00");
    expect(formatHourLabel(9)).toBe("09:00");
  });

  it("leaves two-digit hours unpadded", () => {
    expect(formatHourLabel(14)).toBe("14:00");
    expect(formatHourLabel(23)).toBe("23:00");
  });
});
