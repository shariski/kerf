import { describe, expect, it } from "vitest";
import { keystrokeReducer } from "./keystrokeReducer";
import { idleSessionState, type SessionState } from "./types";

const start = (target: string, now = 1000): SessionState =>
  keystrokeReducer(idleSessionState(), { type: "start", target, now });

const type = (s: SessionState, chars: string, from = 1000, stepMs = 100) => {
  let state = s;
  for (let i = 0; i < chars.length; i++) {
    state = keystrokeReducer(state, {
      type: "keypress",
      char: chars[i]!,
      now: from + (i + 1) * stepMs,
    });
  }
  return state;
};

describe("keystrokeReducer — start", () => {
  it("initializes target, zeros position, sets status=active, leaves clock unarmed", () => {
    const s = start("hello", 1000);
    expect(s.target).toBe("hello");
    expect(s.position).toBe(0);
    expect(s.charStatus).toEqual(["pending", "pending", "pending", "pending", "pending"]);
    expect(s.status).toBe("active");
    // startedAt / lastKeystrokeAt stay null until the first real keystroke
    // lands — Monkeytype-style. Idle time between start-dispatch and first
    // keypress must not inflate elapsed.
    expect(s.startedAt).toBeNull();
    expect(s.lastKeystrokeAt).toBeNull();
    expect(s.events).toEqual([]);
    expect(s.activeError).toBeNull();
  });

  it("resets prior state when restarted", () => {
    let s = start("ab");
    s = keystrokeReducer(s, { type: "keypress", char: "a", now: 1100 });
    s = keystrokeReducer(s, { type: "start", target: "xy", now: 2000 });
    expect(s.target).toBe("xy");
    expect(s.position).toBe(0);
    expect(s.events).toHaveLength(0);
    expect(s.charStatus).toEqual(["pending", "pending"]);
    // Restart re-disarms the clock even if the previous session started it.
    expect(s.startedAt).toBeNull();
    expect(s.lastKeystrokeAt).toBeNull();
  });
});

describe("keystrokeReducer — first-keypress clock", () => {
  it("first correct keystroke sets startedAt to its own timestamp", () => {
    let s = start("abc", 1000);
    expect(s.startedAt).toBeNull();
    s = keystrokeReducer(s, { type: "keypress", char: "a", now: 5200 });
    // Timer armed at the first keystroke — 4.2s of idle before typing
    // does NOT count toward elapsed time.
    expect(s.startedAt).toBe(5200);
    expect(s.lastKeystrokeAt).toBe(5200);
  });

  it("first keystroke arms the clock even when it's an error", () => {
    let s = start("abc", 1000);
    s = keystrokeReducer(s, { type: "keypress", char: "x", now: 5200 });
    expect(s.startedAt).toBe(5200);
    expect(s.lastKeystrokeAt).toBe(5200);
    expect(s.activeError).toEqual({ expected: "a", actual: "x" });
  });

  it("subsequent keystrokes never overwrite startedAt", () => {
    let s = start("abc", 1000);
    s = keystrokeReducer(s, { type: "keypress", char: "a", now: 5200 });
    s = keystrokeReducer(s, { type: "keypress", char: "b", now: 5350 });
    s = keystrokeReducer(s, { type: "keypress", char: "c", now: 5500 });
    expect(s.startedAt).toBe(5200);
    expect(s.lastKeystrokeAt).toBe(5500);
  });

  it("backspace before first keystroke is a no-op and leaves clock unarmed", () => {
    let s = start("abc", 1000);
    s = keystrokeReducer(s, { type: "backspace" });
    expect(s.startedAt).toBeNull();
    expect(s.lastKeystrokeAt).toBeNull();
    expect(s.events).toEqual([]);
  });
});

describe("keystrokeReducer — correct keystroke", () => {
  it("advances position, marks char correct, records event", () => {
    let s = start("ab", 1000);
    s = keystrokeReducer(s, { type: "keypress", char: "a", now: 1100 });
    expect(s.position).toBe(1);
    expect(s.charStatus[0]).toBe("correct");
    expect(s.events).toHaveLength(1);
    expect(s.events[0]).toMatchObject({
      targetChar: "a",
      actualChar: "a",
      isError: false,
      // First keystroke has no "previous keystroke" to time against — the
      // clock only arms on this event, so per-char timing starts at 0.
      keystrokeMs: 0,
      prevChar: undefined,
    });
    expect(s.events[0]!.timestamp).toBeInstanceOf(Date);
    expect(s.events[0]!.timestamp.getTime()).toBe(1100);
  });

  it("computes keystrokeMs from previous keystroke (first is 0, clock not armed yet)", () => {
    let s = start("abc", 1000);
    s = keystrokeReducer(s, { type: "keypress", char: "a", now: 1150 });
    s = keystrokeReducer(s, { type: "keypress", char: "b", now: 1300 });
    expect(s.events[0]!.keystrokeMs).toBe(0);
    expect(s.events[1]!.keystrokeMs).toBe(150);
  });

  it("sets prevChar to the previous target char within a word", () => {
    const s = type(start("abc"), "abc");
    expect(s.events[1]!.prevChar).toBe("a");
    expect(s.events[2]!.prevChar).toBe("b");
  });

  it("resets prevChar to undefined after a space (word boundary)", () => {
    const s = type(start("a bc"), "a bc");
    // events[0] = 'a'   → prevChar undefined (first)
    // events[1] = ' '   → prevChar 'a'
    // events[2] = 'b'   → prevChar undefined (after space)
    // events[3] = 'c'   → prevChar 'b'
    expect(s.events[0]!.prevChar).toBeUndefined();
    expect(s.events[1]!.prevChar).toBe("a");
    expect(s.events[2]!.prevChar).toBeUndefined();
    expect(s.events[3]!.prevChar).toBe("b");
  });
});

