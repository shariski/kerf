import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { and, count, desc, eq } from "drizzle-orm";
import {
  addCodeAdaptiveRun,
  emptyCodeAdaptiveByLanguage,
  emptyCodeAdaptiveEvidence,
} from "#/domain/codePractice/adaptive";
import { getCodeSnippet } from "#/domain/codePractice/corpus";
import { emptyCodeLanguageCounts, isCodeLanguage } from "#/domain/codePractice/languages";
import { summarizeCodeSession, type CodeSessionEventDto } from "#/domain/codePractice/session";
import { validateCodeSessionInput } from "#/domain/codePractice/validateSession";
import { auth } from "./auth";
import { db } from "./db";
import { codePracticeSessions, keyboardProfiles } from "./db/schema";

export const getCodePracticeContext = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw redirect({ to: "/login" });

  const [profile] = await db
    .select({ id: keyboardProfiles.id, keyboardType: keyboardProfiles.keyboardType })
    .from(keyboardProfiles)
    .where(and(eq(keyboardProfiles.userId, session.user.id), eq(keyboardProfiles.isActive, true)))
    .limit(1);
  if (!profile) throw redirect({ to: "/onboarding" });

  const owner = and(
    eq(codePracticeSessions.userId, session.user.id),
    eq(codePracticeSessions.keyboardProfileId, profile.id),
  );
  const [historyRows, countRows] = await Promise.all([
    db
      .select({
        snippetId: codePracticeSessions.snippetId,
        language: codePracticeSessions.language,
        events: codePracticeSessions.events,
        tabCount: codePracticeSessions.tabCount,
      })
      .from(codePracticeSessions)
      .where(owner)
      .orderBy(desc(codePracticeSessions.startedAt))
      .limit(120),
    db
      .select({ language: codePracticeSessions.language, total: count() })
      .from(codePracticeSessions)
      .where(owner)
      .groupBy(codePracticeSessions.language),
  ]);
  const completedCounts = emptyCodeLanguageCounts();
  for (const row of countRows) {
    if (isCodeLanguage(row.language)) {
      completedCounts[row.language] = row.total;
    }
  }
  const recent = historyRows.slice(0, 20).map((row) => ({
    snippetId: row.snippetId,
    language: row.language,
  }));
  const adaptiveByLanguage = emptyCodeAdaptiveByLanguage();
  let allCodeEvidence = emptyCodeAdaptiveEvidence();
  for (const row of historyRows) {
    const snippet = getCodeSnippet(row.snippetId);
    if (!isCodeLanguage(row.language) || snippet?.language !== row.language) continue;
    const run = {
      snippetId: row.snippetId,
      events: Array.isArray(row.events) ? (row.events as CodeSessionEventDto[]) : [],
      tabCount: row.tabCount,
    };
    adaptiveByLanguage[row.language] = addCodeAdaptiveRun(adaptiveByLanguage[row.language], run);
    allCodeEvidence = addCodeAdaptiveRun(allCodeEvidence, run);
  }
  return { profile, recent, completedCounts, adaptiveByLanguage, allCodeEvidence };
});

export const persistCodePracticeSession = createServerFn({ method: "POST" })
  .inputValidator(validateCodeSessionInput)
  .handler(async ({ data }) => {
    const request = getRequest();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new Error("code practice: unauthorized");

    const [profile] = await db
      .select({ id: keyboardProfiles.id })
      .from(keyboardProfiles)
      .where(
        and(
          eq(keyboardProfiles.id, data.keyboardProfileId),
          eq(keyboardProfiles.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!profile) throw new Error("code practice: profile not found");

    const snippet = getCodeSnippet(data.snippetId);
    if (!snippet) throw new Error("code practice: snippet not found");
    const summary = summarizeCodeSession(data);

    const inserted = await db
      .insert(codePracticeSessions)
      .values({
        id: data.sessionId,
        userId: session.user.id,
        keyboardProfileId: profile.id,
        corpusVersion: data.corpusVersion,
        snippetId: snippet.id,
        language: snippet.language,
        startedAt: new Date(data.startedAt),
        endedAt: new Date(data.endedAt),
        totalChars: data.events.length,
        totalErrors: summary.totalErrors,
        wpm: summary.wpm,
        accuracy: summary.accuracyPct / 100,
        tabCount: data.tabCount,
        events: data.events,
      })
      .onConflictDoNothing({ target: codePracticeSessions.id })
      .returning({ id: codePracticeSessions.id });

    return { saved: inserted.length > 0 };
  });
