import { describe, expect, it } from "vitest";
import { CODE_LANGUAGES, getCodeSnippetsForLanguage } from "./corpus";
import {
  CODE_FOCUSES,
  codeFocusLabel,
  codeFocusScore,
  pickCodeSnippetForFocus,
  recommendCodeFocus,
} from "./focus";

describe("code focus selection", () => {
  it("offers a relevant reviewed snippet for each language and focus", () => {
    for (const { id } of CODE_LANGUAGES) {
      for (const focus of CODE_FOCUSES) {
        expect(
          getCodeSnippetsForLanguage(id).filter((item) => codeFocusScore(item, focus) > 0).length,
          `${id}: ${focus}`,
        ).toBeGreaterThanOrEqual(4);
        const snippet = pickCodeSnippetForFocus(id, focus, [], () => 0);
        expect(snippet.language).toBe(id);
        expect(codeFocusScore(snippet, focus)).toBeGreaterThan(0);
        if (focus === "indentation") expect(snippet.text, id).toMatch(/\n +\S/);
        expect(codeFocusLabel(focus, id).length).toBeGreaterThan(0);
      }
    }
  });

  it("moves away from recently used snippets in the same focus", () => {
    const first = pickCodeSnippetForFocus("javascript", "brackets", [], () => 0);
    const next = pickCodeSnippetForFocus("javascript", "brackets", [first.id], () => 0);
    expect(next.id).not.toBe(first.id);
  });

  it("rotates recommended code focuses without claiming weakness analysis", () => {
    expect([0, 1, 2, 3].map(recommendCodeFocus)).toEqual([
      "brackets",
      "symbols",
      "indentation",
      "brackets",
    ]);
  });
});