describe("keystrokeReducer — error keystroke", () => {
  it("holds cursor, marks char error, records isError event, sets activeError", () => {
    let s = start("nice", 1000);
    s = keystrokeReducer(s, { type: "keypress", char: "b", now: 1100 });
    expect(s.position).toBe(0);
    expect(s.charStatus[0]).toBe("error");
    expect(s.activeError).toEqual({ expected: "n", actual: "b" });
    expect(s.events).toHaveLength(1);
    expect(s.events[0]).toMatchObject({
      targetChar: "n",
      actualChar: "b",
      isError: true,
      // First keystroke — no prior event to time against; 0 not 100.
      keystrokeMs: 0,
    });
  });

  it("records additional error events while activeError is set (cursor still stuck)", () => {
    let s = start("nice", 1000);
    s = keystrokeReducer(s, { type: "keypress", char: "b", now: 1100 });
    s = keystrokeReducer(s, { type: "keypress", char: "v", now: 1200 });
    expect(s.position).toBe(0);
    expect(s.events).toHaveLength(2);
    expect(s.events[1]).toMatchObject({ targetChar: "n", actualChar: "v", isError: true });
    expect(s.activeError).toEqual({ expected: "n", actual: "v" });
  });

  it("typing the correct letter while in error state does NOT advance (spec: must backspace)", () => {
    // See docs/01-product-spec.md §204 and 06-design-summary.md §324:
    // once an error is latched, only backspace clears it.
    let s = start("nice", 1000);
    s = keystrokeReducer(s, { type: "keypress", char: "b", now: 1100 });
    s = keystrokeReducer(s, { type: "keypress", char: "n", now: 1200 }); // correct letter
    expect(s.position).toBe(0);
    expect(s.charStatus[0]).toBe("error");
    expect(s.activeError).toEqual({ expected: "n", actual: "n" });
    expect(s.events).toHaveLength(2);
    expect(s.events[1]).toMatchObject({ targetChar: "n", actualChar: "n", isError: true });
  });
});

describe("keystrokeReducer — backspace", () => {
  it("clears activeError, reverts char status to pending, does not advance position", () => {
    let s = start("nice", 1000);
    s = keystrokeReducer(s, { type: "keypress", char: "b", now: 1100 });
    s = keystrokeReducer(s, { type: "backspace" });
    expect(s.activeError).toBeNull();
    expect(s.charStatus[0]).toBe("pending");
    expect(s.position).toBe(0);
    // No new event logged — backspace is not a target keystroke.
    expect(s.events).toHaveLength(1);
  });

  it("is a no-op when there is no activeError (deliberate-practice: no rewinding)", () => {
    let s = start("nice", 1000);
    s = keystrokeReducer(s, { type: "keypress", char: "n", now: 1100 });
    const before = s;
    s = keystrokeReducer(s, { type: "backspace" });
    expect(s).toEqual(before);
  });

  it("is a no-op when session is idle or complete", () => {
    const idle = idleSessionState();
    expect(keystrokeReducer(idle, { type: "backspace" })).toEqual(idle);
  });

  it("allows correct retype after backspace (subsequent correct keystroke advances)", () => {
    let s = start("nice", 1000);
    s = keystrokeReducer(s, { type: "keypress", char: "b", now: 1100 });
    s = keystrokeReducer(s, { type: "backspace" });
    s = keystrokeReducer(s, { type: "keypress", char: "n", now: 1200 });
    expect(s.position).toBe(1);
    expect(s.charStatus[0]).toBe("correct");
  });
});

describe("keystrokeReducer — session completion", () => {
  it("marks status=complete and sets completedAt when last char typed correctly", () => {
    const s = type(start("ab", 1000), "ab", 1000);
    expect(s.status).toBe("complete");
    expect(s.position).toBe(2);
    expect(s.completedAt).not.toBeNull();
    expect(s.completedAt).toBe(s.lastKeystrokeAt);
  });

  it("ignores further keypresses after completion", () => {
    let s = type(start("ab", 1000), "ab", 1000);
    const before = s;
    s = keystrokeReducer(s, { type: "keypress", char: "c", now: 9999 });
    expect(s).toEqual(before);
  });

  it("final char typed wrong does not complete session", () => {
    let s = start("ab", 1000);
    s = keystrokeReducer(s, { type: "keypress", char: "a", now: 1100 });
    s = keystrokeReducer(s, { type: "keypress", char: "c", now: 1200 });
    expect(s.status).toBe("active");
    expect(s.completedAt).toBeNull();
  });
});

