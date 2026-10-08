import { getCodeSnippetsForLanguage, type CodeLanguage, type CodeSnippet } from "./corpus";

export type CodeFocus = "symbols" | "brackets" | "indentation";

export const CODE_FOCUSES: readonly CodeFocus[] = ["symbols", "brackets", "indentation"];

export function codeFocusLabel(focus: CodeFocus, language: CodeLanguage): string {
  if (focus === "symbols") return "Quotes and symbols";
  if (focus === "indentation") return "Indentation";
  if (language === "python") return "Brackets and lookup";
  if (language === "html") return "Tags and attributes";
  if (language === "javascript" || language === "typescript") return "Brackets and chaining";
  if (language === "css") return "Blocks and selectors";
  if (language === "json") return "Objects and arrays";
  if (language === "sql") return "Clauses and expressions";
  if (language === "bash") return "Expansions and tests";
  if (language === "ruby") return "Blocks and calls";
  if (language === "php") return "Arrays and calls";
  return "Brackets and calls";
}

/** Balanced cold-start rotation until code-specific evidence is reliable. */
export function recommendCodeFocus(recentRunsInLanguage: number): CodeFocus {
  return (["brackets", "symbols", "indentation"] as const)[recentRunsInLanguage % 3] ?? "brackets";
}

/** A position belongs to one code focus so evidence does not double-count brackets as symbols. */
export function codeFocusAt(text: string, index: number): CodeFocus | null {
  const char = text[index];
  if (!char) return null;
  if (char === "\n") return "indentation";
  if (char === " ") {
    const lineStart = text.lastIndexOf("\n", index - 1) + 1;
    return /^ *$/.test(text.slice(lineStart, index)) ? "indentation" : null;
  }
  if (/[()[\]{}<>]/.test(char)) return "brackets";
  return /[^a-zA-Z0-9\s]/.test(char) ? "symbols" : null;
}

/** Rank reviewed snippets by opportunities to practice the selected focus. */
export function codeFocusScore(snippet: CodeSnippet, focus: CodeFocus): number {
  return [...snippet.text].reduce(
    (score, _char, index) => score + Number(codeFocusAt(snippet.text, index) === focus),
    0,
  );
}

/** Select a relevant, reviewed snippet without repeating recent runs when possible. */
export function pickCodeSnippetForFocus(
  language: CodeLanguage,
  focus: CodeFocus,
  recentIds: readonly string[],
  rng: () => number = Math.random,
): CodeSnippet {
  const ranked = getCodeSnippetsForLanguage(language)
    .filter((snippet) => codeFocusScore(snippet, focus) > 0)
    .sort((a, b) => codeFocusScore(b, focus) - codeFocusScore(a, focus) || a.id.localeCompare(b.id))
    .slice(0, 8);
  if (ranked.length === 0) throw new Error(`No ${focus} code snippets for ${language}`);

  const recent = new Set(recentIds.slice(0, 3));
  const fresh = ranked.filter((snippet) => !recent.has(snippet.id));
  const pool = fresh.length > 0 ? fresh : ranked;
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(rng() * pool.length)));
  const selected = pool[index];
  if (!selected) throw new Error(`No ${focus} code snippets for ${language}`);
  return selected;
}
