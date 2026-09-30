/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { WhyReport } from "#/domain/coach/whyReport";
import type { PassageRecord } from "#/server/coach/catalog";
import { CoachPreSessionStage } from "./CoachPreSessionStage";

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
  it("renders the focus with its share, cue, and passage title", () => {
    render(
      <CoachPreSessionStage
        report={report}
        targetMechanism="space/timing"
        quota={{ usedToday: 1, remaining: 0 }}
        passage={passage}
        onStart={() => {}}
      />,
    );
    expect(screen.getByText(/spacing and timing/i)).toBeTruthy();
    expect(screen.getByText(/40%/i)).toBeTruthy();
    expect(screen.getByText(/deliberate space/i)).toBeTruthy();
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
    expect(screen.getByText(/spacing and timing/i)).toBeTruthy();
    expect(screen.queryByText(/non-alpha/i)).toBeNull();
  });

  it("shows the free beta allowance without a subscription button", () => {
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
    expect(screen.queryByRole("button", { name: /subscribe/i })).toBeNull();
  });

  // The passage on screen IS the allocation that was just consumed, so the
  // start button must stay enabled even at remaining: 0.
  it("keeps start enabled for an allocated passage when quota is spent", () => {
    render(
      <CoachPreSessionStage
        report={report}
        targetMechanism="space/timing"
        quota={{ usedToday: 1, remaining: 0 }}
        passage={passage}
        onStart={() => {}}
      />,
    );
    expect(screen.getByText(/repeat this passage whenever you like/i)).toBeTruthy();
    const start = screen.getByRole("button", { name: /start this passage/i });
    expect((start as HTMLButtonElement).disabled).toBe(false);
  });
});
