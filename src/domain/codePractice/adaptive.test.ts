import { describe, expect, it } from "vitest";
import { getCodeSnippet } from "./corpus";
import {
  addCodeAdaptiveRun,
  emptyCodeAdaptiveEvidence,
  pickAdaptiveCodeSnippet,
  suggestCodeFocus,
} from "./adaptive";
import type { CodeSessionEventDto } from "./session";

function run(snippetId: string, errorOnBracket = false, expandIndent = false) {
  const snippet = getCodeSnippet(snippetId);
  if (!snippet) throw new Error(`Missing ${snippetId}`);
  const events: CodeSessionEventDto[] = [];
  let tabCount = 0;
  let inIndent = false;
  for (let index = 0; index < snippet.text.length; index++) {
    const char = snippet.text[index]!;
    if (char === "\n") inIndent = true;
    const generated = expandIndent && inIndent && char === " ";
    if (generated && snippet.text[index - 1] !== " ") tabCount++;
    if (char !== " " && char !== "\n") inIndent = false;
    const base: CodeSessionEventDto = {
      targetChar: char,
      actualChar: char,
      isError: false,
      keystrokeMs: 150,
      timestamp: "2026-10-01T00:00:00.000Z",
      inputMethod: generated ? "tabExpansion" : "key",
    };
    if (errorOnBracket && /[()[\]{}<>]/.test(char)) {
      events.push({ ...base, actualChar: "x", isError: true });
    }
    events.push(base);
  }
  return { snippetId, events, tabCount };
}

describe("Code adaptation", () => {
  it("falls back to a balanced rotation until there is repeated evidence", () => {
    const empty = emptyCodeAdaptiveEvidence();
    expect([0, 1, 2].map((count) => suggestCodeFocus(empty, empty, count))).toEqual([
      { focus: "brackets", source: "rotation", reason: expect.any(String) },
      { focus: "symbols", source: "rotation", reason: expect.any(String) },
      { focus: "indentation", source: "rotation", reason: expect.any(String) },
    ]);
  });

  it("selects the observed weak focus in the current language", () => {
    const evidence = addCodeAdaptiveRun(emptyCodeAdaptiveEvidence(), run("js-filter-names", true));
    expect(evidence.focuses.brackets.errors).toBeGreaterThanOrEqual(2);
    expect(suggestCodeFocus(evidence, evidence, 1)).toMatchObject({
      focus: "brackets",
      source: "language",
    });
  });

  it("can transfer a recurring Code pattern when a language is new", () => {
    let shared = emptyCodeAdaptiveEvidence();
    shared = addCodeAdaptiveRun(shared, run("js-filter-names", true));
    shared = addCodeAdaptiveRun(shared, run("js-optional-profile", true));
    expect(suggestCodeFocus(emptyCodeAdaptiveEvidence(), shared, 0)).toMatchObject({
      focus: "brackets",
      source: "code",
    });
  });

  it("counts each physical Tab once and leaves generated spaces out of per-key evidence", () => {
    const evidence = addCodeAdaptiveRun(emptyCodeAdaptiveEvidence(), run("py-label", false, true));
    expect(evidence.focuses.indentation.attempts).toBe(4);
    expect(evidence.chars[" "]).toBeUndefined();
  });

  it("handles older Tab sessions conservatively and notices repeated hesitation", () => {
    const legacy = run("py-label", false, true);
    const legacyEvidence = addCodeAdaptiveRun(emptyCodeAdaptiveEvidence(), {
      ...legacy,
      events: legacy.events.map(({ inputMethod: _inputMethod, ...event }) => event),
    });
    expect(legacyEvidence.focuses.indentation.attempts).toBe(4);

    const slow = run("js-filter-names");
    slow.events.forEach((event) => {
      if (/[()[\]{}<>]/.test(event.targetChar)) event.keystrokeMs = 700;
    });
    const evidence = addCodeAdaptiveRun(emptyCodeAdaptiveEvidence(), slow);
    expect(suggestCodeFocus(evidence, evidence, 1)).toMatchObject({
      focus: "brackets",
      source: "language",
    });
  });

  it("prioritizes weak symbols while avoiding recently used snippets", () => {
    const evidence = emptyCodeAdaptiveEvidence();
    evidence.chars["?"] = { attempts: 10, errors: 6, hesitations: 0 };
    const first = pickAdaptiveCodeSnippet("javascript", "symbols", [], evidence, () => 0);
    const next = pickAdaptiveCodeSnippet("javascript", "symbols", [first.id], evidence, () => 0);
    expect(first.text).toContain("?");
    expect(next.id).not.toBe(first.id);
  });
});
