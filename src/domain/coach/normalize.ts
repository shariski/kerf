/**
 * Normalize AI-generated passage text for the typing engine.
 *
 * LLM passages are multi-paragraph (1-3 paragraphs, separated by blank
 * lines), but kerf's typing engine types character-by-character and cannot
 * type newlines — the UI renders a `\n` as a space, so a regular space
 * never matches. Normalize all whitespace runs (paragraph breaks, tabs,
 * CR, non-breaking spaces, repeated spaces) to single regular spaces.
 */
export function normalizePassageText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}
