/** @vitest-environment jsdom */

/**
 * Tests for the persistSession retry wrapper + flush.
 *
 * The wrapper is a thin decorator around the real server fn:
 *   - success  → nothing queued
 *   - failure  → payload enqueued for later retry
 *   - flush    → retries every queued payload, removing on success
 *
 * The server fn is mocked at module boundary (vi.mock on the server
 * module). We're not testing `persistSession` itself — its contract
 * (idempotent ON CONFLICT DO NOTHING) is covered by
 * `persistSessionHelpers.test.ts` and integration tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PersistSessionInput } from "#/server/persistSessionHelpers";

const persistSessionMock = vi.fn();
vi.mock("#/server/persistSession", () => ({
  persistSession: (args: { data: PersistSessionInput }) =>
    persistSessionMock(args),
}));

import {
  flushSessionQueue,
  persistSessionWithRetry,
} from "./persistSessionWithRetry";
import { readSessionQueue } from "./sessionRetryQueue";

function makePayload(
  sessionId = "11111111-1111-4111-8111-111111111111",
): PersistSessionInput {
  return {
    sessionId,
    keyboardProfileId: "22222222-2222-4222-8222-222222222222",
    mode: "adaptive",
    target: "hello",
    events: [],
    startedAt: "2026-04-21T12:00:00.000Z",
    endedAt: "2026-04-21T12:00:10.000Z",
    phase: "transitioning",
    filterConfig: {},
  };
}

describe("persistSessionWithRetry", () => {
  beforeEach(() => {
    localStorage.clear();
    persistSessionMock.mockReset();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("does not enqueue on success", async () => {
    persistSessionMock.mockResolvedValueOnce({ sessionId: "ok" });
    await persistSessionWithRetry(makePayload());
    expect(readSessionQueue()).toHaveLength(0);
  });

  it("enqueues the payload on rejection and never throws", async () => {
    persistSessionMock.mockRejectedValueOnce(new Error("network down"));
    const payload = makePayload();
    await expect(persistSessionWithRetry(payload)).resolves.toBeUndefined();
    const queue = readSessionQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]!.payload.sessionId).toBe(payload.sessionId);
  });

  it("flush sends every queued payload and removes successes", async () => {
    // Seed the queue directly — simulates a prior-session retry backlog.
    persistSessionMock.mockRejectedValue(new Error("offline"));
    await persistSessionWithRetry(makePayload("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
    await persistSessionWithRetry(makePayload("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"));
    expect(readSessionQueue()).toHaveLength(2);

    persistSessionMock.mockReset();
    persistSessionMock.mockResolvedValue({ sessionId: "ok" });
    await flushSessionQueue();

    expect(persistSessionMock).toHaveBeenCalledTimes(2);
    expect(readSessionQueue()).toHaveLength(0);
  });

  it("flush leaves still-failing payloads in the queue", async () => {
    persistSessionMock.mockRejectedValue(new Error("offline"));
    await persistSessionWithRetry(makePayload("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
    await persistSessionWithRetry(makePayload("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"));
    expect(readSessionQueue()).toHaveLength(2);

    persistSessionMock.mockReset();
    persistSessionMock
      .mockResolvedValueOnce({ sessionId: "ok" }) // first succeeds
      .mockRejectedValueOnce(new Error("still offline")); // second fails

    await flushSessionQueue();

    const remaining = readSessionQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.payload.sessionId).toBe(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
  });

  it("flush is a no-op when the queue is empty", async () => {
    persistSessionMock.mockResolvedValue({ sessionId: "never called" });
    await flushSessionQueue();
    expect(persistSessionMock).not.toHaveBeenCalled();
  });

  it("concurrent flushes don't double-submit", async () => {
    // Without guard, two overlapping flushes could each send every
    // queued payload — not incorrect (persistSession is idempotent) but
    // wasteful. Guard by in-flight flag.
    persistSessionMock.mockRejectedValueOnce(new Error("offline"));
    await persistSessionWithRetry(makePayload());
    expect(readSessionQueue()).toHaveLength(1);

    persistSessionMock.mockClear();
    let resolvePending!: (v: { sessionId: string }) => void;
    const pending = new Promise<{ sessionId: string }>((r) => {
      resolvePending = r;
    });
    persistSessionMock.mockImplementation(() => pending);

    const first = flushSessionQueue();
    const second = flushSessionQueue();
    resolvePending({ sessionId: "ok" });
    await Promise.all([first, second]);
    expect(persistSessionMock).toHaveBeenCalledTimes(1);
  });
});
