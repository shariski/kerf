import { describe, expect, it } from "vitest";
import {
  deriveSessionHeader,
  enrichEvents,
  toDomainEvents,
  validatePersistSessionInput,
  type KeystrokeEventDto,
  type PersistSessionInput,
  type PersistSessionInputTarget,
} from "./persistSessionHelpers";

const ts = "2026-04-19T12:00:00.000Z";

const ev = (over: Partial<KeystrokeEventDto>): KeystrokeEventDto => ({
  targetChar: over.targetChar ?? "a",
  actualChar: over.actualChar ?? (over.isError === true ? "x" : (over.targetChar ?? "a")),
  isError:
    over.isError ?? (over.actualChar !== undefined && over.actualChar !== (over.targetChar ?? "a")),
  keystrokeMs: over.keystrokeMs ?? 180,
  prevChar: over.prevChar,
  timestamp: over.timestamp ?? ts,
});

const validUuid = "11111111-2222-3333-4444-555555555555";
const otherUuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const validInput = (over: Partial<PersistSessionInput> = {}): unknown => ({
  sessionId: over.sessionId ?? validUuid,
  keyboardProfileId: over.keyboardProfileId ?? otherUuid,
  mode: over.mode ?? "adaptive",
  target: over.target ?? "ab",
  events: over.events ?? [],
  startedAt: over.startedAt ?? ts,
  endedAt: over.endedAt ?? ts,
  phase: over.phase ?? "transitioning",
  filterConfig: over.filterConfig ?? {},
});

describe("validatePersistSessionInput — happy path", () => {
  it("passes a minimal valid payload", () => {
    const out = validatePersistSessionInput(validInput());
    expect(out.sessionId).toBe(validUuid);
    expect(out.mode).toBe("adaptive");
    expect(out.phase).toBe("transitioning");
    expect(out.events).toEqual([]);
  });

  it("passes targeted_drill mode", () => {
    const out = validatePersistSessionInput(validInput({ mode: "targeted_drill" }));
    expect(out.mode).toBe("targeted_drill");
  });

  it("passes refining phase", () => {
    const out = validatePersistSessionInput(validInput({ phase: "refining" }));
    expect(out.phase).toBe("refining");
  });
});

describe("validatePersistSessionInput — rejections", () => {
  it("rejects non-object input", () => {
    expect(() => validatePersistSessionInput(null)).toThrow();
    expect(() => validatePersistSessionInput("x")).toThrow();
  });

  it("rejects a non-UUID sessionId", () => {
    expect(() => validatePersistSessionInput(validInput({ sessionId: "nope" }))).toThrow(
      /sessionId/,
    );
  });

  it("rejects unknown mode", () => {
    expect(() =>
      validatePersistSessionInput({
        ...(validInput() as object),
        mode: "bogus",
      }),
    ).toThrow(/mode/);
  });

  it("rejects unknown phase", () => {
    expect(() =>
      validatePersistSessionInput({
        ...(validInput() as object),
        phase: "idle",
      }),
    ).toThrow(/phase/);
  });

  it("rejects non-ISO startedAt", () => {
    expect(() => validatePersistSessionInput(validInput({ startedAt: "tomorrow" }))).toThrow(
      /startedAt/,
    );
  });

  it("rejects malformed events", () => {
    expect(() =>
      validatePersistSessionInput({
        ...(validInput() as object),
        events: [{ targetChar: "a" }], // missing fields
      }),
    ).toThrow(/event 0/);
  });

  it("rejects non-array events", () => {
    expect(() =>
      validatePersistSessionInput({
        ...(validInput() as object),
        events: "not an array",
      }),
    ).toThrow(/events/);
  });
});

