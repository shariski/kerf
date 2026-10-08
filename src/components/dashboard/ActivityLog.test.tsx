/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DashboardActivityData } from "#/server/dashboard";
import type { PracticeHistoryData } from "#/server/practiceHistory";
import { ActivityLog } from "./ActivityLog";

afterEach(() => cleanup());

describe("Dashboard Recent activity", () => {
  it("shows one shared timeline and filters sessions without mixing their scores", () => {
    const data: DashboardActivityData = {
      days: [{ date: "2026-10-01", sessionCount: 1, level: 1 }],
      recentSessions: [
        {
          id: "keyboard-1",
          relativeTime: "today",
          mode: "adaptive",
          description: "63 words",
          wpm: 72,
          accuracyPct: 95,
          durationLabel: "0:49",
        },
      ],
    };
    const history: PracticeHistoryData = {
      codeDays: [{ date: "2026-10-01", sessionCount: 1, level: 1 }],
      allDays: [{ date: "2026-10-01", sessionCount: 2, level: 2 }],
      items: [
        {
          id: "code-1",
          track: "coding",
          startedAt: "2026-10-01T12:00:00.000Z",
          title: "Handle a click",
          language: "javascript",
          accuracyPct: 92,
          symbolAccuracyPct: 85,
          wpm: 48,
          durationLabel: "0:32",
        },
        {
          id: "keyboard-1",
          track: "keyboard",
          startedAt: "2026-10-01T08:00:00.000Z",
          focusLabel: "Cross-hand transitions",
          accuracyPct: 95,
          wpm: 72,
          durationLabel: "0:49",
        },
      ],
    };

    render(<ActivityLog data={data} history={history} />);
    expect(screen.getByRole("img", { name: /1 practice days in the last 1/ })).toBeTruthy();
    expect(screen.getByText("63 words")).toBeTruthy();
    expect(screen.getByText(/JavaScript · Handle a click/)).toBeTruthy();
    expect(screen.getByText("85% symbol accuracy")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Keyboard" }));
    expect(screen.getByText("63 words")).toBeTruthy();
    expect(screen.queryByText(/Handle a click/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Code" }));
    expect(screen.getByText(/Handle a click/)).toBeTruthy();
    expect(screen.queryByText("63 words")).toBeNull();
  });
});
