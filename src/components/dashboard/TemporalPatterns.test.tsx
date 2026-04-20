/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { DashboardTemporalPatternsData } from "#/server/dashboard";
import { TemporalPatterns } from "./TemporalPatterns";

afterEach(() => cleanup());

// Build a session timestamp at a given hour-of-day / day-of-week using
// a known Sunday baseline. Returns an ISO string to match the shape
// the server actually sends (post-JSON-serialize).
const BASE_SUNDAY = new Date(2026, 3, 19, 0, 0, 0);

const at = (dayOffset: number, hour: number, wpm: number): { startedAt: string; wpm: number } => ({
  startedAt: new Date(
    BASE_SUNDAY.getFullYear(),
    BASE_SUNDAY.getMonth(),
    BASE_SUNDAY.getDate() + dayOffset,
    hour,
    0,
    0,
  ).toISOString(),
  wpm,
});

// Two sessions in the same hour/day clear the MIN_SAMPLES_PER_BUCKET=2
// gate; a sub-threshold input does not.
const MEANINGFUL: DashboardTemporalPatternsData = {
  sessions: [at(0, 14, 60), at(7, 14, 62)],
};

const SUB_THRESHOLD: DashboardTemporalPatternsData = {
  sessions: [at(0, 3, 90)],
};

describe("TemporalPatterns", () => {
  it("renders an empty-state note when no bucket has enough samples", () => {
    render(<TemporalPatterns data={SUB_THRESHOLD} />);
    expect(screen.getByText(/no bucket has enough samples/i)).toBeTruthy();
  });

  it("renders the peak-bucket caption when data is meaningful", () => {
    render(<TemporalPatterns data={MEANINGFUL} />);
    // The peak hour was 14:00 with mean WPM 61.
    expect(screen.getByText(/14:00/)).toBeTruthy();
    expect(screen.getByText(/61 WPM/)).toBeTruthy();
  });

  it("renders both chart titles when data is meaningful", () => {
    render(<TemporalPatterns data={MEANINGFUL} />);
    expect(screen.getByText(/by hour of day/i)).toBeTruthy();
    expect(screen.getByText(/by day of week/i)).toBeTruthy();
  });

  it("pluralizes the 'based on N sessions' caption correctly", () => {
    render(<TemporalPatterns data={MEANINGFUL} />);
    expect(screen.getByText(/based on 2 sessions/i)).toBeTruthy();
  });

  it("empty data renders the empty-state copy without crashing", () => {
    render(<TemporalPatterns data={{ sessions: [] }} />);
    expect(screen.getByText(/no bucket has enough samples/i)).toBeTruthy();
  });
});
