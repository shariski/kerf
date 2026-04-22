/**
 * Retry-aware wrapper around `persistSession` — Task 4.2.
 *
 * `persistSessionWithRetry(payload)`
 *   Fires the server fn. On rejection, enqueues the payload for later.
 *   Always resolves (never throws) — the practice route uses this from
 *   a post-complete effect where we want the summary UI to stand on its
 *   own regardless of network outcome.
 *
 * `flushSessionQueue()`
 *   Walks the localStorage queue, replays each entry, and removes the
 *   ones that succeed. Safe to call from multiple mount points (the
 *   dashboard, practice, and drill all call it on mount) — an in-flight
 *   guard coalesces concurrent invocations into a single pass.
 */

import { persistSession } from "#/server/persistSession";
import type { PersistSessionInput } from "#/server/persistSessionHelpers";
import {
  enqueueSession,
  readSessionQueue,
  removeFromSessionQueue,
} from "./sessionRetryQueue";

export async function persistSessionWithRetry(
  payload: PersistSessionInput,
): Promise<void> {
  try {
    await persistSession({ data: payload });
    // Network just worked — good moment to drain any backlog from
    // prior failures. Fire-and-forget; a failure here leaves things
    // queued for the next mount.
    void flushSessionQueue();
  } catch (err) {
    console.warn("persistSession failed, queueing for retry:", err);
    enqueueSession(payload);
  }
}

let flushInFlight: Promise<void> | null = null;

async function runFlush(): Promise<void> {
  const queue = readSessionQueue();
  for (const item of queue) {
    try {
      await persistSession({ data: item.payload });
      removeFromSessionQueue(item.payload.sessionId);
    } catch (err) {
      // Leave queued, stop the pass — a single failure usually
      // indicates the network is still down, so there's no point
      // hammering the rest of the queue this tick.
      console.warn("flushSessionQueue: retry failed, will try later", err);
      return;
    }
  }
}

export function flushSessionQueue(): Promise<void> {
  if (flushInFlight) return flushInFlight;
  const p = runFlush();
  flushInFlight = p;
  // `.finally` is a microtask — guaranteed to run *after* the outer
  // assignment above, so the empty-queue path can't clear the guard
  // before it was even set.
  p.finally(() => {
    flushInFlight = null;
  });
  return p;
}
