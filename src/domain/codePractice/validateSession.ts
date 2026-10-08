import { z } from "zod";
import { CODE_CORPUS_VERSION, getCodeSnippet } from "./corpus";
import type { PersistCodeSessionInput } from "./session";

const eventSchema = z.object({
  targetChar: z.string().length(1),
  actualChar: z.string().length(1),
  isError: z.boolean(),
  keystrokeMs: z.number().finite().nonnegative(),
  timestamp: z.iso.datetime(),
  inputMethod: z.enum(["key", "tabExpansion"]).optional(),
});

const inputSchema = z.object({
  sessionId: z.uuid(),
  keyboardProfileId: z.uuid(),
  corpusVersion: z.number().int(),
  snippetId: z.string().min(1),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime(),
  tabCount: z.number().int().nonnegative().max(1000),
  events: z.array(eventSchema).min(1).max(2000),
});

/** Validate against the committed corpus; the client never supplies exercise text. */
export function validateCodeSessionInput(input: unknown): PersistCodeSessionInput {
  const data = inputSchema.parse(input);
  const snippet = getCodeSnippet(data.snippetId);
  if (
    !snippet ||
    data.corpusVersion < snippet.introducedInVersion ||
    data.corpusVersion > CODE_CORPUS_VERSION
  ) {
    throw new Error("Unknown code practice snippet or corpus version");
  }
  const completedText = data.events
    .filter((event) => !event.isError)
    .map((event) => event.targetChar)
    .join("");
  if (completedText !== snippet.text) {
    throw new Error("Code practice session does not match the completed snippet");
  }
  if (data.events.some((event) => !event.isError && event.actualChar !== event.targetChar)) {
    throw new Error("Code practice session has inconsistent events");
  }
  const elapsedMs = new Date(data.endedAt).getTime() - new Date(data.startedAt).getTime();
  if (elapsedMs < 0 || elapsedMs > 4 * 60 * 60 * 1000) {
    throw new Error("Code practice session duration is invalid");
  }
  if (data.tabCount > snippet.text.split("\n").length - 1) {
    throw new Error("Code practice session has too many indentation tabs");
  }
  if (data.events.some((event) => event.inputMethod !== undefined)) {
    let tabGroups = 0;
    let inTabGroup = false;
    for (const event of data.events) {
      if (event.inputMethod === undefined) {
        throw new Error("Code practice session has incomplete input provenance");
      }
      const generated = event.inputMethod === "tabExpansion";
      if (generated && (event.targetChar !== " " || event.actualChar !== " " || event.isError)) {
        throw new Error("Code practice session has invalid Tab expansion");
      }
      if (generated && !inTabGroup) tabGroups++;
      inTabGroup = generated;
    }
    if (tabGroups !== data.tabCount) {
      throw new Error("Code practice session Tab count does not match events");
    }
  }
  return data;
}
