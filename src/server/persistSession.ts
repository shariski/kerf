import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import {
  bigramStats,
  characterStats,
  keyboardProfiles,
  keystrokeEvents,
  sessions,
  splitMetricsSnapshots,
} from "./db/schema";
import {
  deriveSessionHeader,
  enrichEvents,
  toDomainEvents,
  validatePersistSessionInput,
} from "./persistSessionHelpers";
import { computeStats } from "#/domain/stats/computeStats";
import {
  HESITATION_MULTIPLIER,
  PHASE_BASELINES,
} from "#/domain/stats/baselines";
import { computeSplitMetrics } from "#/domain/metrics/computeSplitMetrics";
import type { KeyboardLayout } from "#/domain/finger/types";

/**
 * Persist a completed practice or drill session to Postgres — Task 2.8.
 *
 * Contract
 *   - All-or-nothing transaction. If any of the five writes fails,
 *     everything rolls back (docs/03-task-breakdown.md §2.8 "Your
 *     scope" decision: stats without a session row is worse than no
 *     session at all).
 *   - Idempotent on `sessionId`. Client generates the UUID up front
 *     so a retry with the same id is a no-op via ON CONFLICT DO
 *     NOTHING. This handles the "user reloaded mid-persist" race
 *     without needing a dedicated sessions-retry table.
 *   - Fire-and-forget from the client's perspective — the practice
 *     routes do not await the promise. Errors surface as console
 *     logs server-side; the summary UI renders regardless.
 *
 * What lives where
 *   - Raw event stream → `keystroke_events`.
 *   - Per-user running totals → `character_stats` / `bigram_stats`
 *     UPSERT (additive aggregation). These are the engine's weakness
 *     signal — Phase 3 reads them directly.
 *   - One-shot split-keyboard metrics → `split_metrics_snapshots`.
 *   - The session header itself (wpm, accuracy, counts) → `sessions`.
 *
 * Out of scope (see §2.8 "Explicitly out of scope"): reading data
 * back, offline retry queue, sub-millisecond timestamps.
 */
