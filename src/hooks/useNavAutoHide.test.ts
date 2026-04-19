/** @vitest-environment jsdom */

/**
 * Interaction tests for the nav auto-hide hook. Uses vitest fake
 * timers to advance through the 1s hide window and the 3s pause-reveal
 * window without waiting.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sessionStore } from "#/stores/sessionStore";
import { useNavAutoHide } from "./useNavAutoHide";

function setStatus(status: "idle" | "active" | "complete") {
  sessionStore.setState((s) => ({ ...s, status }));
}

function typeKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  const ev = new KeyboardEvent("keydown", { key, bubbles: true, ...opts });
  window.dispatchEvent(ev);
}

function mouseTo(clientY: number) {
  const ev = new MouseEvent("mousemove", { bubbles: true, clientY });
  window.dispatchEvent(ev);
}

beforeEach(() => {
  vi.useFakeTimers();
  setStatus("idle");
});

afterEach(() => {
  setStatus("idle");
  vi.useRealTimers();
});

describe("useNavAutoHide — status gating", () => {
  it("stays visible when session is idle", () => {
    const { result } = renderHook(() => useNavAutoHide());
    expect(result.current.hidden).toBe(false);
    act(() => typeKey("a"));
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.hidden).toBe(false);
  });

  it("stays visible when session is complete", () => {
    const { result } = renderHook(() => useNavAutoHide());
    act(() => setStatus("complete"));
    act(() => typeKey("a"));
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.hidden).toBe(false);
  });

  it("snaps visible when status transitions from active back to idle", () => {
    const { result } = renderHook(() => useNavAutoHide());
    act(() => setStatus("active"));
    act(() => typeKey("a"));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.hidden).toBe(true);
    act(() => setStatus("idle"));
    expect(result.current.hidden).toBe(false);
  });
});

describe("useNavAutoHide — active typing", () => {
  beforeEach(() => {
    setStatus("active");
  });

  it("stays visible until the first keystroke", () => {
    const { result } = renderHook(() => useNavAutoHide());
    expect(result.current.hidden).toBe(false);
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.hidden).toBe(false);
  });

  it("hides 1s after the first keystroke", () => {
    const { result } = renderHook(() => useNavAutoHide());
    act(() => typeKey("a"));
    expect(result.current.hidden).toBe(false);
    act(() => vi.advanceTimersByTime(999));
    expect(result.current.hidden).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.hidden).toBe(true);
  });

  it("stays hidden as the user continues typing", () => {
    const { result } = renderHook(() => useNavAutoHide());
    act(() => typeKey("a"));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.hidden).toBe(true);
    // Keep typing every 500ms — nav stays hidden.
    for (let i = 0; i < 5; i++) {
      act(() => vi.advanceTimersByTime(500));
      act(() => typeKey("b"));
    }
    expect(result.current.hidden).toBe(true);
  });

  // Regression: an earlier debounced implementation cleared and
  // re-armed the hide timer on every keystroke, so rapid continuous
  // typing pushed hide indefinitely into the future and the nav never
  // disappeared. This lock-ins the "arm once, let it fire" behaviour.
  it("hides after 1s even during rapid continuous typing (no pause)", () => {
    const { result } = renderHook(() => useNavAutoHide());
    // Ten keystrokes, 100ms apart → 1s total, no gap long enough to be
    // a pause. In the buggy version, hide was always 1s in the future
    // so by t=1000 it had not yet fired.
    for (let i = 0; i < 10; i++) {
      act(() => typeKey("a"));
      act(() => vi.advanceTimersByTime(100));
    }
    expect(result.current.hidden).toBe(true);
  });

  // Regression: after a reveal (pause, Esc, mouse-top), resuming
  // typing must re-arm hide. Without clearing `hideArmed` on reveal,
  // the second-session / post-pause typing would stay visible forever.
  it("re-arms hide after a pause-reveal: nav hides 1s into the next typing burst", () => {
    const { result } = renderHook(() => useNavAutoHide());
    act(() => typeKey("a"));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.hidden).toBe(true);
    // 3s silence triggers the pause-reveal.
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.hidden).toBe(false);
    // Resume typing — hide must re-arm.
    act(() => typeKey("b"));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.hidden).toBe(true);
  });

  it("re-arms hide after an Esc reveal: nav hides 1s into the next typing burst", () => {
    const { result } = renderHook(() => useNavAutoHide());
    act(() => typeKey("a"));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.hidden).toBe(true);
    act(() => typeKey("Escape"));
    expect(result.current.hidden).toBe(false);
    act(() => typeKey("b"));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.hidden).toBe(true);
  });

  it("reveals after 3s without a keystroke (pause intent)", () => {
    const { result } = renderHook(() => useNavAutoHide());
    act(() => typeKey("a"));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.hidden).toBe(true);
    // Stop typing. Pause-reveal fires at 3s from the last keystroke.
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.hidden).toBe(false);
  });
});

describe("useNavAutoHide — reveal triggers while hidden", () => {
  beforeEach(() => {
    setStatus("active");
  });

  const hideNav = (result: { current: { hidden: boolean } }) => {
    act(() => typeKey("a"));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.hidden).toBe(true);
  };

  it("mouse near top edge reveals", () => {
    const { result } = renderHook(() => useNavAutoHide());
    hideNav(result);
    act(() => mouseTo(30));
    expect(result.current.hidden).toBe(false);
  });

  it("mouse below 60px does not reveal", () => {
    const { result } = renderHook(() => useNavAutoHide());
    hideNav(result);
    act(() => mouseTo(100));
    expect(result.current.hidden).toBe(true);
  });

  it("Escape reveals", () => {
    const { result } = renderHook(() => useNavAutoHide());
    hideNav(result);
    act(() => typeKey("Escape"));
    expect(result.current.hidden).toBe(false);
  });
});

describe("useNavAutoHide — keystroke filtering", () => {
  beforeEach(() => {
    setStatus("active");
  });

  it("ignores modifier chords", () => {
    const { result } = renderHook(() => useNavAutoHide());
    act(() => typeKey("l", { metaKey: true }));
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.hidden).toBe(false);
  });

  it("ignores non-printable keys like Shift / ArrowLeft", () => {
    const { result } = renderHook(() => useNavAutoHide());
    act(() => typeKey("Shift"));
    act(() => typeKey("ArrowLeft"));
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.hidden).toBe(false);
  });
});
