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
  qualityGate: {
    passed: true,
    mechanism: "space/timing",
    measured: {
      sameFinger: 0,
      rowCross: 0,
      crossHand: 0,
      nTransitions: 0,
      wordsEndingEst: 0,
      vowelInitialWords: 0,
      avgWordLen: 0,
      nWords: 0,
    },
    violations: [],
  },
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
        targetMechanism="space/timing"
        quota={{ usedToday: 1, remaining: 0 }}
        passage={passage}
        onStart={() => {}}
      />,
    );
    expect(screen.getAllByText(/space\/timing/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/40%/i)).toBeTruthy();
    expect(screen.getByText(/The Rhythm of the Sea/i)).toBeTruthy();
  });

  it("names the targeted mechanism, not the report's first row", () => {
    const withNonAlphaFirst: WhyReport = {
      ...report,
      mechanisms: [
        {
          mechanism: "non-alpha",
          count: 60,
          sharePct: 60,
          avgMs: 400,
          p95Ms: 600,
          topConfusions: [],
          topBigrams: [],
        },
        ...report.mechanisms,
      ],
    };
    render(
      <CoachPreSessionStage
        report={withNonAlphaFirst}
        targetMechanism="space/timing"
        quota={{ usedToday: 1, remaining: 0 }}
        passage={passage}
        onStart={() => {}}
      />,
    );
    expect(screen.getAllByText(/space\/timing/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/non-alpha/i)).toBeNull();
  });

  it("shows remaining free sessions with the subscribe path", () => {
    render(
      <CoachPreSessionStage
        report={report}
        targetMechanism="space/timing"
        quota={{ usedToday: 0, remaining: 1 }}
        passage={passage}
        onStart={() => {}}
      />,
    );
    expect(screen.getByText(/1 more session today/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /subscribe/i })).toBeTruthy();
  });

  // The passage on screen IS the allocation that was just consumed, so the
  // start button must stay enabled even at remaining: 0.
  it("keeps start enabled and states this is today's session when quota is spent", () => {
    render(
      <CoachPreSessionStage
        report={report}
        targetMechanism="space/timing"
        quota={{ usedToday: 1, remaining: 0 }}
        passage={passage}
        onStart={() => {}}
      />,
    );
    expect(screen.getByText(/this is today's session/i)).toBeTruthy();
    const start = screen.getByRole("button", { name: /start coach session/i });
    expect((start as HTMLButtonElement).disabled).toBe(false);
  });
});
