import type { KeystrokeEvent, TransitionPhase } from "#/domain/stats/types";

/**
 * Pure helpers used by the `persistSession` server function — extracted
 * here so they can be unit-tested without a DB or request context.
 *
 * The server function glues these together with auth, profile lookup,
 * and the actual Drizzle transaction.
 */

// --- DTOs shared with the client ------------------------------------------

export type KeystrokeEventDto = {
  targetChar: string;
  actualChar: string;
  isError: boolean;
  keystrokeMs: number;
  prevChar?: string;
  /** ISO-8601. Date doesn't survive JSON over the wire. */
  timestamp: string;
};

export type PersistSessionInput = {
  /** Client-generated UUID — makes the call idempotent if the client
   * retries (we ON CONFLICT DO NOTHING on the sessions table). */
  sessionId: string;
  keyboardProfileId: string;
  mode: "adaptive" | "targeted_drill" | "diagnostic";
  /** The exact exercise text the user typed. Used to derive
   * positionInWord for each event. */
  target: string;
  events: KeystrokeEventDto[];
  /** ISO-8601 wall-clock. Client synthesizes from performance.now()
   * delta at complete time (`Date.now() - elapsedMs`). */
  startedAt: string;
  endedAt: string;
  phase: TransitionPhase;
  /** JSONB payload — e.g. `{ handIsolation: "either", maxWordLength: 6 }`
   * for adaptive sessions, or `{ drillTarget: "b" }` / `{ drillPreset:
   * "innerColumn" }` for drill sessions. */
  filterConfig: Record<string, unknown>;
};

// --- validator -------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MODES = new Set(["adaptive", "targeted_drill", "diagnostic"]);
const PHASES = new Set(["transitioning", "refining"]);

/**
 * Narrow `unknown` to `PersistSessionInput`. Throws on any structural
 * issue so the server function returns a useful error to the client
 * instead of a silent cast. Minimal checks — TypeScript carries the
 * shape; this is just the API boundary guard.
 */
export function validatePersistSessionInput(input: unknown): PersistSessionInput {
  if (typeof input !== "object" || input === null) {
    throw new Error("persistSession: input must be an object");
  }
  const i = input as Record<string, unknown>;

  const requireString = (key: string): string => {
    const v = i[key];
    if (typeof v !== "string" || v.length === 0) {
      throw new Error(`persistSession: "${key}" must be a non-empty string`);
    }
    return v;
  };
  const requireUuid = (key: string): string => {
    const v = requireString(key);
    if (!UUID_RE.test(v)) {
      throw new Error(`persistSession: "${key}" must be a UUID`);
    }
    return v;
  };
  const requireIso = (key: string): string => {
    const v = requireString(key);
    if (Number.isNaN(new Date(v).getTime())) {
      throw new Error(`persistSession: "${key}" must be an ISO-8601 date`);
    }
    return v;
  };

  const sessionId = requireUuid("sessionId");
  const keyboardProfileId = requireUuid("keyboardProfileId");
  const mode = requireString("mode");
  if (!MODES.has(mode)) {
    throw new Error(`persistSession: "mode" must be one of ${[...MODES].join(", ")}`);
  }
  const target = requireString("target");
  const startedAt = requireIso("startedAt");
  const endedAt = requireIso("endedAt");
  const phase = requireString("phase");
  if (!PHASES.has(phase)) {
    throw new Error(`persistSession: "phase" must be one of ${[...PHASES].join(", ")}`);
  }

  if (!Array.isArray(i.events)) {
    throw new Error(`persistSession: "events" must be an array`);
  }
  const events: KeystrokeEventDto[] = i.events.map((raw, idx) => {
    if (typeof raw !== "object" || raw === null) {
      throw new Error(`persistSession: event ${idx} must be an object`);
    }
    const e = raw as Record<string, unknown>;
    if (
      typeof e.targetChar !== "string" ||
      typeof e.actualChar !== "string" ||
      typeof e.isError !== "boolean" ||
      typeof e.keystrokeMs !== "number" ||
      typeof e.timestamp !== "string"
    ) {
      throw new Error(`persistSession: event ${idx} has malformed fields`);
    }
    return {
      targetChar: e.targetChar,
      actualChar: e.actualChar,
      isError: e.isError,
      keystrokeMs: e.keystrokeMs,
      prevChar: typeof e.prevChar === "string" ? e.prevChar : undefined,
      timestamp: e.timestamp,
    };
  });

  const filterConfig =
    i.filterConfig && typeof i.filterConfig === "object"
      ? (i.filterConfig as Record<string, unknown>)
      : {};

  return {
    sessionId,
    keyboardProfileId,
    mode: mode as PersistSessionInput["mode"],
    target,
    events,
    startedAt,
    endedAt,
    phase: phase as TransitionPhase,
    filterConfig,
  };
}

