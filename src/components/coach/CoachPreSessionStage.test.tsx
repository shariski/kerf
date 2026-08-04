/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CoachPreSessionStage } from "./CoachPreSessionStage";
import type { WhyReport } from "#/domain/coach/whyReport";

const report: WhyReport = {
  totalTrueConfusions: 100,
  mechanisms: [
    {
      mechanism: "space/timing",
      count: 40,
      sharePct: 40,
      avgMs: 327,
      p95Ms: 520,
      topConfusions: [{ target: "e", typedAs: " ", count: 5 }],
      topBigrams: [{ bigram: "t ", count: 3 }],
    },
  ],
};

afterEach(() => cleanup());

describe("CoachPreSessionStage", () => {
  it("renders the top mechanism with its share and timing", () => {
    render(
      <CoachPreSessionStage
        report={report}
        quota={{ usedToday: 0, remaining: 1 }}
        onStart={() => {}}
      />,
    );
    expect(screen.getByText(/space\/timing/i)).toBeTruthy();
    expect(screen.getByText(/40%/i)).toBeTruthy();
  });

  it("shows quota exhaustion state", () => {
    render(
      <CoachPreSessionStage
        report={report}
        quota={{ usedToday: 1, remaining: 0 }}
        onStart={() => {}}
      />,
    );
    expect(screen.getByText(/come back tomorrow/i)).toBeTruthy();
  });
});
