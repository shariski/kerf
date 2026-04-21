/**
 * Tests for the EMA-based live-WPM helper.
 *
 * The important properties are behavioral, not numerical: smoothness
 * (no jumps during steady typing), convergence (eventually reaches a
 * new rate when the user changes speed), and robustness to pauses
 * (boundary intervals don't tank the display).
 *
 * Each "simulation" test builds a realistic KeystrokeEvent[] and
 * inspects the sequence of WPM readings as events are fed in. That
 * lets us assert properties of the series (max jump, final value,
 * etc.) rather than just a single computed number.
 */

import { describe, expect, it } from "vitest";
import { computeWindowedWpm } from "./LiveWpm";
import type { KeystrokeEvent } from "#/domain/session/types";

function mkEvent(timestampMs: number): KeystrokeEvent {
  return {
    targetChar: "a",
    actualChar: "a",
    isError: false,
    keystrokeMs: 0,
    timestamp: new Date(timestampMs),
  };
}

/**
 * Build a session where each interval is drawn from `intervalFn(i)`.
 * Returns the resulting events and the per-keystroke WPM series a
 * subscriber would see (i.e., computeWindowedWpm over events[0..k] for
 * k = 2..N).
 */
function simulate(
  n: number,
  intervalFn: (i: number) => number,
): { events: KeystrokeEvent[]; series: number[] } {
  const events: KeystrokeEvent[] = [mkEvent(0)];
  let t = 0;
  for (let i = 1; i < n; i++) {
    t += intervalFn(i);
    events.push(mkEvent(t));
  }
  const series: number[] = [];
  for (let k = 2; k <= events.length; k++) {
    series.push(computeWindowedWpm(events.slice(0, k)));
  }
  return { events, series };
}

/** Seeded LCG so variance-tests are deterministic without a library. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

/** Max absolute delta between consecutive elements in a numeric series. */
function maxJump(xs: number[]): number {
  let m = 0;
  for (let i = 1; i < xs.length; i++) {
    const prev = xs[i - 1];
    const cur = xs[i];
    if (prev === undefined || cur === undefined) continue;
    m = Math.max(m, Math.abs(cur - prev));
  }
  return m;
}

describe("computeWindowedWpm — warmup", () => {
  it("returns 0 until MIN_WINDOW_MS of typing time is accumulated", () => {
    // 5 events = 4 intervals * 200ms = 800ms typing < 1000ms threshold.
    // Not enough samples yet — a single keystroke swings tiny windows
    // by 20+ wpm, so we wait for a stable base before showing anything.
    const events = [0, 200, 400, 600, 800].map(mkEvent);
    expect(computeWindowedWpm(events)).toBe(0);
  });

  it("returns a value once the window threshold is crossed", () => {
    // 6 events = 5 intervals * 200ms = 1000ms typing = just over threshold.
    const events = [0, 200, 400, 600, 800, 1000].map(mkEvent);
    expect(computeWindowedWpm(events)).toBe(60);
  });

  it("handles empty / single-event sessions gracefully", () => {
    expect(computeWindowedWpm([])).toBe(0);
    expect(computeWindowedWpm([mkEvent(100)])).toBe(0);
  });
});

describe("computeWindowedWpm — steady-state accuracy", () => {
  it("converges to 60 wpm from perfectly steady 200ms intervals", () => {
    const { series } = simulate(40, () => 200);
    expect(series[series.length - 1]).toBe(60);
  });

  it("converges to 120 wpm from 100ms intervals", () => {
    const { series } = simulate(40, () => 100);
    expect(series[series.length - 1]).toBe(120);
  });

  it("converges to 30 wpm from 400ms intervals", () => {
    const { series } = simulate(40, () => 400);
    expect(series[series.length - 1]).toBe(30);
  });
});

