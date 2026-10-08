export type CodeSessionEventDto = {
  targetChar: string;
  actualChar: string;
  isError: boolean;
  keystrokeMs: number;
  timestamp: string;
  /** Distinguishes one physical Tab press from the spaces it generated. */
  inputMethod?: "key" | "tabExpansion";
};

export type PersistCodeSessionInput = {
  sessionId: string;
  keyboardProfileId: string;
  corpusVersion: number;
  snippetId: string;
  startedAt: string;
  endedAt: string;
  tabCount: number;
  events: CodeSessionEventDto[];
};

export type CodeSessionSummary = {
  accuracyPct: number;
  symbolAccuracyPct: number | null;
  totalErrors: number;
  wpm: number;
  elapsedMs: number;
};

export function symbolAccuracyPct(
  events: readonly Pick<CodeSessionEventDto, "targetChar" | "isError">[],
): number | null {
  const symbols = events.filter((event) => /[^a-zA-Z0-9\s]/.test(event.targetChar));
  if (symbols.length === 0) return null;
  return Math.round((symbols.filter((event) => !event.isError).length / symbols.length) * 100);
}

export function summarizeCodeSession(input: PersistCodeSessionInput): CodeSessionSummary {
  const correct = input.events.filter((event) => !event.isError).length;
  const totalErrors = input.events.length - correct;
  const elapsedMs = Math.max(
    0,
    new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime(),
  );
  return {
    accuracyPct: Math.round((correct / input.events.length) * 100),
    symbolAccuracyPct: symbolAccuracyPct(input.events),
    totalErrors,
    wpm: elapsedMs >= 2000 ? Math.round(correct / 5 / (elapsedMs / 60000)) : 0,
    elapsedMs,
  };
}
