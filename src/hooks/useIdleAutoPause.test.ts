/** @vitest-environment jsdom */

/**
 * Tests for the idle auto-pause watchdog.
 *
 * Uses vitest fake timers + a stubbed `performance.now` so the test
 * controls "wall time" deterministically. Talks to the real session
 * store (the hook is a thin wrapper around it) rather than mocking —
 * the whole point of the hook is the coupling between idle detection
 * and the pause dispatch, so an integration-style test is the right
 * level of coverage here.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { sessionStore } from "#/stores/sessionStore";
import { IDLE_THRESHOLD_MS, useIdleAutoPause } from "./useIdleAutoPause";

describe("useIdleAutoPause", () => {
  let now = 0;
  beforeEach(() => {
    vi.useFakeTimers();
    now = 10_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    sessionStore.getState().dispatch({ type: "reset" });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    sessionStore.getState().dispatch({ type: "reset" });
  });

  function advance(ms: number) {
    now += ms;
    vi.advanceTimersByTime(ms);
  }

  it("pauses the session after the idle threshold elapses without input", () => {
    sessionStore.getState().dispatch({ type: "start", target: "hello", now, targetKeys: [] });
    sessionStore.getState().dispatch({ type: "keypress", char: "h", now });
    renderHook(() => useIdleAutoPause(true));

    expect(sessionStore.getState().status).toBe("active");
    // One threshold's worth + one tick to notice.
    advance(IDLE_THRESHOLD_MS + 500);

    const state = sessionStore.getState();
    expect(state.status).toBe("paused");
    // pausedAt is anchored to lastKeystrokeAt + threshold so the first
    // 2s of idle is charged as thinking time, not paused time.
    expect(state.pausedAt).toBe(state.lastKeystrokeAt! + IDLE_THRESHOLD_MS);
  });

  it("does not pause before the threshold", () => {
    sessionStore.getState().dispatch({ type: "start", target: "hello", now, targetKeys: [] });
    sessionStore.getState().dispatch({ type: "keypress", char: "h", now });
    renderHook(() => useIdleAutoPause(true));

    advance(IDLE_THRESHOLD_MS - 500);
    expect(sessionStore.getState().status).toBe("active");
  });

  it("does nothing before the first keystroke (clock unarmed)", () => {
    sessionStore.getState().dispatch({ type: "start", target: "hello", now, targetKeys: [] });
    renderHook(() => useIdleAutoPause(true));

    advance(IDLE_THRESHOLD_MS * 3);
    expect(sessionStore.getState().status).toBe("active");
    expect(sessionStore.getState().pausedAt).toBeNull();
  });

  it("is a no-op when disabled", () => {
    sessionStore.getState().dispatch({ type: "start", target: "hello", now, targetKeys: [] });
    sessionStore.getState().dispatch({ type: "keypress", char: "h", now });
    renderHook(() => useIdleAutoPause(false));

    advance(IDLE_THRESHOLD_MS * 3);
    expect(sessionStore.getState().status).toBe("active");
  });

  it("does not re-pause an already-paused session", () => {
    sessionStore.getState().dispatch({ type: "start", target: "hello", now, targetKeys: [] });
    sessionStore.getState().dispatch({ type: "keypress", char: "h", now });
    renderHook(() => useIdleAutoPause(true));

    advance(IDLE_THRESHOLD_MS + 500);
    const firstPausedAt = sessionStore.getState().pausedAt;

    // Another interval tick later — pausedAt must not shift forward.
    advance(1000);
    expect(sessionStore.getState().pausedAt).toBe(firstPausedAt);
  });

  it("resumes transparently when the user types again", () => {
    sessionStore.getState().dispatch({ type: "start", target: "hello", now, targetKeys: [] });
    sessionStore.getState().dispatch({ type: "keypress", char: "h", now });
    renderHook(() => useIdleAutoPause(true));

    advance(IDLE_THRESHOLD_MS + 500);
    expect(sessionStore.getState().status).toBe("paused");

    advance(3_000);
    sessionStore.getState().dispatch({ type: "keypress", char: "e", now });
    const state = sessionStore.getState();
    expect(state.status).toBe("active");
    // pausedMs should reflect the slice from pausedAt → now at keypress.
    expect(state.pausedMs).toBeGreaterThan(0);
  });
});
