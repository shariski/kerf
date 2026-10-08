import {
  getCodeSnippet,
  getCodeSnippetsForLanguage,
  type CodeLanguage,
  type CodeSnippet,
} from "./corpus";
import {
  CODE_FOCUSES,
  codeFocusAt,
  codeFocusScore,
  pickCodeSnippetForFocus,
  recommendCodeFocus,
  type CodeFocus,
} from "./focus";
import { CODE_LANGUAGES } from "./languages";
import type { CodeSessionEventDto } from "./session";

export type CodeEvidenceCell = { attempts: number; errors: number; hesitations: number };
export type CodeAdaptiveEvidence = {
  sessions: number;
  focuses: Record<CodeFocus, CodeEvidenceCell>;
  chars: Record<string, CodeEvidenceCell>;
};
export type CodeAdaptiveRun = {
  snippetId: string;
  events: readonly CodeSessionEventDto[];
  tabCount: number;
};
export type CodeFocusSuggestion = {
  focus: CodeFocus;
  source: "language" | "code" | "rotation";
  reason: string;
};

const HESITATION_MS = 600;
const IDLE_GAP_MS = 2000;

function emptyCell(): CodeEvidenceCell {
  return { attempts: 0, errors: 0, hesitations: 0 };
}

export function emptyCodeAdaptiveEvidence(): CodeAdaptiveEvidence {
  return {
    sessions: 0,
    focuses: { symbols: emptyCell(), brackets: emptyCell(), indentation: emptyCell() },
    chars: {},
  };
}

export function emptyCodeAdaptiveByLanguage(): Record<CodeLanguage, CodeAdaptiveEvidence> {
  return Object.fromEntries(
    CODE_LANGUAGES.map((language) => [language.id, emptyCodeAdaptiveEvidence()]),
  ) as Record<CodeLanguage, CodeAdaptiveEvidence>;
}

function record(cell: CodeEvidenceCell, event: CodeSessionEventDto) {
  cell.attempts++;
  if (event.isError) cell.errors++;
  if (event.keystrokeMs >= HESITATION_MS && event.keystrokeMs < IDLE_GAP_MS) {
    cell.hesitations++;
  }
}

/** Add a completed Code session without treating editor-generated Tab spaces as key presses. */
export function addCodeAdaptiveRun(
  evidence: CodeAdaptiveEvidence,
  run: CodeAdaptiveRun,
): CodeAdaptiveEvidence {
  const snippet = getCodeSnippet(run.snippetId);
  if (!snippet || run.events.length === 0) return evidence;
  const next: CodeAdaptiveEvidence = {
    sessions: evidence.sessions + 1,
    focuses: {
      symbols: { ...evidence.focuses.symbols },
      brackets: { ...evidence.focuses.brackets },
      indentation: { ...evidence.focuses.indentation },
    },
    chars: Object.fromEntries(
      Object.entries(evidence.chars).map(([char, cell]) => [char, { ...cell }]),
    ),
  };
  const hasInputProvenance = run.events.some((event) => event.inputMethod !== undefined);
  const uncertainLegacyIndent = !hasInputProvenance && run.tabCount > 0;
  let position = 0;
  let inTabExpansion = false;
  for (const event of run.events) {
    const focus = codeFocusAt(snippet.text, position);
    const tabExpansion = event.inputMethod === "tabExpansion";
    if (tabExpansion && !inTabExpansion) next.focuses.indentation.attempts++;
    inTabExpansion = tabExpansion;

    const legacyAutoSpace =
      uncertainLegacyIndent &&
      focus === "indentation" &&
      event.targetChar === " " &&
      !event.isError;
    if (!tabExpansion && !legacyAutoSpace && focus) {
      record(next.focuses[focus], event);
      if (focus !== "indentation") {
        const char = event.targetChar;
        const charCell = next.chars[char] ?? emptyCell();
        record(charCell, event);
        next.chars[char] = charCell;
      }
    }
    if (!event.isError) position++;
  }
  // Older saved sessions lack per-event provenance. Their leading spaces may
  // contain Tab expansions, so count one physical Tab instead of those spaces.
  if (uncertainLegacyIndent) next.focuses.indentation.attempts += run.tabCount;
  return next;
}