describe("enrichEvents — positionInWord", () => {
  it("starts at 0 and advances one per correct keystroke", () => {
    // target "abc"
    const enriched = enrichEvents(
      [ev({ targetChar: "a" }), ev({ targetChar: "b" }), ev({ targetChar: "c" })],
      "abc",
    );
    expect(enriched.map((e) => e.positionInWord)).toEqual([0, 1, 2]);
  });

  it("resets after a space", () => {
    // target "ab cd"
    const enriched = enrichEvents(
      [
        ev({ targetChar: "a" }),
        ev({ targetChar: "b" }),
        ev({ targetChar: " " }),
        ev({ targetChar: "c" }),
        ev({ targetChar: "d" }),
      ],
      "ab cd",
    );
    expect(enriched.map((e) => e.positionInWord)).toEqual([0, 1, 2, 0, 1]);
  });

  it("holds position on an error and marks the retry as isRetype=true", () => {
    // target "ab", user: a (correct) → b (wrong) → b (correct)
    const enriched = enrichEvents(
      [
        ev({ targetChar: "a" }),
        ev({ targetChar: "b", actualChar: "v", isError: true }),
        ev({ targetChar: "b" }),
      ],
      "ab",
    );
    expect(enriched.map((e) => e.positionInWord)).toEqual([0, 1, 1]);
    expect(enriched.map((e) => e.isRetype)).toEqual([false, false, true]);
  });

  it("chains multiple retypes", () => {
    // user mistypes pos 0 twice then succeeds
    const enriched = enrichEvents(
      [
        ev({ targetChar: "a", actualChar: "q", isError: true }),
        ev({ targetChar: "a", actualChar: "w", isError: true }),
        ev({ targetChar: "a" }),
      ],
      "a",
    );
    expect(enriched.map((e) => e.isRetype)).toEqual([false, true, true]);
  });
});

describe("enrichEvents — sequence numbering", () => {
  it("numbers events 0..N-1 in input order", () => {
    const enriched = enrichEvents(
      [ev({ targetChar: "a" }), ev({ targetChar: "b" }), ev({ targetChar: "c" })],
      "abc",
    );
    expect(enriched.map((e) => e.sequence)).toEqual([0, 1, 2]);
  });
});

describe("deriveSessionHeader", () => {
  it("computes totals and 100% accuracy for a clean run", () => {
    const events = Array.from({ length: 10 }, () => ev({ targetChar: "a" }));
    const h = deriveSessionHeader({
      events,
      startedAt: "2026-04-19T12:00:00.000Z",
      endedAt: "2026-04-19T12:00:10.000Z",
    });
    expect(h.totalChars).toBe(10);
    expect(h.totalErrors).toBe(0);
    expect(h.accuracy).toBe(1);
    expect(h.elapsedMs).toBe(10_000);
  });

  it("reports partial accuracy when some events error", () => {
    const events = [
      ev({ targetChar: "a" }),
      ev({ targetChar: "b", actualChar: "v", isError: true }),
      ev({ targetChar: "b" }),
      ev({ targetChar: "c" }),
    ];
    const h = deriveSessionHeader({
      events,
      startedAt: "2026-04-19T12:00:00.000Z",
      endedAt: "2026-04-19T12:00:05.000Z",
    });
    expect(h.totalErrors).toBe(1);
    expect(h.accuracy).toBeCloseTo(0.75);
  });

  it("reports 0 WPM when elapsed is below the 2s noise threshold", () => {
    const events = Array.from({ length: 20 }, () => ev({ targetChar: "a" }));
    const h = deriveSessionHeader({
      events,
      startedAt: "2026-04-19T12:00:00.000Z",
      endedAt: "2026-04-19T12:00:01.500Z",
    });
    expect(h.wpm).toBe(0);
  });

  it("computes WPM from correct keystrokes only", () => {
    // 50 correct in 60s = 10 WPM
    const events = [
      ...Array.from({ length: 50 }, () => ev({ targetChar: "a" })),
      ...Array.from({ length: 10 }, () => ev({ targetChar: "b", actualChar: "v", isError: true })),
    ];
    const h = deriveSessionHeader({
      events,
      startedAt: "2026-04-19T12:00:00.000Z",
      endedAt: "2026-04-19T12:01:00.000Z",
    });
    expect(Math.round(h.wpm)).toBe(10);
  });

  it("returns 100% accuracy for empty event list", () => {
    const h = deriveSessionHeader({
      events: [],
      startedAt: "2026-04-19T12:00:00.000Z",
      endedAt: "2026-04-19T12:00:00.000Z",
    });
    expect(h.accuracy).toBe(1);
    expect(h.totalChars).toBe(0);
    expect(h.wpm).toBe(0);
  });
});

describe("toDomainEvents", () => {
  it("turns ISO timestamps back into Date objects", () => {
    const [out] = toDomainEvents([ev({ targetChar: "a", timestamp: ts })]);
    expect(out!.timestamp).toBeInstanceOf(Date);
    expect(out!.timestamp.toISOString()).toBe(ts);
  });
});

// --- sessionTarget validator (ADR-003 §5) ------------------------------------

