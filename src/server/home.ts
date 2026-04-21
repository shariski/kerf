/**
 * Home/lobby data loader. Single round trip that returns everything
 * `/` needs for both states (zero-data welcome vs returning-user
 * lobby), so the route doesn't have to fan out to three separate
 * dashboard fns.
 *
 * Shape choice: `hasAnySession: boolean` is the state discriminant,
 * but the other fields always come through as empty/null when it's
 * false. A discriminated union would be tidier, but mixing it with
 * Tanstack Router loader inference ends up being more ceremony than
 * it's worth here.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import {
  bigramStats,
  characterStats,
  keyboardProfiles,
  sessions,
} from "./db/schema";
import type { KeyboardType } from "./profile";
import type { TransitionPhase } from "#/domain/profile/initialPhase";
import {
  bucketActivityByDay,
  computeStreakDays,
  computeWeaknessRanking,
  type ActivityDay,
  type WeaknessRankEntry,
} from "#/domain/dashboard/aggregates";
import { PHASE_BASELINES } from "#/domain/stats/baselines";

const ACTIVITY_WINDOW_DAYS = 30;
const HOME_TOP_WEAKNESSES = 3;

export type HomeLastSession = {
  /** ISO-8601 — serialized so the route can rehydrate on the client. */
  startedAt: string;
  endedAt: string | null;
  wpm: number | null;
  accuracyPct: number | null;
  /** Elapsed seconds from start to end; 0 when the session never
   * closed (shouldn't happen in normal flow, but we can't prove
   * endedAt is non-null from the schema). */
  durationSec: number;
};

export type HomeData = {
  profile: { keyboardType: KeyboardType };
  phase: TransitionPhase;
  hasAnySession: boolean;
  totalSessions: number;
  lastSession: HomeLastSession | null;
  /** Always 30 entries — empty days come through with sessionCount 0. */
  activity: ActivityDay[];
  streakDays: number;
  /** Top 3 only — the Home lobby just needs the pill row, not the full
   * ranking. */
  topWeaknesses: WeaknessRankEntry[];
};

export const getHomeData = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomeData> => {
    const request = getRequest();
    const authSession = await auth.api.getSession({ headers: request.headers });
    if (!authSession) {
      throw new Error("getHomeData: unauthorized");
    }
    const userId = authSession.user.id;

    const [profile] = await db
      .select({
        id: keyboardProfiles.id,
        keyboardType: keyboardProfiles.keyboardType,
        transitionPhase: keyboardProfiles.transitionPhase,
      })
      .from(keyboardProfiles)
      .where(
        and(
          eq(keyboardProfiles.userId, userId),
          eq(keyboardProfiles.isActive, true),
        ),
      )
      .limit(1);
    if (!profile) {
      throw new Error("getHomeData: no active profile");
    }

    const phase = profile.transitionPhase as TransitionPhase;
    const now = new Date();

    const sessionRows = await db
      .select({
        startedAt: sessions.startedAt,
        endedAt: sessions.endedAt,
        wpm: sessions.wpm,
        accuracy: sessions.accuracy,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.keyboardProfileId, profile.id),
        ),
      )
      .orderBy(asc(sessions.startedAt));

    if (sessionRows.length === 0) {
      return {
        profile: { keyboardType: profile.keyboardType as KeyboardType },
        phase,
        hasAnySession: false,
        totalSessions: 0,
        lastSession: null,
        activity: bucketActivityByDay([], now, ACTIVITY_WINDOW_DAYS),
        streakDays: 0,
        topWeaknesses: [],
      };
    }

    // Safe: we returned the zero-session branch above, so the array
    // is non-empty. TS's noUncheckedIndexedAccess can't see that.
    const latest = sessionRows[sessionRows.length - 1]!;
    const endedAtDate = latest.endedAt ?? null;
    const durationSec =
      endedAtDate === null
        ? 0
        : Math.max(
            0,
            Math.round(
              (endedAtDate.getTime() - latest.startedAt.getTime()) / 1000,
            ),
          );
    const lastSession: HomeLastSession = {
      startedAt: latest.startedAt.toISOString(),
      endedAt: endedAtDate === null ? null : endedAtDate.toISOString(),
      wpm: typeof latest.wpm === "number" ? Math.round(latest.wpm) : null,
      accuracyPct:
        typeof latest.accuracy === "number"
          ? Math.round(latest.accuracy * 100)
          : null,
      durationSec,
    };

    const startedDates = sessionRows.map((s) => s.startedAt);
    const activity = bucketActivityByDay(startedDates, now, ACTIVITY_WINDOW_DAYS);
    const streak = computeStreakDays(startedDates, now);

    const charRows = await db
      .select({
        character: characterStats.character,
        attempts: characterStats.totalAttempts,
        errors: characterStats.totalErrors,
        sumTime: characterStats.sumKeystrokeMs,
        hesitationCount: characterStats.hesitationCount,
      })
      .from(characterStats)
      .where(
        and(
          eq(characterStats.userId, userId),
          eq(characterStats.keyboardProfileId, profile.id),
        ),
      );

    const bigramRows = await db
      .select({
        bigram: bigramStats.bigram,
        attempts: bigramStats.totalAttempts,
        errors: bigramStats.totalErrors,
        sumTime: bigramStats.sumKeystrokeMs,
      })
      .from(bigramStats)
      .where(
        and(
          eq(bigramStats.userId, userId),
          eq(bigramStats.keyboardProfileId, profile.id),
        ),
      );

    const topWeaknesses = computeWeaknessRanking({
      chars: charRows,
      bigrams: bigramRows,
      baseline: PHASE_BASELINES[phase],
      phase,
      topN: HOME_TOP_WEAKNESSES,
    });

    return {
      profile: { keyboardType: profile.keyboardType as KeyboardType },
      phase,
      hasAnySession: true,
      totalSessions: sessionRows.length,
      lastSession,
      activity,
      streakDays: streak.current,
      topWeaknesses,
    };
  },
);
