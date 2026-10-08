import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  CODE_INDENT_WIDTH,
  CODE_LANGUAGES,
  CODE_SNIPPETS,
  codeLanguageLabel,
  emptyCodeLanguageCounts,
  getCodeSnippet,
  getCodeSnippetsForLanguage,
  isCodeLanguage,
  pickCodeSnippet,
} from "./corpus";

describe("code practice corpus", () => {
  it("has a substantial, unique, multiline set for every language", () => {
    expect(new Set(CODE_SNIPPETS.map((item) => item.id)).size).toBe(CODE_SNIPPETS.length);
    expect(new Set(CODE_SNIPPETS.map((item) => item.text)).size).toBe(CODE_SNIPPETS.length);
    expect(CODE_LANGUAGES).toHaveLength(18);
    expect(CODE_SNIPPETS).toHaveLength(225);
    expect(CODE_SNIPPETS.filter((item) => item.introducedInVersion === 1)).toHaveLength(45);
    expect(CODE_SNIPPETS.filter((item) => item.introducedInVersion === 2)).toHaveLength(180);
    for (const { id } of CODE_LANGUAGES) {
      expect(getCodeSnippetsForLanguage(id).length).toBeGreaterThanOrEqual(12);
    }
    for (const item of CODE_SNIPPETS) {
      expect(getCodeSnippet(item.id)).toBe(item);
      expect(item.lineCount).toBeGreaterThanOrEqual(2);
      expect(item.lineCount).toBeLessThanOrEqual(5);
      expect(item.lineCount).toBe(item.text.split("\n").length);
      expect(item.text.length).toBeLessThanOrEqual(240);
      expect(item.text).not.toMatch(/[\t\r]/);
      expect(item.text).toMatch(/^[\x20-\x7E\n]+$/);
      expect(item.text).not.toMatch(/ +\n| +$/);
      expect(item.text).toMatch(/[^a-zA-Z0-9\s]/);
      expect(item.symbols).toEqual(
        [...new Set([...item.text].filter((char) => /[^a-zA-Z0-9\s]/.test(char)))].sort(),
      );
      for (const line of item.text.split("\n")) {
        const indent = line.match(/^ */)?.[0].length ?? 0;
        expect([0, CODE_INDENT_WIDTH[item.language]], item.id).toContain(indent);
      }
    }
  });

  it("contains syntactically valid JavaScript examples", () => {
    for (const item of CODE_SNIPPETS.filter(
      (snippet) => snippet.language === "javascript" || snippet.language === "typescript",
    )) {
      const output = ts.transpileModule(item.text, {
        fileName: `${item.id}.${item.language === "typescript" ? "ts" : "js"}`,
        reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      });
      expect(
        output.diagnostics?.filter(
          (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
        ),
        item.id,
      ).toEqual([]);
    }
  });

  it("contains valid JSON documents and recognizes every language centrally", () => {
    for (const item of getCodeSnippetsForLanguage("json")) {
      expect(() => JSON.parse(item.text), item.id).not.toThrow();
    }
    const counts = emptyCodeLanguageCounts();
    for (const { id, label } of CODE_LANGUAGES) {
      expect(isCodeLanguage(id)).toBe(true);
      expect(codeLanguageLabel(id)).toBe(label);
      expect(counts[id]).toBe(0);
    }
    expect(isCodeLanguage("unknown")).toBe(false);
  });

  it("avoids the most recent examples when choosing a new one", () => {
    const all = getCodeSnippetsForLanguage("python");
    const chosen = pickCodeSnippet(
      "python",
      all.slice(0, 3).map((item) => item.id),
      () => 0,
    );
    expect(chosen.id).toBe(all[3]?.id);
  });
});