function strongestWeakness(evidence: CodeAdaptiveEvidence): CodeFocus | null {
  const candidates = CODE_FOCUSES.map((focus) => ({ focus, cell: evidence.focuses[focus] }))
    .filter(({ cell }) => cell.attempts >= 8 && (cell.errors >= 2 || cell.hesitations >= 4))
    .map(({ focus, cell }) => ({
      focus,
      score: (cell.errors + cell.hesitations * 0.25) / (cell.attempts + 6),
    }))
    .sort(
      (a, b) => b.score - a.score || CODE_FOCUSES.indexOf(a.focus) - CODE_FOCUSES.indexOf(b.focus),
    );
  return candidates[0]?.focus ?? null;
}

/** Prefer same-language evidence, then transferable Code evidence, then balanced rotation. */
export function suggestCodeFocus(
  languageEvidence: CodeAdaptiveEvidence,
  allCodeEvidence: CodeAdaptiveEvidence,
  completedInLanguage: number,
): CodeFocusSuggestion {
  const languageFocus = strongestWeakness(languageEvidence);
  if (languageFocus) {
    return {
      focus: languageFocus,
      source: "language",
      reason: "Chosen from recurring patterns in this language.",
    };
  }
  const sharedFocus = allCodeEvidence.sessions >= 2 ? strongestWeakness(allCodeEvidence) : null;
  if (sharedFocus) {
    return {
      focus: sharedFocus,
      source: "code",
      reason: "Chosen from recurring patterns across your Code sessions.",
    };
  }
  return {
    focus: recommendCodeFocus(completedInLanguage),
    source: "rotation",
    reason: "A balanced focus while Kerf learns your Code patterns.",
  };
}

function weakCharWeights(evidence: CodeAdaptiveEvidence, focus: CodeFocus) {
  return Object.entries(evidence.chars)
    .filter(
      ([char, cell]) => codeFocusAt(char, 0) === focus && cell.attempts >= 2 && cell.errors >= 2,
    )
    .map(([char, cell]) => ({ char, weight: cell.errors / (cell.attempts + 2) }))
    .sort((a, b) => b.weight - a.weight || a.char.localeCompare(b.char))
    .slice(0, 5);
}

function snippetScore(
  snippet: CodeSnippet,
  focus: CodeFocus,
  weakChars: ReturnType<typeof weakCharWeights>,
) {
  const focusDensity = (codeFocusScore(snippet, focus) / snippet.text.length) * 100;
  const targetCoverage = weakChars.reduce((score, item) => {
    const occurrences = [...snippet.text].filter((char) => char === item.char).length;
    return score + Math.min(occurrences, 4) * item.weight * 5;
  }, 0);
  return focusDensity + targetCoverage;
}

/** Choose a reviewed snippet that covers observed weak symbols without repeating recent content. */
export function pickAdaptiveCodeSnippet(
  language: CodeLanguage,
  focus: CodeFocus,
  recentIds: readonly string[],
  evidence: CodeAdaptiveEvidence,
  rng: () => number = Math.random,
): CodeSnippet {
  const weakChars = weakCharWeights(evidence, focus);
  if (weakChars.length === 0) return pickCodeSnippetForFocus(language, focus, recentIds, rng);
  const matching = getCodeSnippetsForLanguage(language).filter(
    (snippet) => codeFocusScore(snippet, focus) > 0,
  );
  if (matching.length === 0) throw new Error(`No ${focus} code snippets for ${language}`);
  const recent = new Set(recentIds.slice(0, 3));
  const fresh = matching.filter((snippet) => !recent.has(snippet.id));
  const pool = fresh.length > 0 ? fresh : matching;
  const ranked = pool.sort(
    (a, b) =>
      snippetScore(b, focus, weakChars) - snippetScore(a, focus, weakChars) ||
      a.id.localeCompare(b.id),
  );
  const shortlist = ranked.slice(0, 3);
  const index = Math.min(shortlist.length - 1, Math.max(0, Math.floor(rng() * shortlist.length)));
  const selected = shortlist[index];
  if (!selected) throw new Error(`No ${focus} code snippets for ${language}`);
  return selected;
}
