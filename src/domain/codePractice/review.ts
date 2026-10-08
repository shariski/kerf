import { codeFocusAt, type CodeFocus } from "./focus";
import type { ErrorPosition } from "#/domain/session/summarize";

/** Preserve the first mistype at each code position for the shared error review. */
export function codeErrorPositions(
  events: readonly { isError: boolean; actualChar: string; targetChar: string }[],
): ErrorPosition[] {
  let position = 0;
  const firstErrors = new Map<number, ErrorPosition>();
  for (const event of events) {
    if (event.isError) {
      if (!firstErrors.has(position)) {
        firstErrors.set(position, {
          index: position,
          expected: event.targetChar,
          typed: event.actualChar,
        });
      }
    } else {
      position++;
    }
  }
  return [...firstErrors.values()].sort((a, b) => a.index - b.index);
}

export function summarizeCodeFocusEvidence(
  text: string,
  events: readonly { isError: boolean; inputMethod?: "key" | "tabExpansion" }[],
  focus: CodeFocus,
): { attempts: number; errors: number; accuracyPct: number | null; errorPositions: number[] } {
  let position = 0;
  let attempts = 0;
  let errors = 0;
  const errorPositions = new Set<number>();
  let inTabExpansion = false;
  for (const event of events) {
    const tabExpansion = event.inputMethod === "tabExpansion";
    if (tabExpansion && !inTabExpansion && focus === "indentation") attempts++;
    inTabExpansion = tabExpansion;
    if (!tabExpansion && codeFocusAt(text, position) === focus) {
      attempts++;
      if (event.isError) errors++;
    }
    if (event.isError) errorPositions.add(position);
    else position++;
  }
  return {
    attempts,
    errors,
    accuracyPct: attempts > 0 ? Math.round(((attempts - errors) / attempts) * 100) : null,
    errorPositions: [...errorPositions].sort((a, b) => a - b),
  };
}
