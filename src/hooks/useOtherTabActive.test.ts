/** @vitest-environment jsdom */

/**
 * Cross-tab active-session detection tests.
 *
 * Two hook instances in the same test stand in for two tabs. Because
 * Node's BroadcastChannel is process-global, they talk to each other
 * the same way real tabs would via the browser's origin-scoped
 * channel.
 *
 * We assert the end-to-end observable: tab B learns that tab A is
 * active. The heartbeat / TTL internals are covered implicitly — if
 * the timing were wrong, the test would flake.
 */

import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useOtherTabActive } from "./useOtherTabActive";

describe("useOtherTabActive", () => {
  afterEach(() => {
    cleanup();
  });

  // Node's BroadcastChannel dispatches messages via MessagePort on the
  // macrotask queue. A microtask flush alone is not enough — we need a
  // real setImmediate-level yield for the peer to observe the message.
  async function flushChannel() {
    await act(async () => {
      await new Promise<void>((resolve) => setImmediate(resolve));
      await new Promise<void>((resolve) => setImmediate(resolve));
    });
  }

  it("tab B sees tab A's active session", async () => {
    const tabA = renderHook(() => useOtherTabActive(true));
    const tabB = renderHook(() => useOtherTabActive(false));
    await flushChannel();
    expect(tabB.result.current).toBe(true);
    // Tab A is its own active source, not 'other' — should stay false
    // for A's own hook. The hook ignores echoes of its own tabId.
    expect(tabA.result.current).toBe(false);
  });

  it("tab B goes back to inactive after tab A ends the session", async () => {
    const tabA = renderHook(({ active }: { active: boolean }) => useOtherTabActive(active), {
      initialProps: { active: true },
    });
    const tabB = renderHook(() => useOtherTabActive(false));
    await flushChannel();
    expect(tabB.result.current).toBe(true);

    tabA.rerender({ active: false });
    await flushChannel();
    expect(tabB.result.current).toBe(false);
  });

  it("tab B goes back to inactive after tab A unmounts", async () => {
    const tabA = renderHook(() => useOtherTabActive(true));
    const tabB = renderHook(() => useOtherTabActive(false));
    await flushChannel();
    expect(tabB.result.current).toBe(true);

    tabA.unmount();
    await flushChannel();
    expect(tabB.result.current).toBe(false);
  });

  it("a late-mounting tab B learns tab A is already active via ping/pong", async () => {
    // Tab A started first. Tab B arrives later and needs to discover
    // A's state. The hook handles this by broadcasting a ping on mount
    // that active tabs respond to.
    const tabA = renderHook(() => useOtherTabActive(true));
    await flushChannel();
    const tabB = renderHook(() => useOtherTabActive(false));
    await flushChannel();
    expect(tabB.result.current).toBe(true);
    tabA.unmount();
  });
});
