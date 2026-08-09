/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CoachGenerationDetails } from "./CoachGenerationDetails";
import type { PassageRecord } from "#/server/coach/catalog";

const passage: PassageRecord = {
  id: "p1",
  title: "The Silk Road",
  topic: "trade routes",
  difficulty: "hard",
  mechanisms: ["cross-hand"],
  triggerTargets: { cross_hand_rate: 0.527 },
  measuredDensity: { crossHand: 0.481 },
  qualityGate: {
    passed: false,
    mechanism: "cross-hand",
    measured: {
      sameFinger: 0.216,
      rowCross: 0.345,
      crossHand: 0.481,
      nTransitions: 0,
      wordsEndingEst: 0.36,
      vowelInitialWords: 0.177,
      avgWordLen: 4.8,
      nWords: 0,
    },
    violations: ["saturation: cross-hand below threshold"],
  },
  text: "the silk road linked east and west",
  wordCount: 8,
  paragraphs: 1,
  source: "ai:deepseek-v4-flash:v6",
  status: "needs_review",
  targetKey: "abc",
  usageCount: 0,
  llmOutput: {
    analysis: { content: "{\"suggested_topics\":[\"trade routes\"]}", usage: { promptTokens: 1, completionTokens: 2 } },
    generation: { content: "{\"test_cases\":[]}", usage: { promptTokens: 3, completionTokens: 4 } },
    prompts: {
      analysis: "You are an expert typing biomechanist...",
      generation: "You are an adaptive typing practice content generator...",
    },
    model: "deepseek-v4-flash",
    latencyMs: 150_000,
  },
};

afterEach(cleanup);

describe("CoachGenerationDetails", () => {
  it("renders the gate verdict and violations", () => {
    render(<CoachGenerationDetails passage={passage} reviewMode />);
    expect(screen.getByText(/failed/i)).toBeTruthy();
    expect(screen.getByText(/saturation: cross-hand below threshold/i)).toBeTruthy();
  });

  it("renders measured vs required densities", () => {
    render(<CoachGenerationDetails passage={passage} reviewMode />);
    expect(screen.getByText(/cross_hand_rate/i)).toBeTruthy();
    expect(screen.getByText(/0.527/i)).toBeTruthy();
    expect(screen.getByText(/0.481/i)).toBeTruthy();
  });

  it("renders the raw LLM output and metadata", () => {
    render(<CoachGenerationDetails passage={passage} reviewMode />);
    expect(screen.getByText(/suggested_topics/i)).toBeTruthy();
    expect(screen.getByText(/test_cases/i)).toBeTruthy();
    expect(screen.getByText(/150000/i)).toBeTruthy();
    expect(screen.getByText(/The Silk Road/i)).toBeTruthy();
  });

  it("renders the prompts that generated the passage", () => {
    render(<CoachGenerationDetails passage={passage} reviewMode />);
    expect(screen.getByText(/expert typing biomechanist/i)).toBeTruthy();
    expect(screen.getByText(/adaptive typing practice content generator/i)).toBeTruthy();
  });

  it("labels template prompts with placeholders as templates, filled prompts as filled", () => {
    render(<CoachGenerationDetails passage={passage} reviewMode />);
    expect(screen.getAllByText(/prompt \(filled\)/i).length).toBe(2);
    const templated = { ...passage, llmOutput: { ...passage.llmOutput!, prompts: { analysis: "Here is the report:\n\n<WHY_REPORT>", generation: "Write about: <ROOT_CAUSE_RESULT>" } } };
    render(<CoachGenerationDetails passage={templated} reviewMode />);
    expect(screen.getAllByText(/prompt \(template\)/i).length).toBe(2);
  });

  it("renders nothing when review mode is off", () => {
    const { container } = render(<CoachGenerationDetails passage={passage} reviewMode={false} />);
    expect(container.textContent ?? "").toBe("");
  });
});
