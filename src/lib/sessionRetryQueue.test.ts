/** @vitest-environment jsdom */

/**
 * Tests for the local session retry queue.
 *
 * Stores a FIFO of failed persistSession payloads in localStorage keyed
 * by `kerf:pending-sessions`. These tests lock down the invariants that
 * make retry safe — idempotent dedup by sessionId, bounded size,
 * graceful handling when localStorage throws (Safari private mode,
 * quota exceeded, schema corruption).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PersistSessionInput } from "#/server/persistSessionHelpers";
import {
  MAX_QUEUE_SIZE,
  QUEUE_STORAGE_KEY,
  clearSessionQueue,
  enqueueSession,
  readSessionQueue,
  removeFromSessionQueue,
} from "./sessionRetryQueue";

function makePayload(sessionId = "11111111-1111-4111-8111-111111111111"): PersistSessionInput {
  return {
    sessionId,
    keyboardProfileId: "22222222-2222-4222-8222-222222222222",
    mode: "adaptive",
    target: "hello world",
    events: [],
    startedAt: "2026-04-21T12:00:00.000Z",
    endedAt: "2026-04-21T12:00:30.000Z",
    phase: "transitioning",
    filterConfig: { handIsolation: "either" },
  };
}

describe("sessionRetryQueue", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("enqueues and reads back a payload", () => {
    enqueueSession(makePayload());
    const queue = readSessionQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]!.payload.sessionId).toBe("11111111-1111-4111-8111-111111111111");
    expect(queue[0]!.enqueuedAt).toBeGreaterThan(0);
  });

  it("preserves FIFO order across multiple enqueues", () => {
    enqueueSession(makePayload("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
    enqueueSession(makePayload("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"));
    enqueueSession(makePayload("cccccccc-cccc-4ccc-8ccc-cccccccccccc"));
    const ids = readSessionQueue().map((q) => q.payload.sessionId);
    expect(ids).toEqual([
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    ]);
  });

  it("dedupes on sessionId — enqueueing the same id twice keeps one entry", () => {
    // Critical: persistSession's idempotent ON CONFLICT DO NOTHING means
    // a double-enqueue is safe server-side, but storing two client-side
    // queue entries for the same id would waste retry cycles.
    enqueueSession(makePayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd"));
    enqueueSession(makePayload("dddddddd-dddd-4ddd-8ddd-dddddddddddd"));
    expect(readSessionQueue()).toHaveLength(1);
  });

  it("caps queue at MAX_QUEUE_SIZE, dropping oldest", () => {
    // Oldest-first eviction protects against unbounded localStorage
    // growth on a user who's been offline for days. Recent sessions are
    // more useful diagnostic signal than week-old ones.
    for (let i = 0; i < MAX_QUEUE_SIZE + 3; i++) {
      enqueueSession(makePayload(`${i.toString().padStart(8, "0")}-0000-4000-8000-000000000000`));
    }
    const queue = readSessionQueue();
    expect(queue).toHaveLength(MAX_QUEUE_SIZE);
    // First surviving entry should be the 4th we enqueued (indices 3..12
    // survived; 0,1,2 were evicted).
    expect(queue[0]!.payload.sessionId).toBe("00000003-0000-4000-8000-000000000000");
  });

  it("removes a specific session by id", () => {
    enqueueSession(makePayload("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
    enqueueSession(makePayload("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"));
    removeFromSessionQueue("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    const queue = readSessionQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]!.payload.sessionId).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });

  it("removeFromSessionQueue is a no-op for unknown ids", () => {
    enqueueSession(makePayload());
    removeFromSessionQueue("ffffffff-ffff-4fff-8fff-ffffffffffff");
    expect(readSessionQueue()).toHaveLength(1);
  });

  it("clearSessionQueue empties the queue", () => {
    enqueueSession(makePayload());
    clearSessionQueue();
    expect(readSessionQueue()).toEqual([]);
  });

  it("readSessionQueue returns empty array when storage is empty", () => {
    expect(readSessionQueue()).toEqual([]);
  });

  it("readSessionQueue recovers gracefully from corrupt JSON", () => {
    // A prior app version or a user fiddling with devtools could leave
    // garbage here. Must not throw — silently reset and return empty.
    localStorage.setItem(QUEUE_STORAGE_KEY, "{not json");
    expect(readSessionQueue()).toEqual([]);
  });

  it("readSessionQueue returns empty array for non-array JSON", () => {
    localStorage.setItem(QUEUE_STORAGE_KEY, '{"nope":true}');
    expect(readSessionQueue()).toEqual([]);
  });

  it("enqueueSession is a no-op when localStorage.setItem throws", () => {
    // Quota exceeded / Safari private mode. Losing a retry is worse
    // than crashing the route, so swallow and log.
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => enqueueSession(makePayload())).not.toThrow();
    spy.mockRestore();
    // Nothing made it in.
    expect(readSessionQueue()).toEqual([]);
  });
});