const validTarget = (over: Partial<PersistSessionInputTarget> = {}): PersistSessionInputTarget => ({
  type: over.type ?? "character",
  value: over.value ?? "b",
  keys: over.keys ?? ["KeyB"],
  label: over.label ?? "b — right index",
  selectionScore: over.selectionScore !== undefined ? over.selectionScore : 0.72,
  declaredAt: over.declaredAt ?? ts,
  attempts: over.attempts !== undefined ? over.attempts : 14,
  errors: over.errors !== undefined ? over.errors : 3,
  accuracy: over.accuracy !== undefined ? over.accuracy : 0.85,
});

describe("validatePersistSessionInput — sessionTarget (ADR-003 §5)", () => {
  it("without sessionTarget — result omits the field", () => {
    const out = validatePersistSessionInput(validInput());
    expect(out.sessionTarget).toBeUndefined();
  });

  it("with full sessionTarget — result includes all fields exactly", () => {
    const st = validTarget();
    const out = validatePersistSessionInput({ ...(validInput() as object), sessionTarget: st });
    expect(out.sessionTarget).toEqual(st);
  });

  it("with partial sessionTarget (nulls) — preserves nulls on nullable fields", () => {
    const st = validTarget({ selectionScore: null, attempts: null, errors: null, accuracy: null });
    const out = validatePersistSessionInput({ ...(validInput() as object), sessionTarget: st });
    expect(out.sessionTarget?.selectionScore).toBeNull();
    expect(out.sessionTarget?.attempts).toBeNull();
    expect(out.sessionTarget?.errors).toBeNull();
    expect(out.sessionTarget?.accuracy).toBeNull();
  });

  it("with empty keys array — accepted (diagnostic targets may have no key binding)", () => {
    const st = validTarget({ keys: [] });
    const out = validatePersistSessionInput({ ...(validInput() as object), sessionTarget: st });
    expect(out.sessionTarget?.keys).toEqual([]);
  });

  it("rejects non-object sessionTarget", () => {
    expect(() =>
      validatePersistSessionInput({ ...(validInput() as object), sessionTarget: "b" }),
    ).toThrow(/sessionTarget/);
    expect(() =>
      validatePersistSessionInput({ ...(validInput() as object), sessionTarget: 42 }),
    ).toThrow(/sessionTarget/);
  });

  it("rejects missing or empty type", () => {
    expect(() =>
      validatePersistSessionInput({
        ...(validInput() as object),
        sessionTarget: { ...validTarget(), type: "" },
      }),
    ).toThrow(/sessionTarget\.type/);
    expect(() =>
      validatePersistSessionInput({
        ...(validInput() as object),
        sessionTarget: { ...validTarget(), type: undefined },
      }),
    ).toThrow(/sessionTarget\.type/);
  });

  it("rejects missing or empty value", () => {
    expect(() =>
      validatePersistSessionInput({
        ...(validInput() as object),
        sessionTarget: { ...validTarget(), value: "" },
      }),
    ).toThrow(/sessionTarget\.value/);
  });

  it("rejects missing or empty label", () => {
    expect(() =>
      validatePersistSessionInput({
        ...(validInput() as object),
        sessionTarget: { ...validTarget(), label: "" },
      }),
    ).toThrow(/sessionTarget\.label/);
  });

  it("rejects non-array keys", () => {
    expect(() =>
      validatePersistSessionInput({
        ...(validInput() as object),
        sessionTarget: { ...validTarget(), keys: "KeyB" },
      }),
    ).toThrow(/sessionTarget\.keys/);
  });

  it("rejects keys array containing non-strings", () => {
    expect(() =>
      validatePersistSessionInput({
        ...(validInput() as object),
        sessionTarget: { ...validTarget(), keys: ["KeyB", 42] },
      }),
    ).toThrow(/sessionTarget\.keys/);
  });

  it("rejects non-ISO declaredAt", () => {
    expect(() =>
      validatePersistSessionInput({
        ...(validInput() as object),
        sessionTarget: { ...validTarget(), declaredAt: "not-a-date" },
      }),
    ).toThrow(/sessionTarget\.declaredAt/);
  });

  it("rejects non-number selectionScore (when not null)", () => {
    expect(() =>
      validatePersistSessionInput({
        ...(validInput() as object),
        sessionTarget: { ...validTarget(), selectionScore: "high" },
      }),
    ).toThrow(/sessionTarget\.selectionScore/);
  });

  it("rejects non-number attempts (when not null)", () => {
    expect(() =>
      validatePersistSessionInput({
        ...(validInput() as object),
        sessionTarget: { ...validTarget(), attempts: "many" },
      }),
    ).toThrow(/sessionTarget\.attempts/);
  });
});
