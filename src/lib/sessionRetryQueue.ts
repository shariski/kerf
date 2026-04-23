/**
 * Client-side retry queue for failed session persistence — Task 4.2.
 *
 * Why this exists
 *   `persistSession` is fire-and-forget (§2.8): a network blip or a
 *   500 on the way home would silently drop the session. That's the
 *   worst outcome for an adaptive engine — the user's weakness signal
 *   gets a hole. This queue catches those failures in localStorage
 *   and replays them on next app load.
 *
 * Safety by construction
 *   `persistSession` already uses a client-generated UUID + ON CONFLICT
 *   DO NOTHING on `sessions.id`. Replaying a queued payload against a
 *   server that already processed it is a no-op — we don't need a
 *   dedicated "did this land?" check.
 *
 * Bounded growth
 *   Queue is capped at MAX_QUEUE_SIZE with oldest-first eviction. A
 *   user offline for weeks would otherwise accumulate forever; the most
 *   recent sessions carry more diagnostic value than the oldest.
 *
 * Resilience
 *   localStorage can be absent (SSR), disabled (Safari private),
 *   corrupt, or full. Every path swallows and degrades rather than
 *   crashing the route — losing a retry is strictly better than losing
 *   the summary UI.
 */

import type { PersistSessionInput } from "#/server/persistSessionHelpers";

export const QUEUE_STORAGE_KEY = "kerf:pending-sessions";
export const MAX_QUEUE_SIZE = 10;

export type QueuedSession = {
  payload: PersistSessionInput;
  enqueuedAt: number;
};

function hasStorage(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage != null;
  } catch {
    return false;
  }
}

function writeQueue(queue: QueuedSession[]): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn("sessionRetryQueue: failed to write queue", err);
  }
}

export function readSessionQueue(): QueuedSession[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is QueuedSession =>
        typeof item === "object" &&
        item !== null &&
        "payload" in item &&
        "enqueuedAt" in item &&
        typeof (item as QueuedSession).enqueuedAt === "number" &&
        typeof (item as QueuedSession).payload?.sessionId === "string",
    );
  } catch {
    return [];
  }
}

export function enqueueSession(payload: PersistSessionInput): void {
  const current = readSessionQueue();
  const deduped = current.filter((q) => q.payload.sessionId !== payload.sessionId);
  deduped.push({ payload, enqueuedAt: Date.now() });
  const trimmed =
    deduped.length > MAX_QUEUE_SIZE ? deduped.slice(deduped.length - MAX_QUEUE_SIZE) : deduped;
  writeQueue(trimmed);
}

export function removeFromSessionQueue(sessionId: string): void {
  const current = readSessionQueue();
  const next = current.filter((q) => q.payload.sessionId !== sessionId);
  if (next.length === current.length) return;
  writeQueue(next);
}

export function clearSessionQueue(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(QUEUE_STORAGE_KEY);
  } catch {
    // storage unavailable — nothing to do
  }
}