export const persistSession = createServerFn({ method: "POST" })
  .inputValidator(validatePersistSessionInput)
  .handler(async ({ data }) => {
    const request = getRequest();
    const authSession = await auth.api.getSession({ headers: request.headers });
    if (!authSession) {
      throw new Error("persistSession: unauthorized");
    }
    const userId = authSession.user.id;

    // Fetch the profile to (a) confirm it belongs to this user and
    // (b) get the keyboard layout we need for split metrics. Doing
    // both in one query keeps the call chain short.
    const [profile] = await db
      .select({
        id: keyboardProfiles.id,
        keyboardType: keyboardProfiles.keyboardType,
      })
      .from(keyboardProfiles)
      .where(
        and(
          eq(keyboardProfiles.id, data.keyboardProfileId),
          eq(keyboardProfiles.userId, userId),
        ),
      )
      .limit(1);
    if (!profile) {
      throw new Error("persistSession: profile not found");
    }
    const layout = profile.keyboardType as KeyboardLayout;

    // --- derive ----------------------------------------------------------
    const header = deriveSessionHeader({
      events: data.events,
      startedAt: data.startedAt,
      endedAt: data.endedAt,
    });
    const enriched = enrichEvents(data.events, data.target);
    const domainEvents = toDomainEvents(data.events);
    const baseline = PHASE_BASELINES[data.phase];
    const stats = computeStats(domainEvents, {
      hesitationThresholdMs: HESITATION_MULTIPLIER * baseline.meanKeystrokeTime,
    });
    const splitMetrics = computeSplitMetrics(domainEvents, layout);

    // --- write -----------------------------------------------------------
    await db.transaction(async (tx) => {
      // 1. Session row. ON CONFLICT DO NOTHING — if the client retried
      // with the same UUID, skip the whole body.
      const inserted = await tx
        .insert(sessions)
        .values({
          id: data.sessionId,
          userId,
          keyboardProfileId: profile.id,
          mode: data.mode,
          phaseAtSession: data.phase,
          filterConfig: data.filterConfig,
          startedAt: new Date(data.startedAt),
          endedAt: new Date(data.endedAt),
          totalChars: header.totalChars,
          totalErrors: header.totalErrors,
          wpm: header.wpm,
          accuracy: header.accuracy,
        })
        .onConflictDoNothing({ target: sessions.id })
        .returning({ id: sessions.id });

      if (inserted.length === 0) {
        // Duplicate sessionId — idempotent no-op. The prior write owns
        // the stats rows, so don't double-count.
        return;
      }

      // 2. Keystroke events. Bulk insert in one round trip.
      // keystrokeMs is fractional (performance.now() is sub-ms) but the
      // schema stores it as integer — round at the DB boundary.
      if (enriched.length > 0) {
        await tx.insert(keystrokeEvents).values(
          enriched.map((e) => ({
            sessionId: data.sessionId,
            sequence: e.sequence,
            targetChar: e.targetChar,
            actualChar: e.actualChar,
            isError: e.isError,
            keystrokeMs: Math.round(e.keystrokeMs),
            prevChar: e.prevChar,
            positionInWord: e.positionInWord,
            isRetype: e.isRetype,
          })),
        );
      }

      // 3. Character stats UPSERT. The (user, profile, character)
      // unique index powers additive aggregation across sessions.
      // EXCLUDED refers to the proposed new row's values.
      if (stats.characters.length > 0) {
        await tx
          .insert(characterStats)
          .values(
            stats.characters.map((c) => ({
              userId,
              keyboardProfileId: profile.id,
              character: c.character,
              totalAttempts: c.attempts,
              totalErrors: c.errors,
              sumKeystrokeMs: Math.round(c.sumTime),
              hesitationCount: c.hesitationCount,
            })),
          )
          .onConflictDoUpdate({
            target: [
              characterStats.userId,
              characterStats.keyboardProfileId,
              characterStats.character,
            ],
            set: {
              totalAttempts: sql`${characterStats.totalAttempts} + EXCLUDED.total_attempts`,
              totalErrors: sql`${characterStats.totalErrors} + EXCLUDED.total_errors`,
              sumKeystrokeMs: sql`${characterStats.sumKeystrokeMs} + EXCLUDED.sum_keystroke_ms`,
              hesitationCount: sql`${characterStats.hesitationCount} + EXCLUDED.hesitation_count`,
              lastUpdated: sql`NOW()`,
            },
          });
      }

      // 4. Bigram stats UPSERT — same additive shape, no hesitation
      // column in this table.
      if (stats.bigrams.length > 0) {
        await tx
          .insert(bigramStats)
          .values(
            stats.bigrams.map((b) => ({
              userId,
              keyboardProfileId: profile.id,
              bigram: b.bigram,
              totalAttempts: b.attempts,
              totalErrors: b.errors,
              sumKeystrokeMs: Math.round(b.sumTime),
            })),
          )
          .onConflictDoUpdate({
            target: [
              bigramStats.userId,
              bigramStats.keyboardProfileId,
              bigramStats.bigram,
            ],
            set: {
              totalAttempts: sql`${bigramStats.totalAttempts} + EXCLUDED.total_attempts`,
              totalErrors: sql`${bigramStats.totalErrors} + EXCLUDED.total_errors`,
              sumKeystrokeMs: sql`${bigramStats.sumKeystrokeMs} + EXCLUDED.sum_keystroke_ms`,
              lastUpdated: sql`NOW()`,
            },
          });
      }

      // 5. Split-metrics snapshot. Per-session, not per-user — these
      // feed phase-transition detection and the dashboard's trend
      // charts, which need the time dimension.
      await tx.insert(splitMetricsSnapshots).values({
        sessionId: data.sessionId,
        userId,
        keyboardProfileId: profile.id,
        innerColAttempts: splitMetrics.innerColAttempts,
        innerColErrors: splitMetrics.innerColErrors,
        innerColErrorRate: splitMetrics.innerColErrorRate,
        thumbClusterCount: splitMetrics.thumbClusterCount,
        thumbClusterSumMs: Math.round(splitMetrics.thumbClusterSumMs),
        thumbClusterAvgMs: splitMetrics.thumbClusterAvgMs,
        crossHandBigramCount: splitMetrics.crossHandBigramCount,
        crossHandBigramSumMs: Math.round(splitMetrics.crossHandBigramSumMs),
        crossHandBigramAvgMs: splitMetrics.crossHandBigramAvgMs,
        columnarStableCount: splitMetrics.columnarStableCount,
        columnarDriftCount: splitMetrics.columnarDriftCount,
        columnarStabilityPct: splitMetrics.columnarStabilityPct,
      });
    });

    return { sessionId: data.sessionId };
  });
