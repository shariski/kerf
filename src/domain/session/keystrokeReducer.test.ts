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
  it("initializes target, zeros position, sets status=active, records startedAt", () => {
    const s = start("hello", 1000);
    expect(s.target).toBe("hello");
    expect(s.position).toBe(0);
    expect(s.charStatus).toEqual(["pending", "pending", "pending", "pending", "pending"]);
    expect(s.status).toBe("active");
    expect(s.startedAt).toBe(1000);
    expect(s.lastKeystrokeAt).toBe(1000);
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
      keystrokeMs: 100,
      prevChar: undefined,
    });
    expect(s.events[0]!.timestamp).toBeInstanceOf(Date);
    expect(s.events[0]!.timestamp.getTime()).toBe(1100);
  });

  it("computes keystrokeMs from previous event time (not startedAt)", () => {
    let s = start("abc", 1000);
    s = keystrokeReducer(s, { type: "keypress", char: "a", now: 1150 });
    s = keystrokeReducer(s, { type: "keypress", char: "b", now: 1300 });
    expect(s.events[0]!.keystrokeMs).toBe(150);
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
      keystrokeMs: 100,
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