// --- event enrichment ------------------------------------------------------

export type EnrichedEvent = {
  sequence: number;
  targetChar: string;
  actualChar: string;
  isError: boolean;
  keystrokeMs: number;
  prevChar: string | null;
  /** 0-based index of the current target position within its word
   * (space-delimited). -1 if the target position has run off the end
   * of the string (shouldn't happen in practice). */
  positionInWord: number;
  /** True if the previous event was an error at the same target
   * position — i.e. this event is a second+ attempt at that spot. */
  isRetype: boolean;
  timestamp: Date;
};

/**
 * Walk the session's event stream in order, tagging each event with
 * its within-word index and whether it's a retype. Mirrors the
 * reducer's position semantics: a correct keystroke advances the
 * cursor; an error does not.
 */
export function enrichEvents(
  events: readonly KeystrokeEventDto[],
  target: string,
): EnrichedEvent[] {
  const wordStart = wordStartsFor(target);
  const out: EnrichedEvent[] = [];
  let pos = 0;
  let firstAtPos = true;

  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    const clampedPos = Math.min(pos, target.length - 1);
    const positionInWord = target.length === 0 ? -1 : clampedPos - wordStart[clampedPos]!;

    out.push({
      sequence: i,
      targetChar: e.targetChar,
      actualChar: e.actualChar,
      isError: e.isError,
      keystrokeMs: e.keystrokeMs,
      prevChar: e.prevChar ?? null,
      positionInWord,
      isRetype: !firstAtPos,
      timestamp: new Date(e.timestamp),
    });

    if (e.isError) {
      firstAtPos = false;
    } else {
      pos++;
      firstAtPos = true;
    }
  }

  return out;
}

function wordStartsFor(target: string): number[] {
  const out: number[] = new Array(target.length);
  let curStart = 0;
  for (let i = 0; i < target.length; i++) {
    if (i > 0 && target[i - 1] === " ") curStart = i;
    out[i] = curStart;
  }
  return out;
}

// --- session header derivation --------------------------------------------

export type SessionHeader = {
  /** Total keystrokes attempted this session. */
  totalChars: number;
  /** Wrong keystrokes (retries each count). */
  totalErrors: number;
  /** 0–1. 1.0 when no events (empty session). */
  accuracy: number;
  /** Words per minute, 0 when elapsed too short to be meaningful. */
  wpm: number;
  /** Elapsed time in milliseconds. */
  elapsedMs: number;
};

/**
 * Minimum elapsed time before WPM is non-zero. Sub-2s sessions are
 * almost always incomplete runs — mirrors the guard in LiveWpm and
 * summarizeSession.
 */
export const MIN_ELAPSED_MS_FOR_WPM = 2000;

const CHARS_PER_WORD = 5;

export function deriveSessionHeader(input: {
  events: readonly KeystrokeEventDto[];
  startedAt: string;
  endedAt: string;
}): SessionHeader {
  const { events, startedAt, endedAt } = input;
  const correctCount = events.filter((e) => !e.isError).length;
  const totalErrors = events.length - correctCount;
  const accuracy = events.length === 0 ? 1 : correctCount / events.length;
  const elapsedMs = Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
  const wpm =
    elapsedMs < MIN_ELAPSED_MS_FOR_WPM ? 0 : correctCount / CHARS_PER_WORD / (elapsedMs / 60000);

  return {
    totalChars: events.length,
    totalErrors,
    accuracy,
    wpm,
    elapsedMs,
  };
}

// --- typed alias for KeystrokeEvent consumption ---------------------------

/**
 * Convert wire-format events back to the domain's in-memory shape so
 * we can feed them to `computeStats` / `computeSplitMetrics`, which
 * expect `timestamp: Date`.
 */
export function toDomainEvents(events: readonly KeystrokeEventDto[]): KeystrokeEvent[] {
  return events.map((e) => ({
    targetChar: e.targetChar,
    actualChar: e.actualChar,
    isError: e.isError,
    keystrokeMs: e.keystrokeMs,
    prevChar: e.prevChar,
    timestamp: new Date(e.timestamp),
  }));
}