describe("computeWindowedWpm — smoothness under variance", () => {
  it("single fast outlier barely moves the display", () => {
    // 30 steady keystrokes at 200ms (fills the 5s window), then one
    // outlier at 80ms. In a 25-sample window a single odd interval
    // barely nudges the mean — this is the whole point of using a
    // tail window over an EMA.
    const events: KeystrokeEvent[] = [mkEvent(0)];
    let t = 0;
    for (let i = 1; i < 30; i++) {
      t += 200;
      events.push(mkEvent(t));
    }
    const stable = computeWindowedWpm(events);
    t += 80; // the outlier
    events.push(mkEvent(t));
    const afterSpike = computeWindowedWpm(events);
    // 25 samples at 200ms + one at 80ms: mean drops by ~5ms, WPM
    // rises by ~1-2. Nothing the eye would register as a jump.
    expect(Math.abs(afterSpike - stable)).toBeLessThan(5);
  });

  it("maintains bounded jumps across natural typing variance", () => {
    // Simulate a skilled typist: mean 200ms interval, ±30% variance.
    // Raw per-keystroke WPM would swing between ~46 and ~86 wpm;
    // over a 25-sample tail window the mean's std error is ~6%, so
    // consecutive readings should stay within a couple wpm of each other.
    const rand = rng(42);
    const { series } = simulate(120, () => 200 * (0.7 + 0.6 * rand()));
    // Skip the warmup phase while the window is still filling.
    const postWarmup = series.slice(30);
    // This is the user-visible "jumpy" threshold we're fighting. An
    // EMA α=0.15 produced consecutive deltas up to ~10 wpm in this
    // regime; tail-window with WINDOW_MS=5000 should keep them under 3.
    expect(maxJump(postWarmup)).toBeLessThan(3);
  });

  it("tracks the true mean across a long variance run", () => {
    const rand = rng(7);
    const { series } = simulate(300, () => 200 * (0.7 + 0.6 * rand()));
    // A tail-mean over 5s of typing ≈ 25 samples. Standard error at
    // steady state is small — even a single reading is close to truth.
    const tail = series.slice(-30);
    const avg = tail.reduce((a, b) => a + b, 0) / tail.length;
    expect(avg).toBeGreaterThan(58);
    expect(avg).toBeLessThan(62);
  });
});

describe("computeWindowedWpm — speed transitions", () => {
  it("converges to the new rate after the window refills", () => {
    // 30 events at 200ms (60 wpm), then enough 100ms events to flush
    // the 5s window (≥50 fast events). The tail window takes about
    // WINDOW_MS of typing time to fully reflect a new rate — that's
    // the price of stability.
    const { series } = simulate(90, (i) => (i < 30 ? 200 : 100));
    const pre = series[28] ?? 0;
    // Shortly after the transition (20 fast keystrokes = 2s in) the
    // window is half-filled with fast samples; WPM should be on the way up.
    const postShortly = series[49] ?? 0;
    const postLong = series[series.length - 1] ?? 0;
    expect(pre).toBeGreaterThan(55);
    expect(pre).toBeLessThan(65);
    expect(postShortly).toBeGreaterThan(80);
    // Long after transition: window is full of fast samples → at 120.
    expect(postLong).toBeGreaterThan(110);
    expect(postLong).toBeLessThan(125);
  });

  it("converges on slowdown without overshoot", () => {
    // 30 events at 100ms (120 wpm), then 60 at 300ms (40 wpm).
    const { series } = simulate(90, (i) => (i < 30 ? 100 : 300));
    const pre = series[28] ?? 0;
    const postLong = series[series.length - 1] ?? 0;
    expect(pre).toBeGreaterThan(110);
    expect(postLong).toBeGreaterThan(35);
    expect(postLong).toBeLessThan(45);
  });
});

