/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { WeeklyInsight as WeeklyInsightData } from "#/domain/insight/types";
import { WeeklyInsight } from "./WeeklyInsight";

afterEach(() => cleanup());

// Minimal hand-built fixtures — the domain is covered exhaustively in
// `weeklyInsight.test.ts`; this file only validates rendering decisions.

const FULL: WeeklyInsightData = {
  hasComparison: true,
  thisWeek: { sessions: 5, accuracyPct: 94, wpm: 42 },
  lastWeek: { sessions: 4, accuracyPct: 92, wpm: 40 },
  frame: "right-trajectory",
  narrative: "Accuracy climbed +2 pp this week to 94%. Muscle memory.",
  recommendations: [
    "Keep the accuracy-first rhythm.",
    "Longer sessions help consolidate.",
  ],
};

const BUILDING: WeeklyInsightData = {
  hasComparison: false,
  thisWeek: { sessions: 2, accuracyPct: 93, wpm: 40 },
  lastWeek: { sessions: 0, accuracyPct: null, wpm: null },
  frame: "building",
  narrative: "2 sessions logged this week.",
  recommendations: ["Show up ≥3 times in the next 7 days."],
};

describe("WeeklyInsight", () => {
  it("renders a dedicated empty caption when data is null", () => {
    render(<WeeklyInsight data={null} />);
    expect(
      screen.getByText(/no sessions logged yet/i),
    ).toBeTruthy();
  });

  it("renders narrative and all recommendations when data is present", () => {
    render(<WeeklyInsight data={FULL} />);
    expect(screen.getByText(/muscle memory/i)).toBeTruthy();
    expect(screen.getByText(/keep the accuracy-first rhythm/i)).toBeTruthy();
    expect(
      screen.getByText(/longer sessions help consolidate/i),
    ).toBeTruthy();
  });

  it("renders both comparison cells with their rounded stats", () => {
    render(<WeeklyInsight data={FULL} />);
    // Exact text match for the cell labels — the narrative also contains
    // "this week" as free prose, so a regex would hit multiple nodes.
    expect(screen.getByText("This week")).toBeTruthy();
    expect(screen.getByText("Last week")).toBeTruthy();
    expect(screen.getByText("94%")).toBeTruthy(); // this-week accuracy
    expect(screen.getByText("92%")).toBeTruthy(); // last-week accuracy
  });

  it("shows the empty-cell placeholder for a week with zero sessions, not '0%'", () => {
    render(<WeeklyInsight data={BUILDING} />);
    expect(screen.getByText(/no sessions/i)).toBeTruthy();
    // Guard: the placeholder must not be "0%" — that would misrepresent
    // a zero-data week as a zero-accuracy week.
    expect(screen.queryByText("0%")).toBeNull();
  });
});
