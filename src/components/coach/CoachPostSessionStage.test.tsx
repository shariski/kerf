/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionSummary } from "#/domain/session/summarize";

vi.mock("#/components/practice", () => ({
  PostSessionStage: ({
    practiceAgainLabel,
    onPracticeAgain,
  }: {
    practiceAgainLabel: string;
    onPracticeAgain: () => void;
  }) => (
    <button type="button" onClick={onPracticeAgain}>
      {practiceAgainLabel}
    </button>
  ),
}));

import { CoachPostSessionStage } from "./CoachPostSessionStage";

afterEach(() => cleanup());

const baseProps = {
  target: "some text",
  summary: {} as SessionSummary,
  mechanismPerformance: [
    { mechanism: "cross-hand" as const, attempts: 20, errors: 3, errorRate: 0.15 },
  ],
  targetedMechanism: "cross-hand" as const,
  onAgain: vi.fn(),
  onFeedback: vi.fn().mockResolvedValue(undefined),
};

describe("CoachPostSessionStage", () => {
  it("shows a focused result and records one usefulness vote", async () => {
    const onFeedback = vi.fn().mockResolvedValue(undefined);
    render(
      <CoachPostSessionStage
        {...baseProps}
        quota={{ usedToday: 1, remaining: 4 }}
        onFeedback={onFeedback}
      />,
    );
    expect(screen.getByText(/3 of 20 focused transitions/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next Coach passage" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() => expect(onFeedback).toHaveBeenCalledWith(true));
    expect(screen.getByText(/feedback is saved/i)).toBeTruthy();
  });

  it("offers a free repeat when new sessions are used", () => {
    render(<CoachPostSessionStage {...baseProps} quota={{ usedToday: 5, remaining: 0 }} />);
    expect(screen.getByRole("button", { name: "Repeat this passage" })).toBeTruthy();
  });
});
