import { describe, expect, it } from "vitest";
import { type PassageRecord, passageForClient, targetKeyFor } from "./catalog";

describe("targetKeyFor", () => {
  it("is stable regardless of mechanism order", () => {
    expect(targetKeyFor(["cross-hand", "row-cross"], "hard", "cross-hand")).toBe(
      targetKeyFor(["row-cross", "cross-hand"], "hard", "cross-hand"),
    );
  });
  it("differs by difficulty", () => {
    expect(targetKeyFor(["cross-hand"], "hard", "cross-hand")).not.toBe(
      targetKeyFor(["cross-hand"], "easy", "cross-hand"),
    );
  });
  it("separates passages for different targets within the same weakness set", () => {
    expect(targetKeyFor(["cross-hand", "row-cross"], "hard", "cross-hand")).not.toBe(
      targetKeyFor(["cross-hand", "row-cross"], "hard", "row-cross"),
    );
  });
});

describe("passageForClient", () => {
  const passage = {
    id: "passage-id",
    title: "Test",
    topic: "Test",
    difficulty: "hard",
    mechanisms: ["cross-hand"],
    triggerTargets: null,
    measuredDensity: null,
    qualityGate: { passed: true, mechanism: "cross-hand", measured: {}, violations: [] },
    text: "Example",
    wordCount: 1,
    paragraphs: 1,
    source: "test",
    status: "active",
    targetKey: "key",
    usageCount: 1,
    llmOutput: { prompts: { analysis: "another user's diagnostic" } },
    reviewNote: "private note",
  } as unknown as PassageRecord;

  it("removes private review and generation data from a regular session", () => {
    const result = passageForClient(passage, false);
    expect(result.llmOutput).toBeUndefined();
    expect(result.reviewNote).toBeUndefined();
    expect(result.text).toBe("Example");
  });

  it("keeps generation details in review mode", () => {
    expect(passageForClient(passage, true).llmOutput).toBe(passage.llmOutput);
  });
});
