import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { and, desc, eq, gte } from "drizzle-orm";
import { getCodeSnippet, type CodeLanguage } from "#/domain/codePractice/corpus";
import { symbolAccuracyPct, type CodeSessionEventDto } from "#/domain/codePractice/session";
import {
  type ActivityDay,
  bucketActivityByDay,
  formatDurationLabel,
} from "#/domain/dashboard/aggregates";
import { auth } from "./auth";
import { db } from "./db";
import { codePracticeSessions, keyboardProfiles, sessions, sessionTargets } from "./db/schema";

export type PracticeHistoryItem =
  | {
      id: string;
      track: "keyboard";
      startedAt: string;
      focusLabel: string;
      accuracyPct: number | null;
      wpm: number | null;
      durationLabel: string;
    }
  | {
      id: string;
      track: "coding";
      startedAt: string;
      title: string;
      language: CodeLanguage;
      accuracyPct: number;
      symbolAccuracyPct: number | null;
      wpm: number;
      durationLabel: string;
    };

export type PracticeHistoryData = {
  items: PracticeHistoryItem[];
  codeDays: ActivityDay[];
  allDays: ActivityDay[];
};

const RECENT_PER_TRACK = 20;
const ACTIVITY_WINDOW_DAYS = 30;

export const getPracticeHistory = createServerFn({ method: "GET" }).handler(
  async (): Promise<PracticeHistoryData> => {
    const request = getRequest();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw redirect({ to: "/login" });

    const [profile] = await db
      .select({ id: keyboardProfiles.id })
      .from(keyboardProfiles)
      .where(and(eq(keyboardProfiles.userId, session.user.id), eq(keyboardProfiles.isActive, true)))
      .limit(1);
    if (!profile) throw redirect({ to: "/onboarding" });

    const now = new Date();
    const activityCutoff = new Date(now);
    activityCutoff.setDate(activityCutoff.getDate() - ACTIVITY_WINDOW_DAYS);
    const keyboardOwner = and(
      eq(sessions.userId, session.user.id),
      eq(sessions.keyboardProfileId, profile.id),
    );
    const codeOwner = and(
      eq(codePracticeSessions.userId, session.user.id),
      eq(codePracticeSessions.keyboardProfileId, profile.id),
    );
    const [keyboardRows, codeRows, keyboardDates, codeDates] = await Promise.all([
      db
        .select({
          id: sessions.id,
          startedAt: sessions.startedAt,
          endedAt: sessions.endedAt,
          accuracy: sessions.accuracy,
          wpm: sessions.wpm,
          mode: sessions.mode,
          targetLabel: sessionTargets.targetLabel,
        })
        .from(sessions)
        .leftJoin(sessionTargets, eq(sessionTargets.sessionId, sessions.id))
        .where(keyboardOwner)
        .orderBy(desc(sessions.startedAt))
        .limit(RECENT_PER_TRACK),
      db
        .select({
          id: codePracticeSessions.id,
          startedAt: codePracticeSessions.startedAt,
          endedAt: codePracticeSessions.endedAt,
          accuracy: codePracticeSessions.accuracy,
          wpm: codePracticeSessions.wpm,
          language: codePracticeSessions.language,
          snippetId: codePracticeSessions.snippetId,
          events: codePracticeSessions.events,
        })
        .from(codePracticeSessions)
        .where(codeOwner)
        .orderBy(desc(codePracticeSessions.startedAt))
        .limit(RECENT_PER_TRACK),
      db
        .select({ startedAt: sessions.startedAt })
        .from(sessions)
        .where(and(keyboardOwner, gte(sessions.startedAt, activityCutoff))),
      db
        .select({ startedAt: codePracticeSessions.startedAt })
        .from(codePracticeSessions)
        .where(and(codeOwner, gte(codePracticeSessions.startedAt, activityCutoff))),
    ]);

    const keyboardItems: Extract<PracticeHistoryItem, { track: "keyboard" }>[] = keyboardRows.map(
      (row) => ({
        id: row.id,
        track: "keyboard",
        startedAt: row.startedAt.toISOString(),
        focusLabel:
          row.targetLabel ??
          (row.mode === "targeted_drill" ? "Focused drill" : "Adaptive practice"),
        accuracyPct: typeof row.accuracy === "number" ? Math.round(row.accuracy * 100) : null,
        wpm: typeof row.wpm === "number" && row.wpm > 0 ? Math.round(row.wpm) : null,
        durationLabel:
          row.endedAt === null
            ? "—"
            : formatDurationLabel(row.endedAt.getTime() - row.startedAt.getTime()),
      }),
    );
    const codeItems: Extract<PracticeHistoryItem, { track: "coding" }>[] = codeRows.map((row) => ({
      id: row.id,
      track: "coding",
      startedAt: row.startedAt.toISOString(),
      title: getCodeSnippet(row.snippetId)?.title ?? "Code example",
      language: row.language as CodeLanguage,
      accuracyPct: Math.round(row.accuracy * 100),
      symbolAccuracyPct: symbolAccuracyPct(
        Array.isArray(row.events) ? (row.events as CodeSessionEventDto[]) : [],
      ),
      wpm: Math.round(row.wpm),
      durationLabel: formatDurationLabel(row.endedAt.getTime() - row.startedAt.getTime()),
    }));

    return {
      items: [...keyboardItems, ...codeItems].sort(
        (a, b) => b.startedAt.localeCompare(a.startedAt) || a.id.localeCompare(b.id),
      ),
      codeDays: bucketActivityByDay(
        codeDates.map((row) => row.startedAt),
        now,
        ACTIVITY_WINDOW_DAYS,
      ),
      allDays: bucketActivityByDay(
        [...keyboardDates, ...codeDates].map((row) => row.startedAt),
        now,
        ACTIVITY_WINDOW_DAYS,
      ),
    };
  },
);
