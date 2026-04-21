/**
 * Cross-tab session detection — Task 4.2.
 *
 * Two tabs of the same user running /practice at once is a minor mess:
 * both Zustand stores collect keystrokes independently and both persist
 * as separate sessions. Nothing breaks (the idempotent sessionId keeps
 * DB state sane) but it fragments the weakness signal and confuses the
 * user.
 *
 * This hook provides a soft guard. Every tab announces whether its
 * session is active over a shared BroadcastChannel. Tabs that learn
 * someone else is active flip `otherTabActive=true`, which the route
 * surfaces as a banner with a "continue anyway" affordance. No hard
 * lock — the user may have genuinely abandoned the other tab.
 *
 * Protocol
 *   - Each tab picks a random tabId on mount.
 *   - When isActive=true, the tab broadcasts `{type:"active", tabId}`
 *     on mount and on a heartbeat interval.
 *   - When isActive flips to false or the tab unmounts, it broadcasts
 *     `{type:"ended", tabId}`.
 *   - On mount, any tab broadcasts a `{type:"ping"}`. Active tabs
 *     reply with their own `{type:"active"}` so late-mounting tabs
 *     immediately learn of ongoing sessions.
 *   - Peers are tracked with a TTL; missed heartbeats for longer than
 *     `PEER_TTL_MS` expire the peer (covers crashed / force-closed tabs).
 */

import { useEffect, useRef, useState } from "react";

const CHANNEL_NAME = "kerf-session";
const HEARTBEAT_MS = 3000;
const PEER_TTL_MS = 10_000;

type Message =
  | { type: "active"; tabId: string }
  | { type: "ended"; tabId: string }
  | { type: "ping"; tabId: string };

export function useOtherTabActive(isActive: boolean): boolean {
  const [otherTabActive, setOtherTabActive] = useState(false);
  const tabIdRef = useRef<string>("");
  if (tabIdRef.current === "") {
    tabIdRef.current =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `t-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  }

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const mine = tabIdRef.current;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    const peers = new Map<string, number>(); // tabId → last seen (ms epoch)

    function recompute() {
      const now = Date.now();
      let anyActive = false;
      for (const [id, seen] of peers) {
        if (now - seen > PEER_TTL_MS) {
          peers.delete(id);
          continue;
        }
        anyActive = true;
      }
      setOtherTabActive(anyActive);
    }

    function onMessage(event: MessageEvent<Message>) {
      const msg = event.data;
      if (!msg || msg.tabId === mine) return;
      if (msg.type === "active") {
        peers.set(msg.tabId, Date.now());
      } else if (msg.type === "ended") {
        peers.delete(msg.tabId);
      } else if (msg.type === "ping") {
        // Reply with our current state so the newcomer learns about us.
        if (isActive) {
          channel.postMessage({ type: "active", tabId: mine } satisfies Message);
        }
      }
      recompute();
    }
    channel.addEventListener("message", onMessage);

    // Ask who else is out there.
    channel.postMessage({ type: "ping", tabId: mine } satisfies Message);

    // Announce our own state, start heartbeat if active.
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    if (isActive) {
      channel.postMessage({ type: "active", tabId: mine } satisfies Message);
      heartbeat = setInterval(() => {
        channel.postMessage({ type: "active", tabId: mine } satisfies Message);
        recompute();
      }, HEARTBEAT_MS);
    }

    return () => {
      if (heartbeat !== null) clearInterval(heartbeat);
      channel.postMessage({ type: "ended", tabId: mine } satisfies Message);
      channel.removeEventListener("message", onMessage);
      channel.close();
    };
  }, [isActive]);

  return otherTabActive;
}
