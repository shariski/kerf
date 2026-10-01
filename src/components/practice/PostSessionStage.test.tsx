/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionSummary } from "#/domain/session/summarize";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

import { PostSessionStage } from "./PostSessionStage";

afterEach(() => cleanup());

describe("PostSessionStage", () => {
  it("shows measured results without an improvement placeholder", () => {
    window.scrollTo = vi.fn();
    const summary = {
      accuracyPct: 97,
      wpm: 42,
      elapsedLabel: "1m 12s",
      wordCount: 30,
      uniqueErrorCount: 2,
      errorPositions: [],
      patterns: [],
      emergentWeaknesses: [],
      insightText: "Keep your pace steady.",
      topWeaknessName: null,
    } as unknown as SessionSummary;

    render(
      <PostSessionStage
        target="some text"
        title="Session complete."
        summary={summary}
        onPracticeAgain={vi.fn()}
      />,
    );
    expect(screen.getByText("97%")).toBeTruthy();
    expect(screen.queryByText(/session history arrives/i)).toBeNull();
    expect(screen.queryByText(/weakness shifts/i)).toBeNull();
  });
});