describe("computeWindowedWpm — pause handling", () => {
  it("freezes WPM across a long idle (no new events → no change)", () => {
    // 20 events at 60 wpm, then a user stops typing. The helper is
    // pure — with no new events, the caller gets the same value.
    const events: KeystrokeEvent[] = [mkEvent(0)];
    for (let i = 1; i < 20; i++) events.push(mkEvent(i * 200));
    const before = computeWindowedWpm(events);
    // Simulate "5 seconds of idle" by calling the helper again with
    // the same events (the component's useEffect wouldn't even refire,
    // but if it did the value must be unchanged).
    expect(computeWindowedWpm(events)).toBe(before);
  });

  it("skips the boundary pause-interval on resume (no downward jolt)", () => {
    // 20 keystrokes at 60 wpm (fills most of the window), 10s pause,
    // 20 more at 60 wpm. The single 10s interval is ≥ PAUSE_INTERVAL_MS
    // so it is dropped. The reading should stay near 60 throughout.
    const events: KeystrokeEvent[] = [mkEvent(0)];
    for (let i = 1; i < 20; i++) events.push(mkEvent(i * 200));
    const prePause = computeWindowedWpm(events);

    const pauseEnd = 19 * 200 + 10_000;
    events.push(mkEvent(pauseEnd)); // the first resume keystroke
    const firstResume = computeWindowedWpm(events);
    // First keystroke after a skipped pause interval: nothing new was
    // actually counted, so the reading is identical.
    expect(firstResume).toBe(prePause);

    for (let i = 1; i < 20; i++) events.push(mkEvent(pauseEnd + i * 200));
    const wellAfterResume = computeWindowedWpm(events);
    // After many more counted intervals at 200ms we are back on rate.
    expect(wellAfterResume).toBeGreaterThan(55);
    expect(wellAfterResume).toBeLessThan(65);
  });

  it("handles multiple pause/resume cycles cleanly", () => {
    // Three bursts of typing with big gaps in between.
    const events: KeystrokeEvent[] = [mkEvent(0)];
    let t = 0;
    for (let burst = 0; burst < 3; burst++) {
      for (let i = 0; i < 10; i++) {
        t += 200;
        events.push(mkEvent(t));
      }
      t += 5_000; // a five-second pause before the next burst
    }
    const final = computeWindowedWpm(events);
    // Three 60-wpm bursts separated by dropped pause intervals should
    // still read ~60 wpm.
    expect(final).toBeGreaterThan(55);
    expect(final).toBeLessThan(65);
  });
});

describe("computeWindowedWpm — defensive edges", () => {
  it("clamps absurdly fast intervals so one event can't dominate", () => {
    // 30 stable keystrokes at 60 wpm (fills the 5s window), then one
    // impossibly fast keystroke (5ms — hardware key repeat).
    const events: KeystrokeEvent[] = [mkEvent(0)];
    for (let i = 1; i < 30; i++) events.push(mkEvent(i * 200));
    const stable = computeWindowedWpm(events);
    events.push(mkEvent(29 * 200 + 5));
    const afterClamp = computeWindowedWpm(events);
    // Unclamped 5ms interval would push one sample to 2400 wpm.
    // Clamped to 30ms it contributes like a 400-wpm sample to the
    // 25-sample mean — still only a 2–3 wpm bump to the tail mean.
    expect(afterClamp - stable).toBeLessThan(10);
  });

  it("ignores zero-delta duplicate events", () => {
    // Enough events at 200ms to cross MIN_WINDOW_MS even after the
    // duplicate is dropped.
    const events = [0, 200, 200, 400, 600, 800, 1000, 1200].map(mkEvent);
    // Duplicate at 200 is dropped. 6 valid intervals at 200ms = 1200ms
    // typing time, 6 chars → 60 wpm exactly.
    expect(computeWindowedWpm(events)).toBe(60);
  });

  it("ignores negative-delta events (clock skew)", () => {
    const events = [
      mkEvent(0),
      mkEvent(200),
      mkEvent(150), // goes backwards
      mkEvent(400),
      mkEvent(600),
      mkEvent(800),
      mkEvent(1000),
      mkEvent(1200),
    ];
    // Helper must not produce NaN or negative WPM.
    const result = computeWindowedWpm(events);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});
