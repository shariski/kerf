/** @vitest-environment jsdom */

/**
 * beforeunload warning hook tests.
 *
 * The hook attaches a `beforeunload` listener while `enabled=true` and
 * removes it otherwise. Modern browsers honor the warning only if the
 * event's default is prevented (and the tab has had user interaction).
 * We test the contract — registered ↔ `enabled` toggle — not the
 * browser UI, which jsdom doesn't render.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useBeforeUnloadWarning } from "./useBeforeUnloadWarning";

function fireBeforeUnload(): BeforeUnloadEvent {
  const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
  // jsdom doesn't add returnValue property to Event; patch it so the
  // handler can set it without crashing.
  Object.defineProperty(event, "returnValue", {
    writable: true,
    value: "",
  });
  window.dispatchEvent(event);
  return event;
}

describe("useBeforeUnloadWarning", () => {
  afterEach(() => {
    // Each renderHook mounts a long-lived effect; without explicit
    // cleanup the beforeunload listener from test N leaks into test N+1.
    cleanup();
  });

  it("prevents default and sets returnValue when enabled", () => {
    renderHook(() => useBeforeUnloadWarning(true));
    const event = fireBeforeUnload();
    expect(event.defaultPrevented).toBe(true);
    expect(event.returnValue).not.toBe("");
  });

  it("does nothing when disabled", () => {
    renderHook(() => useBeforeUnloadWarning(false));
    const event = fireBeforeUnload();
    expect(event.defaultPrevented).toBe(false);
    expect(event.returnValue).toBe("");
  });

  it("detaches the listener on unmount", () => {
    const { unmount } = renderHook(() => useBeforeUnloadWarning(true));
    unmount();
    const event = fireBeforeUnload();
    expect(event.defaultPrevented).toBe(false);
  });

  it("attaches when enabled flips from false to true", () => {
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useBeforeUnloadWarning(enabled),
      { initialProps: { enabled: false } },
    );
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
    rerender({ enabled: true });
    expect(fireBeforeUnload().defaultPrevented).toBe(true);
  });
});
