/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CoachPreSessionStage } from "./CoachPreSessionStage";
import type { WhyReport } from "#/domain/coach/whyReport";
import type { PassageRecord } from "#/server/coach/catalog";

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

const passage: PassageRecord = {
  id: "p1",
  title: "The Rhythm of the Sea",
  topic: "the sea",
  difficulty: "hard",
  mechanisms: ["space/timing"],
  triggerTargets: null,
  measuredDensity: null,
  qualityGate: { passed: true, mechanism: "space/timing", measured: { sameFinger: 0, rowCross: 0, crossHand: 0, nTransitions: 0, wordsEndingEst: 0, vowelInitialWords: 0, avgWordLen: 0, nWords: 0 }, violations: [] },
  text: "The sea is vast and deep.",
  wordCount: 6,
  paragraphs: 1,
  source: "test",
  status: "active",
  targetKey: "k",
  usageCount: 0,
};

afterEach(() => cleanup());

describe("CoachPreSessionStage", () => {
  it("renders the top mechanism with its share, timing, and passage title", () => {
    render(
      <CoachPreSessionStage
        report={report}
        quota={{ usedToday: 0, remaining: 1 }}
        passage={passage}
        onStart={() => {}}
      />,
    );
    expect(screen.getAllByText(/space\/timing/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/40%/i)).toBeTruthy();
    expect(screen.getByText(/The Rhythm of the Sea/i)).toBeTruthy();
  });

  it("shows the free-quota state with the subscribe path", () => {
    render(
      <CoachPreSessionStage
        report={report}
        quota={{ usedToday: 0, remaining: 1 }}
        passage={passage}
        onStart={() => {}}
      />,
    );
    expect(screen.getByText(/session available today/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /subscribe/i })).toBeTruthy();
  });

  it("disables start and shows used state when the free session is spent", () => {
    render(
      <CoachPreSessionStage
        report={report}
        quota={{ usedToday: 1, remaining: 0 }}
        passage={passage}
        onStart={() => {}}
      />,
    );
    expect(screen.getByText(/today's session used/i)).toBeTruthy();
    const start = screen.getByRole("button", { name: /start coach session/i });
    expect((start as HTMLButtonElement).disabled).toBe(true);
  });
});
