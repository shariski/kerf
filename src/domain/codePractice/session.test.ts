import { describe, expect, it } from "vitest";
import { CODE_CORPUS_VERSION, getCodeSnippet } from "./corpus";
import { summarizeCodeSession } from "./session";
import { validateCodeSessionInput } from "./validateSession";

const snippet = getCodeSnippet("js-filter-names");

function completedInput() {
  if (!snippet) throw new Error("Missing test snippet");
  const startedAt = "2026-10-01T08:00:00.000Z";
  return {
    sessionId: "00000000-0000-4000-8000-000000000001",
    keyboardProfileId: "00000000-0000-4000-8000-000000000002",
    corpusVersion: CODE_CORPUS_VERSION,
    snippetId: snippet.id,
    startedAt,
    endedAt: "2026-10-01T08:01:00.000Z",
    tabCount: 1,
    events: [...snippet.text].map((char) => ({
      targetChar: char,
      actualChar: char,
      isError: false,
      keystrokeMs: 200,
      timestamp: startedAt,
    })),
  };
}

describe("code session boundary", () => {
  it("accepts a complete corpus snippet and calculates a separate summary", () => {
    const input = validateCodeSessionInput(completedInput());
    const summary = summarizeCodeSession(input);
    expect(summary.accuracyPct).toBe(100);
    expect(summary.symbolAccuracyPct).toBe(100);
    expect(summary.totalErrors).toBe(0);
    expect(summary.wpm).toBeGreaterThan(0);
  });

  it("rejects a partial or substituted snippet", () => {
    const input = completedInput();
    input.events.pop();
    expect(() => validateCodeSessionInput(input)).toThrow(/match/);
    expect(() => validateCodeSessionInput({ ...completedInput(), snippetId: "unknown" })).toThrow(
      /Unknown/,
    );
  });

  it("counts retries as errors without losing the completed text", () => {
    const input = completedInput();
    input.events.splice(1, 0, {
      ...input.events[1]!,
      actualChar: "x",
      isError: true,
    });
    const summary = summarizeCodeSession(validateCodeSessionInput(input));
    expect(summary.totalErrors).toBe(1);
    expect(summary.accuracyPct).toBeLessThan(100);
  });

  it("accepts a completed version 1 session for unchanged original text", () => {
    expect(validateCodeSessionInput({ ...completedInput(), corpusVersion: 1 }).snippetId).toBe(
      "js-filter-names",
    );
    expect(() =>
      validateCodeSessionInput({
        ...completedInput(),
        corpusVersion: 1,
        snippetId: "json-profile",
      }),
    ).toThrow(/Unknown/);
  });

  it("validates that one Tab action generated only its expected spaces", () => {
    const input = completedInput();
    if (!snippet) throw new Error("Missing test snippet");
    const tabStart = snippet.text.indexOf("\n  ") + 1;
    const events = input.events.map((event, index) => ({
      ...event,
      inputMethod: index === tabStart || index === tabStart + 1 ? "tabExpansion" : "key",
    }));
    expect(validateCodeSessionInput({ ...input, events }).tabCount).toBe(1);
    expect(() =>
      validateCodeSessionInput({
        ...input,
        events: events.map((event) => ({ ...event, inputMethod: "key" })),
      }),
    ).toThrow(/Tab count/);
    expect(() =>
      validateCodeSessionInput({
        ...input,
        events: events.map((event, index) =>
          index === 0 ? { ...event, inputMethod: "tabExpansion" } : event,
        ),
      }),
    ).toThrow(/invalid Tab expansion/);
  });
});