describe("keystrokeReducer — idle behavior", () => {
  it("keypress on idle state is a no-op", () => {
    const idle = idleSessionState();
    const out = keystrokeReducer(idle, {
      type: "keypress",
      char: "a",
      now: 1000,
    });
    expect(out).toEqual(idle);
  });

  it("reset returns to idle", () => {
    let s = type(start("ab"), "a");
    s = keystrokeReducer(s, { type: "reset" });
    expect(s).toEqual(idleSessionState());
  });
});

describe("keystrokeReducer — purity", () => {
  it("does not mutate its input state", () => {
    const s0 = start("ab", 1000);
    const snapshot = JSON.stringify(s0);
    keystrokeReducer(s0, { type: "keypress", char: "a", now: 1100 });
    expect(JSON.stringify(s0)).toBe(snapshot);
  });
});

describe("keystrokeReducer — pause/resume", () => {
  it("pause is a no-op before the clock is armed", () => {
    // `start` sets status=active but leaves startedAt null until the
    // first keystroke. Pausing a session that has nothing to freeze
    // would just set pausedAt from a later keystroke, subtracting time
    // the user never actually spent typing.
    let s = start("hello", 1000);
    s = keystrokeReducer(s, { type: "pause", now: 1500 });
    expect(s.status).toBe("active");
    expect(s.pausedAt).toBeNull();
    expect(s.pausedMs).toBe(0);
  });

  it("pause freezes an armed session; resume accumulates pausedMs", () => {
    let s = start("hello", 1000);
    s = type(s, "he", 1000, 100); // startedAt=1100, lastKeystrokeAt=1200
    s = keystrokeReducer(s, { type: "pause", now: 1300 });
    expect(s.status).toBe("paused");
    expect(s.pausedAt).toBe(1300);

    s = keystrokeReducer(s, { type: "resume", now: 5300 });
    expect(s.status).toBe("active");
    expect(s.pausedAt).toBeNull();
    expect(s.pausedMs).toBe(4000);
  });

  it("pausedMs accumulates across multiple pause/resume cycles", () => {
    let s = start("hello", 1000);
    s = type(s, "he", 1000, 100);
    s = keystrokeReducer(s, { type: "pause", now: 1300 });
    s = keystrokeReducer(s, { type: "resume", now: 2300 }); // +1000ms
    s = keystrokeReducer(s, { type: "pause", now: 2500 });
    s = keystrokeReducer(s, { type: "resume", now: 4500 }); // +2000ms
    expect(s.pausedMs).toBe(3000);
    expect(s.status).toBe("active");
  });

  it("keypress while paused auto-resumes and processes the keystroke", () => {
    let s = start("hello", 1000);
    s = type(s, "he", 1000, 100);
    s = keystrokeReducer(s, { type: "pause", now: 1300 });
    // User returns after 4s and types the next correct char.
    s = keystrokeReducer(s, { type: "keypress", char: "l", now: 5300 });
    expect(s.status).toBe("active");
    expect(s.pausedAt).toBeNull();
    expect(s.pausedMs).toBe(4000);
    expect(s.position).toBe(3);
  });

  it("backspace while paused auto-resumes (treating input as activity)", () => {
    let s = start("hello", 1000);
    // Type 'h' then a wrong char 'x' to create an activeError.
    s = keystrokeReducer(s, { type: "keypress", char: "h", now: 1100 });
    s = keystrokeReducer(s, { type: "keypress", char: "x", now: 1200 });
    expect(s.activeError).not.toBeNull();
    // Pause, wait, then press backspace.
    s = keystrokeReducer(s, { type: "pause", now: 1300 });
    s = keystrokeReducer(s, { type: "backspace" });
    expect(s.status).toBe("active");
    expect(s.activeError).toBeNull();
  });

  it("resume is a no-op when not paused", () => {
    let s = start("hello", 1000);
    s = type(s, "he", 1000, 100);
    const before = { ...s };
    s = keystrokeReducer(s, { type: "resume", now: 9999 });
    expect(s).toEqual(before);
  });

  it("pause is a no-op once the session is complete", () => {
    let s = start("hi", 1000);
    s = type(s, "hi", 1000, 100);
    expect(s.status).toBe("complete");
    s = keystrokeReducer(s, { type: "pause", now: 2000 });
    expect(s.status).toBe("complete");
    expect(s.pausedAt).toBeNull();
  });

  it("start clears pause fields from a prior session", () => {
    let s = start("hello", 1000);
    s = type(s, "he", 1000, 100);
    s = keystrokeReducer(s, { type: "pause", now: 1300 });
    s = keystrokeReducer(s, { type: "resume", now: 2300 });
    expect(s.pausedMs).toBe(1000);
    s = keystrokeReducer(s, { type: "start", target: "xy", now: 3000 });
    expect(s.pausedMs).toBe(0);
    expect(s.pausedAt).toBeNull();
    expect(s.status).toBe("active");
  });
});
